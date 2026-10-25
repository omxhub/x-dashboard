"""FastAPI router for the x-dashboard Hermes dashboard plugin (v0.1.0).

Features:
- Zero secret leakage: never exposes access tokens, refresh tokens, client secrets, or raw bearer tokens.
- Scoped Hermes configuration & handle resolution (`plugins.entries.x-dashboard.settings`, `X_DASHBOARD_HANDLE`
  via `agent.secret_scope.get_secret`, `xurl auth status` when `xurl` is installed on PATH, and
  `<hermes_home>/plugin-data/x-dashboard/config.json`).
- 100% Free Mode ($0.00 default): public syndication (`api.fxtwitter.com` / `api.vxtwitter.com`) and
  Jina Reader timeline discovery (`r.jina.ai`), with opt-in `x_search` citation enrichment (`enable_x_search: false` by default).
- Optional `live_v2` mode via `X_BEARER_TOKEN` or `xurl` CLI with automatic fallback to Free Mode
  if X API v2 credits are depleted (402) or rate-limited (429).
- Persistent snapshot & 90-point historical time-series cache (`<hermes_home>/plugin-data/x-dashboard/snapshot_<handle>.json`).
"""

from __future__ import annotations

import concurrent.futures
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import logging
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time
from typing import Any

import requests
from agent.secret_scope import get_secret
from plugins.plugin_storage import plugin_data_dir

try:
    from fastapi import APIRouter, Body
except Exception:  # pragma: no cover - fallback for minimal test environments
    class APIRouter:  # type: ignore[no-redef]
        def get(self, *_a, **_k):
            return lambda fn: fn

        def post(self, *_a, **_k):
            return lambda fn: fn

    def Body(default=None, **_k):  # type: ignore[misc]
        return default

logger = logging.getLogger(__name__)

router = APIRouter()

USER_AGENT = "HermesXDashboard/0.1"
DEFAULT_TTL_SECONDS = 300
MAX_HISTORY_POINTS = 90
DEFAULT_GOALS = {"verified_followers": 500, "impressions": 500000}
VALID_MODES = ("auto", "free", "live_v2")

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
_HANDLE_RE = re.compile(r"^[A-Za-z0-9_]{1,15}$")
_STATUS_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})/status/(\d+)",
    re.IGNORECASE,
)
_STATUS_ID_RE = re.compile(r"/status/(\d+)", re.IGNORECASE)

_SECRET_KEYS = frozenset({
    "access_token",
    "refresh_token",
    "client_secret",
    "bearer_token",
    "api_key",
    "private_key",
    "private_keys_b64",
    "authorization",
    "xchat_access_token",
    "xchat_refresh_token",
    "xchat_client_secret",
    "x_bearer_token",
    "xai_api_key",
})

_memory_lock = threading.Lock()
_handle_locks: dict[str, threading.Lock] = {}
_xurl_status_cache: dict[str, Any] = {"ts": 0.0, "data": None}
_x_search_cooldown_until: float = 0.0


def _get_handle_lock(handle: str) -> threading.Lock:
    key = handle.lower().lstrip("@") or "default"
    with _memory_lock:
        lock = _handle_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _handle_locks[key] = lock
        return lock


def _sanitize_Handle(raw: str | None) -> str:
    if not raw:
        return ""
    cleaned = str(raw).strip().lstrip("@").strip()
    if _HANDLE_RE.match(cleaned):
        return cleaned
    return ""


def _scrub_secrets(obj: Any) -> Any:
    """Recursively strip any secret keys or raw Bearer strings from responses."""
    if isinstance(obj, dict):
        cleaned: dict[str, Any] = {}
        for k, v in obj.items():
            key_lower = str(k).lower()
            if key_lower in _SECRET_KEYS or any(
                s in key_lower for s in ("secret", "access_token", "refresh_token", "api_key", "private_key")
            ):
                continue
            cleaned[k] = _scrub_secrets(v)
        return cleaned
    if isinstance(obj, list):
        return [_scrub_secrets(item) for item in obj]
    if isinstance(obj, str):
        if "Bearer " in obj:
            return re.sub(r"Bearer\s+[A-Za-z0-9._~+/-]+=*", "Bearer [REDACTED]", obj)
        return obj
    return obj


# ---------------------------------------------------------------------------
# Hermes paths & persistent cache helpers
# ---------------------------------------------------------------------------


def _cache_dir() -> Path:
    return Path(plugin_data_dir("x-dashboard"))


def _config_path() -> Path:
    return _cache_dir() / "config.json"


def _snapshot_path(handle: str) -> Path:
    safe = _sanitize_Handle(handle).lower() or "default"
    return _cache_dir() / f"snapshot_{safe}.json"


def _read_json_file(path: Path) -> dict[str, Any]:
    try:
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {}


def _write_json_file(path: Path, payload: dict[str, Any]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(_scrub_secrets(payload), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        tmp.replace(path)
    except Exception as exc:
        logger.warning("Failed writing JSON file %s: %s", path, exc)


def _load_hermes_plugin_settings() -> dict[str, Any]:
    try:
        from hermes_cli.config import load_config
        cfg = load_config()
        if isinstance(cfg, dict):
            entry = ((cfg.get("plugins") or {}).get("entries") or {}).get("x-dashboard")
            if isinstance(entry, dict) and isinstance(entry.get("settings"), dict):
                return entry["settings"]
    except Exception:
        pass
    return {}


def _coerce_bool(val: Any, default: bool = False) -> bool:
    if isinstance(val, bool):
        return val
    if val is None:
        return default
    return str(val).strip().lower() in ("true", "1", "yes", "on")


def _load_dashboard_config() -> dict[str, Any]:
    raw = _read_json_file(_config_path())
    settings = _load_hermes_plugin_settings()
    goals_raw = raw.get("goals") if isinstance(raw.get("goals"), dict) else {}
    goals = {
        "verified_followers": int(goals_raw.get("verified_followers") or DEFAULT_GOALS["verified_followers"]),
        "impressions": int(goals_raw.get("impressions") or DEFAULT_GOALS["impressions"]),
    }
    mode = str(raw.get("default_mode") or raw.get("mode") or settings.get("default_mode") or "auto").strip().lower()
    if mode not in VALID_MODES:
        mode = "auto"
    handle = _sanitize_Handle(raw.get("handle") or settings.get("handle"))
    enable_x_search = _coerce_bool(
        raw["enable_x_search"] if "enable_x_search" in raw else settings.get("enable_x_search"),
        default=False,
    )
    return {
        "handle": handle,
        "default_mode": mode,
        "mode": mode,
        "enable_x_search": enable_x_search,
        "goals": goals,
        "updated_at": raw.get("updated_at"),
    }


def _save_dashboard_config(update: dict[str, Any]) -> dict[str, Any]:
    current = _load_dashboard_config()
    if "handle" in update and update["handle"] is not None:
        h = _sanitize_Handle(str(update["handle"]))
        if h:
            current["handle"] = h
        elif str(update["handle"]).strip() == "":
            current["handle"] = ""
    if "mode" in update or "default_mode" in update:
        m = str(update.get("mode") or update.get("default_mode") or "").strip().lower()
        if m in VALID_MODES:
            current["default_mode"] = m
            current["mode"] = m
    if "enable_x_search" in update and update["enable_x_search"] is not None:
        current["enable_x_search"] = _coerce_bool(update["enable_x_search"], default=False)
    if isinstance(update.get("goals"), dict):
        g = update["goals"]
        if g.get("verified_followers") is not None:
            try:
                current["goals"]["verified_followers"] = max(1, int(g["verified_followers"]))
            except (ValueError, TypeError):
                pass
        if g.get("impressions") is not None:
            try:
                current["goals"]["impressions"] = max(1, int(g["impressions"]))
            except (ValueError, TypeError):
                pass
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_json_file(_config_path(), current)
    return current


# ---------------------------------------------------------------------------
# Safe Hermes secret & auth discovery (Catalog Rule 9 & 11 compliant)
# ---------------------------------------------------------------------------


def _get_scoped_env(name: str) -> str:
    """Resolve a declared environment/secret value strictly via Hermes's secret_scope."""
    val = get_secret(name)
    return str(val).strip() if val is not None and str(val).strip() else ""


def _read_env_vars() -> dict[str, str]:
    """Read declared X Dashboard env vars via Hermes secret_scope (never returned raw to callers)."""
    merged: dict[str, str] = {}
    tracked_keys = (
        "X_DASHBOARD_HANDLE",
        "X_BEARER_TOKEN",
        "XAI_API_KEY",
    )
    for k in tracked_keys:
        v = _get_scoped_env(k)
        if v:
            merged[k] = v
    return merged


def _resolve_xurl_binary() -> tuple[str | None, str | None]:
    """Return (executable, optional_cli_js_arg) or (None, None) if xurl is not installed."""
    found = shutil.which("xurl")
    if found:
        return found, None
    return None, None


def _parse_xurl_auth_status(raw_output: str) -> dict[str, Any]:
    """Parse `xurl auth status` output (with or without ANSI codes) into structured app/handle info."""
    cleaned = _ANSI_RE.sub("", raw_output or "")
    apps: list[dict[str, Any]] = []
    current_app: dict[str, Any] | None = None

    for raw_line in cleaned.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            continue
        is_indented = len(line) - len(line.lstrip(" ")) >= 2 and not stripped.startswith("[")
        has_marker = "▸" in stripped or stripped.startswith(">") or stripped.startswith("*")
        unmarked = stripped.lstrip("▸>* ").strip()

        # App header line: e.g. `default  [(no credentials)]` or `▸ my-xurl-app  [client_id:...]`
        if not is_indented and ("[" in unmarked or not unmarked.startswith(("redirect_uri:", "oauth2:", "oauth1:", "bearer:"))):
            app_name = unmarked.split()[0] if unmarked.split() else ""
            if app_name and not app_name.endswith(":"):
                current_app = {
                    "name": app_name,
                    "is_default": has_marker,
                    "oauth2_handle": None,
                    "oauth2_default": False,
                    "has_oauth1": False,
                    "has_bearer": False,
                }
                apps.append(current_app)
                continue

        if current_app is not None and ":" in unmarked:
            field_name, field_val = unmarked.split(":", 1)
            field_name = field_name.strip().lower()
            field_val = field_val.strip()
            if field_name == "oauth2":
                if field_val and field_val.lower() not in ("(none)", "none", "–", "-", "✗"):
                    handle = _sanitize_Handle(field_val.split()[0])
                    if handle:
                        current_app["oauth2_handle"] = handle
                        if has_marker:
                            current_app["oauth2_default"] = True
            elif field_name == "oauth1":
                if field_val and field_val.lower() not in ("(none)", "none", "–", "-", "✗"):
                    current_app["has_oauth1"] = True
            elif field_name == "bearer":
                if "✓" in field_val or (field_val and field_val.lower() not in ("(none)", "none", "–", "-", "✗")):
                    current_app["has_bearer"] = True

    handles: list[str] = []
    default_app: str | None = None
    primary_handle: str | None = None

    # Prefer app marked default that also has an oauth2 handle
    for app in apps:
        h = app.get("oauth2_handle")
        if h and h not in handles:
            handles.append(h)
        if (app.get("is_default") or app.get("oauth2_default")) and h and not primary_handle:
            primary_handle = h
            default_app = app["name"]

    if not primary_handle and handles:
        primary_handle = handles[0]
        for app in apps:
            if app.get("oauth2_handle") == primary_handle:
                default_app = app["name"]
                break

    if not default_app and apps:
        for app in apps:
            if app.get("is_default"):
                default_app = app["name"]
                break
        if not default_app:
            default_app = apps[0]["name"]

    return {
        "apps": apps,
        "default_app": default_app,
        "handles": handles,
        "primary_handle": primary_handle,
        "has_bearer": any(a.get("has_bearer") for a in apps),
    }


def _get_xurl_auth_info(force_refresh: bool = False) -> dict[str, Any]:
    now = time.time()
    with _memory_lock:
        if not force_refresh and _xurl_status_cache["data"] is not None and (now - _xurl_status_cache["ts"]) < 60:
            return _xurl_status_cache["data"]

    xurl_bin, xurl_cli = _resolve_xurl_binary()
    if not xurl_bin:
        info = {
            "available": False,
            "apps": [],
            "default_app": None,
            "handles": [],
            "primary_handle": None,
            "has_bearer": False,
        }
        with _memory_lock:
            _xurl_status_cache["ts"] = now
            _xurl_status_cache["data"] = info
        return info

    cmd = [xurl_bin]
    if xurl_cli:
        cmd.append(xurl_cli)
    cmd += ["auth", "status"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=8, check=False)
        raw = (proc.stdout or "") + "\n" + (proc.stderr or "")
        parsed = _parse_xurl_auth_status(raw)
        parsed["available"] = proc.returncode == 0 or bool(parsed["apps"])
    except Exception:
        parsed = {
            "available": False,
            "apps": [],
            "default_app": None,
            "handles": [],
            "primary_handle": None,
            "has_bearer": False,
        }

    with _memory_lock:
        _xurl_status_cache["ts"] = now
        _xurl_status_cache["data"] = parsed
    return parsed


def _check_x_search_available() -> bool:
    try:
        from tools.registry import registry
        if registry.is_toolset_available("x_search"):
            return True
    except Exception:
        pass
    return bool(_get_scoped_env("XAI_API_KEY"))


def _is_x_search_enabled() -> bool:
    """Paid xAI x_search calls are strictly opt-in via `enable_x_search: true`."""
    return bool(_load_dashboard_config().get("enable_x_search")) and _check_x_search_available()


def _detect_connection(requested_handle: str | None = None, requested_mode: str | None = None) -> dict[str, Any]:
    """Auto-discover Hermes-linked X accounts and auth capabilities without exposing secrets."""
    env_vars = _read_env_vars()
    cfg = _load_dashboard_config()
    xurl_info = _get_xurl_auth_info()
    x_search_avail = _check_x_search_available()
    x_search_enabled = bool(cfg.get("enable_x_search")) and x_search_avail
    has_bearer_token = bool(env_vars.get("X_BEARER_TOKEN"))

    # 1. Environment handle
    env_handle = _sanitize_Handle(env_vars.get("X_DASHBOARD_HANDLE"))

    # 2. xurl CLI OAuth2 handle
    xurl_handle = _sanitize_Handle(xurl_info.get("primary_handle"))
    xurl_available = bool(xurl_info.get("available"))
    xurl_oauth_linked = bool(xurl_handle)

    # 3. Config handle
    cfg_handle = _sanitize_Handle(cfg.get("handle"))

    # Collect all available handles in priority order
    available_handles: list[str] = []
    for candidate in (
        _sanitize_Handle(requested_handle),
        cfg_handle,
        env_handle,
        xurl_handle,
        *(xurl_info.get("handles") or []),
    ):
        if candidate and candidate not in available_handles:
            available_handles.append(candidate)

    # Also include handles from existing snapshot files
    try:
        for snap_file in sorted(_cache_dir().glob("snapshot_*.json")):
            stem = snap_file.stem.replace("snapshot_", "", 1)
            sh = _sanitize_Handle(stem)
            if sh and sh not in available_handles and sh != "default":
                available_handles.append(sh)
    except Exception:
        pass

    # Active handle selection
    active_handle = (
        _sanitize_Handle(requested_handle)
        or cfg_handle
        or env_handle
        or xurl_handle
        or (available_handles[0] if available_handles else "NousResearch")
    )
    if active_handle and active_handle not in available_handles:
        available_handles.insert(0, active_handle)

    # Auth sources breakdown (safe metadata only)
    auth_sources = [
        {
            "id": "xurl",
            "label": "xurl CLI (`xurl auth status`)",
            "detected": xurl_oauth_linked or (xurl_available and bool(xurl_info.get("has_bearer"))),
            "handle": xurl_handle or (active_handle if xurl_oauth_linked else None),
            "app": xurl_info.get("default_app"),
            "detail": (
                f"Linked @{xurl_handle} via app '{xurl_info.get('default_app')}'"
                if xurl_handle
                else ("xurl CLI installed (bearer configured)" if xurl_info.get("has_bearer") else "No xurl OAuth2 session")
            ),
        },
        {
            "id": "x_bearer",
            "label": "X API v2 Bearer Token (`X_BEARER_TOKEN`)",
            "detected": has_bearer_token,
            "handle": active_handle if has_bearer_token else None,
            "detail": "Scoped X_BEARER_TOKEN configured for on-demand Live API v2" if has_bearer_token else "Not configured",
        },
        {
            "id": "x_search",
            "label": "Hermes xAI X Search (Opt-In)",
            "detected": x_search_enabled,
            "handle": active_handle if x_search_enabled else None,
            "detail": (
                "Opt-in xAI citation discovery enabled (paid xAI tool)"
                if x_search_enabled
                else (
                    "Available (opt-in disabled by default; set enable_x_search=true to use)"
                    if x_search_avail
                    else "Unavailable"
                )
            ),
        },
        {
            "id": "public_free",
            "label": "Zero-Cost Public Syndication & Cache",
            "detected": True,
            "handle": active_handle,
            "detail": "100% Free ($0.00) · FxTwitter + Jina Reader + local snapshot cache",
        },
    ]

    auto_linked = bool(env_handle or xurl_oauth_linked or has_bearer_token)
    if xurl_oauth_linked:
        active_source = "xurl"
    elif env_handle:
        active_source = "env"
    elif has_bearer_token:
        active_source = "x_bearer"
    else:
        active_source = "public_free"

    mode = str(requested_mode or cfg.get("default_mode") or "auto").strip().lower()
    if mode not in VALID_MODES:
        mode = "auto"

    snap = _read_json_file(_snapshot_path(active_handle))
    cache_updated_at = snap.get("updated_at")

    return _scrub_secrets({
        "ok": True,
        "connected": True,
        "auto_linked": auto_linked,
        "active_source": active_source,
        "auth_sources": auth_sources,
        "handle": active_handle,
        "available_handles": available_handles,
        "x_search_available": x_search_avail,
        "x_search_enabled": x_search_enabled,
        "xurl_available": xurl_available,
        "xurl_app": xurl_info.get("default_app"),
        "xchat_configured": False,
        "mode": mode,
        "cost_policy": "zero_cost_free_default",
        "goals": cfg.get("goals") or dict(DEFAULT_GOALS),
        "cache_updated_at": cache_updated_at,
    })


# ---------------------------------------------------------------------------
# Date/time & post/mention normalization
# ---------------------------------------------------------------------------


def _parse_created_at_iso(raw_date: Any, fallback_ts: Any = None) -> tuple[str, int]:
    """Normalize Twitter's `Thu Oct 22 17:14:54 +0000 2026` or ISO strings into (ISO8601, epoch_sec)."""
    if isinstance(fallback_ts, (int, float)) and fallback_ts > 0:
        dt = datetime.fromtimestamp(float(fallback_ts), tz=timezone.utc)
        return dt.isoformat(), int(fallback_ts)
    if isinstance(raw_date, str) and raw_date.strip():
        s = raw_date.strip()
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat(), int(dt.timestamp())
        except Exception:
            pass
        try:
            dt = parsedate_to_datetime(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat(), int(dt.timestamp())
        except Exception:
            pass
    now_dt = datetime.now(timezone.utc)
    return str(raw_date or now_dt.isoformat()), int(now_dt.timestamp())


def _upgrade_avatar_url(url: str | None) -> str | None:
    if not url:
        return None
    return re.sub(r"_(?:normal|200x200|bigger)\.(jpg|jpeg|png|webp)$", r"_400x400.\1", str(url))


def _calc_engagement_rate(
    impressions: int,
    likes: int,
    reposts: int,
    replies: int,
    quotes: int = 0,
    bookmarks: int = 0,
) -> float:
    interactions = max(0, likes) + max(0, reposts) + max(0, replies) + max(0, quotes) + max(0, bookmarks)
    return round((interactions / max(int(impressions or 0), 1)) * 100.0, 2)


def _normalize_external_url(raw_url: Any, fallback_url: Any = None) -> str | None:
    candidate: Any = raw_url
    if isinstance(raw_url, dict):
        candidate = raw_url.get("url") or raw_url.get("display_url")
    if not isinstance(candidate, str) or not candidate.strip():
        candidate = fallback_url
    if not isinstance(candidate, str):
        return None
    s = candidate.strip()
    if not s:
        return None
    if s.startswith("https://") or s.startswith("http://"):
        return s
    if re.match(r"^[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,}(/.*)?$", s):
        return f"https://{s}"
    return None


def _normalize_fx_profile(
    user_obj: dict[str, Any],
    handle: str,
    cached_account: dict[str, Any] | None = None,
) -> dict[str, Any]:
    cached = cached_account or {}
    verification = user_obj.get("verification") if isinstance(user_obj.get("verification"), dict) else {}
    website = _normalize_external_url(user_obj.get("website"), cached.get("website"))

    created_iso, _ = _parse_created_at_iso(user_obj.get("joined") or user_obj.get("created_at") or cached.get("created_at"))
    cached_vf = cached.get("verified_followers_count")
    has_cached_vf = isinstance(cached_vf, int) and cached_vf > 0

    verified = bool(
        verification.get("verified")
        or user_obj.get("verified")
        or cached.get("verified")
        or has_cached_vf
    )
    verified_type = verification.get("type") or user_obj.get("verified_type") or cached.get("verified_type")
    subscription_type = (
        user_obj.get("subscription_type")
        or cached.get("subscription_type")
        or ("Premium" if verified else "Standard")
    )

    return {
        "ok": True,
        "id": str(user_obj.get("id") or cached.get("id") or ""),
        "username": user_obj.get("screen_name") or user_obj.get("username") or handle,
        "name": user_obj.get("name") or cached.get("name") or handle,
        "description": user_obj.get("description") if user_obj.get("description") is not None else (cached.get("description") or ""),
        "profile_image_url": _upgrade_avatar_url(user_obj.get("avatar_url") or user_obj.get("profile_image_url") or cached.get("profile_image_url")),
        "banner_url": user_obj.get("banner_url") or user_obj.get("profile_banner_url") or cached.get("banner_url"),
        "location": user_obj.get("location") if user_obj.get("location") is not None else (cached.get("location") or ""),
        "website": website,
        "created_at": created_iso,
        "subscription_type": subscription_type,
        "verified": verified,
        "verified_type": verified_type,
        "followers_count": int(user_obj.get("followers") if user_obj.get("followers") is not None else (cached.get("followers_count") or 0)),
        "following_count": int(user_obj.get("following") if user_obj.get("following") is not None else (cached.get("following_count") or 0)),
        "tweet_count": int(user_obj.get("tweets") if user_obj.get("tweets") is not None else (cached.get("tweet_count") or 0)),
        "likes_count": int(user_obj.get("likes") if user_obj.get("likes") is not None else (cached.get("likes_count") or 0)),
        "media_count": int(user_obj.get("media_count") if user_obj.get("media_count") is not None else (cached.get("media_count") or 0)),
        "listed_count": int(user_obj.get("listed_count") if user_obj.get("listed_count") is not None else (cached.get("listed_count") or 0)),
        "verified_followers_count": int(cached_vf) if has_cached_vf else int(user_obj.get("verified_followers_count") or 0),
        "verified_followers_cached": bool(has_cached_vf and user_obj.get("verified_followers_count") is None),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def _normalize_fx_post(tweet: dict[str, Any], default_handle: str) -> dict[str, Any]:
    tid = str(tweet.get("id") or tweet.get("tweetID") or "")
    author = tweet.get("author") if isinstance(tweet.get("author"), dict) else {}
    handle = author.get("screen_name") or tweet.get("user_screen_name") or default_handle
    created_iso, created_ts = _parse_created_at_iso(
        tweet.get("created_at") or tweet.get("date"),
        tweet.get("created_timestamp") or tweet.get("date_epoch"),
    )
    impressions = int(tweet.get("views") if tweet.get("views") is not None else (tweet.get("impressions") or 0))
    likes = int(tweet.get("likes") or 0)
    reposts = int(tweet.get("retweets") if tweet.get("retweets") is not None else (tweet.get("reposts") or 0))
    replies = int(tweet.get("replies") or 0)
    quotes = int(tweet.get("quotes") or 0)
    bookmarks = int(tweet.get("bookmarks") or 0)

    media_list: list[dict[str, Any]] = []
    media_obj = tweet.get("media")
    if isinstance(media_obj, dict):
        for m in media_obj.get("all") or media_obj.get("photos") or []:
            if isinstance(m, dict) and m.get("url"):
                media_list.append({
                    "type": m.get("type") or "photo",
                    "url": m.get("url"),
                    "thumbnail_url": m.get("thumbnail_url") or m.get("url"),
                    "width": m.get("width"),
                    "height": m.get("height"),
                })
    elif isinstance(tweet.get("media_extended"), list):
        for m in tweet["media_extended"]:
            if isinstance(m, dict) and m.get("url"):
                media_list.append({
                    "type": m.get("type") or "photo",
                    "url": m.get("url"),
                    "thumbnail_url": m.get("thumbnail_url") or m.get("url"),
                })

    return {
        "id": tid,
        "text": str(tweet.get("text") or ""),
        "created_at": created_iso,
        "created_timestamp": created_ts,
        "lang": tweet.get("lang") or "en",
        "impressions": impressions,
        "likes": likes,
        "reposts": reposts,
        "replies": replies,
        "quotes": quotes,
        "bookmarks": bookmarks,
        "engagement_rate": _calc_engagement_rate(impressions, likes, reposts, replies, quotes, bookmarks),
        "url": tweet.get("url") or f"https://x.com/{handle}/status/{tid}",
        "media": media_list,
        "replying_to": tweet.get("replying_to"),
    }


def _normalize_fx_mention(tweet: dict[str, Any], fallback_user: str) -> dict[str, Any]:
    tid = str(tweet.get("id") or tweet.get("tweetID") or "")
    author = tweet.get("author") if isinstance(tweet.get("author"), dict) else {}
    author_username = author.get("screen_name") or tweet.get("user_screen_name") or fallback_user or "unknown"
    author_name = author.get("name") or tweet.get("user_name") or author_username
    author_avatar = _upgrade_avatar_url(author.get("avatar_url") or tweet.get("user_profile_image_url"))
    author_followers = int(author.get("followers") or 0)
    created_iso, created_ts = _parse_created_at_iso(
        tweet.get("created_at") or tweet.get("date"),
        tweet.get("created_timestamp") or tweet.get("date_epoch"),
    )
    impressions = int(tweet.get("views") if tweet.get("views") is not None else (tweet.get("impressions") or 0))
    likes = int(tweet.get("likes") or 0)
    reposts = int(tweet.get("retweets") if tweet.get("retweets") is not None else (tweet.get("reposts") or 0))
    replies = int(tweet.get("replies") or 0)
    quotes = int(tweet.get("quotes") or 0)
    bookmarks = int(tweet.get("bookmarks") or 0)

    return {
        "id": tid,
        "text": str(tweet.get("text") or ""),
        "created_at": created_iso,
        "created_timestamp": created_ts,
        "author_username": author_username,
        "author_name": author_name,
        "author_avatar": author_avatar,
        "author_followers": author_followers,
        "impressions": impressions,
        "likes": likes,
        "reposts": reposts,
        "replies": replies,
        "quotes": quotes,
        "bookmarks": bookmarks,
        "engagement_rate": _calc_engagement_rate(impressions, likes, reposts, replies, quotes, bookmarks),
        "url": tweet.get("url") or f"https://x.com/{author_username}/status/{tid}",
    }


# ---------------------------------------------------------------------------
# Analytics & Snapshot History
# ---------------------------------------------------------------------------


def _compute_posts_analytics(posts: list[dict[str, Any]]) -> dict[str, Any]:
    total_impressions = 0
    total_likes = 0
    total_reposts = 0
    total_replies = 0
    total_bookmarks = 0
    total_quotes = 0
    posting_by_hour = [0] * 24
    impressions_by_hour = [0] * 24
    posting_by_day: dict[str, int] = {}
    with_media = 0
    photos = 0
    videos = 0

    top_post: dict[str, Any] | None = None
    best_score = -1.0

    for p in posts:
        imp = max(0, int(p.get("impressions") or 0))
        lk = max(0, int(p.get("likes") or 0))
        rp = max(0, int(p.get("reposts") or 0))
        re_cnt = max(0, int(p.get("replies") or 0))
        bm = max(0, int(p.get("bookmarks") or 0))
        qt = max(0, int(p.get("quotes") or 0))

        total_impressions += imp
        total_likes += lk
        total_reposts += rp
        total_replies += re_cnt
        total_bookmarks += bm
        total_quotes += qt

        score = imp + (lk + rp * 2 + re_cnt * 1.5 + bm * 2 + qt * 2) * 25.0
        if score > best_score:
            best_score = score
            top_post = p

        media_items = p.get("media") or []
        if media_items:
            with_media += 1
            for m in media_items:
                mtype = str((m or {}).get("type") or "").lower()
                if "video" in mtype or "gif" in mtype:
                    videos += 1
                else:
                    photos += 1

        iso_str, ts = _parse_created_at_iso(p.get("created_at"), p.get("created_timestamp"))
        try:
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            hr = dt.hour
            posting_by_hour[hr] += 1
            impressions_by_hour[hr] += imp
            day_key = dt.strftime("%Y-%m-%d")
            posting_by_day[day_key] = posting_by_day.get(day_key, 0) + 1
        except Exception:
            if iso_str and len(iso_str) >= 10:
                day_key = iso_str[:10]
                posting_by_day[day_key] = posting_by_day.get(day_key, 0) + 1

    total_engagements = total_likes + total_reposts + total_replies + total_bookmarks + total_quotes
    if total_impressions > 0:
        avg_engagement_rate = round((total_engagements / total_impressions) * 100.0, 2)
    elif posts:
        avg_engagement_rate = round(
            sum(float(p.get("engagement_rate") or 0.0) for p in posts) / len(posts),
            2,
        )
    else:
        avg_engagement_rate = 0.0

    return {
        "total_impressions": total_impressions,
        "total_likes": total_likes,
        "total_reposts": total_reposts,
        "total_replies": total_replies,
        "total_bookmarks": total_bookmarks,
        "total_quotes": total_quotes,
        "avg_engagement_rate": avg_engagement_rate,
        "top_post": top_post,
        "posting_by_hour": posting_by_hour,
        "impressions_by_hour": impressions_by_hour,
        "posting_by_day": posting_by_day,
        "media_breakdown": {
            "with_media": with_media,
            "text_only": max(0, len(posts) - with_media),
            "photos": photos,
            "videos": videos,
        },
    }


def _update_snapshot_cache(
    handle: str,
    *,
    account: dict[str, Any] | None = None,
    posts: list[dict[str, Any]] | None = None,
    mentions: list[dict[str, Any]] | None = None,
    source_mode: str = "free",
) -> dict[str, Any]:
    path = _snapshot_path(handle)
    snap = _read_json_file(path)
    now_iso = datetime.now(timezone.utc).isoformat()
    now_epoch = time.time()

    if account and account.get("ok"):
        prev_acct = snap.get("account") if isinstance(snap.get("account"), dict) else {}
        if not account.get("verified_followers_count") and prev_acct.get("verified_followers_count"):
            account["verified_followers_count"] = prev_acct["verified_followers_count"]
            account["verified_followers_cached"] = True
        if source_mode == "live_v2" and account.get("verified_followers_count") is not None:
            account["verified_followers_cached"] = False
        snap["account"] = account
        snap["account_updated_epoch"] = now_epoch

    if posts is not None:
        existing_posts = snap.get("posts") if isinstance(snap.get("posts"), list) else []
        by_id: dict[str, dict[str, Any]] = {}
        for p in existing_posts:
            if isinstance(p, dict) and p.get("id"):
                by_id[str(p["id"])] = p
        for p in posts:
            if isinstance(p, dict) and p.get("id"):
                by_id[str(p["id"])] = p
        merged_posts = sorted(
            by_id.values(),
            key=lambda item: (int(item.get("created_timestamp") or 0), int(str(item.get("id") or "0")) if str(item.get("id") or "").isdigit() else 0),
            reverse=True,
        )[:50]
        snap["posts"] = merged_posts
        snap["analytics"] = _compute_posts_analytics(merged_posts[:20])
        snap["posts_updated_epoch"] = now_epoch

    if mentions is not None:
        existing_mentions = snap.get("mentions") if isinstance(snap.get("mentions"), list) else []
        by_id_m: dict[str, dict[str, Any]] = {}
        for m in existing_mentions:
            if isinstance(m, dict) and m.get("id"):
                by_id_m[str(m["id"])] = m
        for m in mentions:
            if isinstance(m, dict) and m.get("id"):
                by_id_m[str(m["id"])] = m
        merged_mentions = sorted(
            by_id_m.values(),
            key=lambda item: (int(item.get("created_timestamp") or 0), int(str(item.get("id") or "0")) if str(item.get("id") or "").isdigit() else 0),
            reverse=True,
        )[:40]
        snap["mentions"] = merged_mentions
        snap["mentions_updated_epoch"] = now_epoch

    acct_now = snap.get("account") if isinstance(snap.get("account"), dict) else {}
    analytics_now = snap.get("analytics") if isinstance(snap.get("analytics"), dict) else _compute_posts_analytics(snap.get("posts") or [])
    snap["analytics"] = analytics_now

    if acct_now.get("followers_count") is not None or acct_now.get("tweet_count") is not None:
        history: list[dict[str, Any]] = list(snap.get("history") or [])
        point = {
            "timestamp": now_iso,
            "followers_count": int(acct_now.get("followers_count") or 0),
            "verified_followers_count": int(acct_now.get("verified_followers_count") or 0),
            "tweet_count": int(acct_now.get("tweet_count") or 0),
            "following_count": int(acct_now.get("following_count") or 0),
            "likes_count": int(acct_now.get("likes_count") or 0),
            "media_count": int(acct_now.get("media_count") or 0),
            "recent_impressions": int(analytics_now.get("total_impressions") or 0),
        }
        if history:
            last = history[-1]
            same_metrics = (
                last.get("followers_count") == point["followers_count"]
                and last.get("tweet_count") == point["tweet_count"]
                and last.get("recent_impressions") == point["recent_impressions"]
            )
            if same_metrics:
                history[-1] = point
            else:
                history.append(point)
        else:
            history.append(point)
        snap["history"] = history[-MAX_HISTORY_POINTS:]

    snap["handle"] = handle
    snap["source_mode"] = source_mode
    snap["updated_at"] = now_iso
    snap["updated_epoch"] = now_epoch
    _write_json_file(path, snap)
    return snap


# ---------------------------------------------------------------------------
# Free Mode ($0.00) Data Engine
# ---------------------------------------------------------------------------


def _fetch_account_free(handle: str, cached_account: dict[str, Any] | None = None) -> dict[str, Any]:
    """Fetch public X profile from FxTwitter / VxTwitter at $0.00 cost."""
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    errors: list[str] = []

    for base_url in (f"https://api.fxtwitter.com/{handle}", f"https://api.vxtwitter.com/{handle}"):
        try:
            resp = requests.get(base_url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                user_obj = data.get("user") if isinstance(data.get("user"), dict) else data
                if isinstance(user_obj, dict) and (user_obj.get("screen_name") or user_obj.get("name") or user_obj.get("followers") is not None):
                    profile = _normalize_fx_profile(user_obj, handle, cached_account=cached_account)
                    profile["source_mode"] = "free"
                    profile["cost_incurred"] = "$0.00"
                    return profile
            errors.append(f"{base_url} HTTP {resp.status_code}")
        except Exception as exc:
            errors.append(f"{base_url}: {exc}")

    if cached_account and cached_account.get("ok"):
        fallback = dict(cached_account)
        fallback["cached"] = True
        fallback["source_mode"] = "cache_fallback"
        fallback["cost_incurred"] = "$0.00"
        return fallback

    return {"ok": False, "error": "; ".join(errors) or f"Could not fetch public profile for @{handle}"}


def _discover_post_ids_jina(handle: str) -> list[str]:
    """Extract status IDs from Jina Reader markdown snapshot of `https://x.com/{handle}`."""
    url = f"https://r.jina.ai/https://x.com/{handle}"
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=12)
        if resp.status_code != 200:
            return []
        pattern = re.compile(rf"/{re.escape(handle)}/status/(\d+)", re.IGNORECASE)
        return list(dict.fromkeys(pattern.findall(resp.text)))
    except Exception:
        return []


def _run_x_search_query(
    query: str,
    *,
    allowed_x_handles: list[str] | None = None,
    excluded_x_handles: list[str] | None = None,
) -> dict[str, Any]:
    """Call Hermes's registered `x_search` tool via public `tools.registry` when explicitly opted in."""
    global _x_search_cooldown_until
    if time.time() < _x_search_cooldown_until:
        return {}
    if not _is_x_search_enabled():
        return {}
    try:
        from tools.registry import registry

        args: dict[str, Any] = {"query": query}
        if allowed_x_handles is not None:
            args["allowed_x_handles"] = allowed_x_handles
        if excluded_x_handles is not None:
            args["excluded_x_handles"] = excluded_x_handles
        raw = registry.dispatch("x_search", args)
        data = json.loads(raw) if isinstance(raw, str) else raw
        if isinstance(data, dict) and data.get("error"):
            err_str = str(data.get("error"))
            if "402" in err_str or "429" in err_str or "401" in err_str or "403" in err_str:
                _x_search_cooldown_until = time.time() + 900.0
            return {}
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.debug("x_search dispatch failed: %s", exc)
        return {}


def _extract_urls_from_x_search(res: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    for item in res.get("inline_citations") or []:
        if isinstance(item, dict) and item.get("url"):
            urls.append(str(item["url"]))
    for c in res.get("citations") or []:
        if isinstance(c, str):
            urls.append(c)
        elif isinstance(c, dict) and c.get("url"):
            urls.append(str(c["url"]))
    answer = str(res.get("answer") or "")
    if answer:
        urls.append(answer)
    return urls


def _discover_post_ids_x_search(handle: str) -> list[str]:
    res = _run_x_search_query(f"recent posts by @{handle}", allowed_x_handles=[handle])
    blob = " ".join(_extract_urls_from_x_search(res))
    ids: list[str] = []
    for user, sid in _STATUS_URL_RE.findall(blob):
        if user.lower() == handle.lower() and sid not in ids:
            ids.append(sid)
    for sid in _STATUS_ID_RE.findall(blob):
        if sid not in ids:
            ids.append(sid)
    return ids


def _fetch_single_fx_status(user: str, status_id: str) -> dict[str, Any] | None:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    for host in ("https://api.fxtwitter.com", "https://api.vxtwitter.com"):
        try:
            resp = requests.get(f"{host}/{user}/status/{status_id}", headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                tweet = data.get("tweet") if isinstance(data.get("tweet"), dict) else data
                if isinstance(tweet, dict) and (tweet.get("id") or tweet.get("tweetID") or tweet.get("text") is not None):
                    return tweet
        except Exception:
            continue
    return None


def _fetch_posts_free(
    handle: str,
    limit: int = 20,
    cached_posts: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """Fetch recent posts for `handle` at $0.00 X API cost via Jina + FxTwitter (plus opt-in x_search)."""
    limit = max(1, min(int(limit or 20), 50))

    if _is_x_search_enabled():
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            fut_jina = pool.submit(_discover_post_ids_jina, handle)
            fut_xsearch = pool.submit(_discover_post_ids_x_search, handle)
            jina_ids = fut_jina.result()
            xsearch_ids = fut_xsearch.result()
    else:
        jina_ids = _discover_post_ids_jina(handle)
        xsearch_ids = []

    cached_ids = [
        str(p.get("id"))
        for p in (cached_posts or [])
        if isinstance(p, dict) and str(p.get("id") or "").isdigit()
    ]

    combined_ids: list[str] = []
    for sid in [*xsearch_ids, *jina_ids, *cached_ids]:
        if sid and sid.isdigit() and sid not in combined_ids:
            combined_ids.append(sid)

    combined_ids.sort(key=lambda s: int(s), reverse=True)
    target_ids = combined_ids[:limit]

    if not target_ids:
        return list(cached_posts or [])[:limit], None

    tweets_raw: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_fetch_single_fx_status, handle, sid): sid for sid in target_ids}
        for fut in concurrent.futures.as_completed(futures):
            res = fut.result()
            if isinstance(res, dict):
                tweets_raw.append(res)

    normalized_by_id: dict[str, dict[str, Any]] = {}
    freshest_author: dict[str, Any] | None = None
    freshest_ts = -1

    for t in tweets_raw:
        author = t.get("author") if isinstance(t.get("author"), dict) else {}
        author_screen = str(author.get("screen_name") or handle).lower()
        if author_screen != handle.lower():
            continue
        norm = _normalize_fx_post(t, handle)
        if norm["id"]:
            normalized_by_id[norm["id"]] = norm
            if norm["created_timestamp"] > freshest_ts and author:
                freshest_ts = norm["created_timestamp"]
                freshest_author = author

    for cp in cached_posts or []:
        cid = str(cp.get("id") or "")
        if cid in target_ids and cid not in normalized_by_id:
            normalized_by_id[cid] = cp

    items = sorted(
        normalized_by_id.values(),
        key=lambda item: (int(item.get("created_timestamp") or 0), int(str(item.get("id") or "0")) if str(item.get("id") or "").isdigit() else 0),
        reverse=True,
    )[:limit]

    return items, freshest_author


def _fetch_mentions_free(
    handle: str,
    limit: int = 20,
    cached_mentions: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Fetch recent mentions of `@handle` via FxTwitter + cached mentions (plus opt-in x_search)."""
    limit = max(1, min(int(limit or 20), 50))
    res = (
        _run_x_search_query(f"recent posts mentioning @{handle}", excluded_x_handles=[handle])
        if _is_x_search_enabled()
        else {}
    )
    blob = " ".join(_extract_urls_from_x_search(res))

    pairs: list[tuple[str, str]] = []
    seen_sids: set[str] = set()

    for user, sid in _STATUS_URL_RE.findall(blob):
        if user.lower() == handle.lower() or user.lower() == "i":
            continue
        if sid.isdigit() and sid not in seen_sids:
            seen_sids.add(sid)
            pairs.append((user, sid))

    for cm in cached_mentions or []:
        if isinstance(cm, dict):
            sid = str(cm.get("id") or "")
            user = _sanitize_Handle(cm.get("author_username"))
            if user and sid.isdigit() and user.lower() != handle.lower() and sid not in seen_sids:
                seen_sids.add(sid)
                pairs.append((user, sid))

    pairs.sort(key=lambda pair: int(pair[1]), reverse=True)
    target_pairs = pairs[:limit]

    if not target_pairs:
        return list(cached_mentions or [])[:limit]

    mentions_by_id: dict[str, dict[str, Any]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_fetch_single_fx_status, user, sid): (user, sid) for user, sid in target_pairs}
        for fut in concurrent.futures.as_completed(futures):
            user, sid = futures[fut]
            tweet = fut.result()
            if isinstance(tweet, dict):
                norm = _normalize_fx_mention(tweet, user)
                if norm["author_username"].lower() != handle.lower() and norm["id"]:
                    mentions_by_id[norm["id"]] = norm

    for cm in cached_mentions or []:
        cid = str(cm.get("id") or "")
        if cid and cid not in mentions_by_id and any(sid == cid for _, sid in target_pairs):
            mentions_by_id[cid] = cm

    return sorted(
        mentions_by_id.values(),
        key=lambda item: (int(item.get("created_timestamp") or 0), int(str(item.get("id") or "0")) if str(item.get("id") or "").isdigit() else 0),
        reverse=True,
    )[:limit]


# ---------------------------------------------------------------------------
# Optional Live X API v2 Mode (with automatic Free Mode fallback)
# ---------------------------------------------------------------------------


def _run_xurl_v2(path: str, app_name: str | None = None, timeout: int = 20) -> dict[str, Any]:
    xurl_bin, xurl_cli = _resolve_xurl_binary()
    if not xurl_bin:
        return {"ok": False, "error": "xurl CLI binary not found"}
    cmd = [xurl_bin]
    if xurl_cli:
        cmd.append(xurl_cli)
    app = app_name or _get_xurl_auth_info().get("default_app")
    if app and app != "default":
        cmd += ["--app", app]
    cmd.append(path)
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
    except Exception as exc:
        return {"ok": False, "error": f"xurl execution failed: {exc}"}
    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    if proc.returncode != 0:
        return {"ok": False, "error": _scrub_secrets(err or out or f"xurl exit {proc.returncode}")}
    try:
        data = json.loads(out) if out else {}
    except json.JSONDecodeError:
        return {"ok": False, "error": f"non-JSON xurl output: {out[:160]}"}
    if isinstance(data, dict) and (data.get("errors") or data.get("status") in (401, 402, 403, 429)):
        return {"ok": False, "error": _scrub_secrets(data.get("detail") or data.get("title") or data.get("errors"))}
    return {"ok": True, "data": data}


def _request_x_v2(path: str, handle: str | None = None) -> dict[str, Any]:
    """Request an X API v2 endpoint using a Hermes-scoped X_BEARER_TOKEN or xurl CLI."""
    env_vars = _read_env_vars()
    token = env_vars.get("X_BEARER_TOKEN")
    if token:
        headers = {"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}
        try:
            resp = requests.get(f"https://api.x.com{path}", headers=headers, timeout=15)
            if resp.status_code == 200:
                body = resp.json()
                if not body.get("errors"):
                    return {"ok": True, "data": body}
            return {
                "ok": False,
                "status": resp.status_code,
                "error": _scrub_secrets(f"X API v2 HTTP {resp.status_code}: {resp.text[:240]}"),
            }
        except Exception as exc:
            logger.debug("Direct X API v2 call failed, trying xurl: %s", exc)

    return _run_xurl_v2(path)


def _fetch_account_live_v2(handle: str, cached_account: dict[str, Any] | None = None) -> dict[str, Any]:
    conn = _detect_connection(requested_handle=handle)
    xurl_info = _get_xurl_auth_info()
    is_self = handle.lower() in [h.lower() for h in (xurl_info.get("handles") or [])] or not handle
    fields = "public_metrics,verified_followers_count,subscription_type,profile_image_url,profile_banner_url,created_at,description,location,url,verified,verified_type"
    path = f"/2/users/me?user.fields={fields}" if is_self else f"/2/users/by/username/{handle}?user.fields={fields}"

    res = _request_x_v2(path, handle=handle)
    if not res.get("ok"):
        free_acct = _fetch_account_free(handle, cached_account=cached_account)
        free_acct["live_v2_warning"] = f"Live X API v2 unavailable ({res.get('error')}); showing $0.00 Free Mode data."
        free_acct["source_mode"] = "free_fallback"
        free_acct["cost_incurred"] = "$0.00"
        return free_acct

    d = (res.get("data") or {}).get("data") or {}
    pm = d.get("public_metrics") or {}
    fx_acct = _fetch_account_free(d.get("username") or handle, cached_account=cached_account)
    merged = dict(fx_acct) if fx_acct.get("ok") else {}
    created_iso, _ = _parse_created_at_iso(d.get("created_at") or merged.get("created_at"))

    merged.update({
        "ok": True,
        "id": str(d.get("id") or merged.get("id") or ""),
        "username": d.get("username") or merged.get("username") or handle,
        "name": d.get("name") or merged.get("name") or handle,
        "description": d.get("description") if d.get("description") is not None else (merged.get("description") or ""),
        "profile_image_url": _upgrade_avatar_url(d.get("profile_image_url") or merged.get("profile_image_url")),
        "banner_url": d.get("profile_banner_url") or merged.get("banner_url"),
        "location": d.get("location") or merged.get("location") or "",
        "created_at": created_iso,
        "subscription_type": d.get("subscription_type") or merged.get("subscription_type") or "Standard",
        "verified": bool(d.get("verified") or merged.get("verified")),
        "verified_type": d.get("verified_type") or merged.get("verified_type"),
        "followers_count": int(pm.get("followers_count") if pm.get("followers_count") is not None else (merged.get("followers_count") or 0)),
        "following_count": int(pm.get("following_count") if pm.get("following_count") is not None else (merged.get("following_count") or 0)),
        "tweet_count": int(pm.get("tweet_count") if pm.get("tweet_count") is not None else (merged.get("tweet_count") or 0)),
        "listed_count": int(pm.get("listed_count") if pm.get("listed_count") is not None else (merged.get("listed_count") or 0)),
        "media_count": int(pm.get("media_count") if pm.get("media_count") is not None else (merged.get("media_count") or 0)),
        "verified_followers_count": int(d.get("verified_followers_count") or merged.get("verified_followers_count") or 0),
        "verified_followers_cached": False,
        "source_mode": "live_v2",
        "cost_incurred": "~$0.01 (X API v2)",
        "auto_linked": conn.get("auto_linked", True),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    })
    return merged


# ---------------------------------------------------------------------------
# High-level orchestration with TTL cache & per-handle locking
# ---------------------------------------------------------------------------


def _resolve_request_params(
    handle: str | None,
    mode: str | None,
) -> tuple[str, str, dict[str, Any]]:
    conn = _detect_connection(requested_handle=handle, requested_mode=mode)
    resolved_handle = conn["handle"]
    resolved_mode = conn["mode"]
    return resolved_handle, resolved_mode, conn


def _get_or_fetch_account(
    handle: str,
    mode: str = "auto",
    refresh: bool = False,
) -> dict[str, Any]:
    lock = _get_handle_lock(handle)
    with lock:
        snap = _read_json_file(_snapshot_path(handle))
        cached_acct = snap.get("account") if isinstance(snap.get("account"), dict) else None
        age = time.time() - float(snap.get("account_updated_epoch") or snap.get("updated_epoch") or 0.0)

        if not refresh and mode != "live_v2" and cached_acct and cached_acct.get("ok") and age < DEFAULT_TTL_SECONDS:
            out = dict(cached_acct)
            out["cached"] = True
            return out

        if mode == "live_v2":
            acct = _fetch_account_live_v2(handle, cached_account=cached_acct)
        else:
            acct = _fetch_account_free(handle, cached_account=cached_acct)

        if acct.get("ok"):
            _update_snapshot_cache(handle, account=acct, source_mode=str(acct.get("source_mode") or "free"))
            acct["cached"] = False
        return acct


def _get_or_fetch_posts(
    handle: str,
    limit: int = 20,
    mode: str = "auto",
    refresh: bool = False,
) -> dict[str, Any]:
    limit = max(1, min(int(limit or 20), 50))
    lock = _get_handle_lock(handle)
    with lock:
        snap = _read_json_file(_snapshot_path(handle))
        cached_posts = snap.get("posts") if isinstance(snap.get("posts"), list) else None
        cached_acct = snap.get("account") if isinstance(snap.get("account"), dict) else None
        age = time.time() - float(snap.get("posts_updated_epoch") or snap.get("updated_epoch") or 0.0)

        if not refresh and mode != "live_v2" and cached_posts and age < DEFAULT_TTL_SECONDS:
            items = cached_posts[:limit]
            analytics = _compute_posts_analytics(items)
            return {
                "ok": True,
                "handle": handle,
                "count": len(items),
                "items": items,
                "analytics": analytics,
                "source_mode": snap.get("source_mode") or "free",
                "cost_incurred": "$0.00",
                "cached": True,
                "fetched_at": snap.get("updated_at") or datetime.now(timezone.utc).isoformat(),
            }

        live_v2_warning: str | None = None
        source_mode = "free"
        cost_incurred = "$0.00"
        items: list[dict[str, Any]] = []
        freshest_author: dict[str, Any] | None = None

        if mode == "live_v2":
            acct_id = (cached_acct or {}).get("id")
            if not acct_id:
                acct_res = _fetch_account_live_v2(handle, cached_account=cached_acct)
                acct_id = acct_res.get("id")
            path = (
                f"/2/users/{acct_id}/tweets?max_results={max(5, min(limit, 100))}&tweet.fields=created_at,public_metrics,lang,possibly_sensitive&sort_order=recency"
                if acct_id
                else f"/2/users/me/tweets?max_results={max(5, min(limit, 100))}&tweet.fields=created_at,public_metrics,lang,possibly_sensitive&sort_order=recency"
            )
            res = _request_x_v2(path, handle=handle)
            if res.get("ok"):
                source_mode = "live_v2"
                cost_incurred = "~$0.01 (X API v2)"
                for t in (res.get("data") or {}).get("data") or []:
                    pm = t.get("public_metrics") or {}
                    c_iso, c_ts = _parse_created_at_iso(t.get("created_at"))
                    imp = int(pm.get("impression_count") or 0)
                    lk = int(pm.get("like_count") or 0)
                    rp = int(pm.get("retweet_count") or 0)
                    re_cnt = int(pm.get("reply_count") or 0)
                    qt = int(pm.get("quote_count") or 0)
                    bm = int(pm.get("bookmark_count") or 0)
                    tid = str(t.get("id") or "")
                    items.append({
                        "id": tid,
                        "text": str(t.get("text") or ""),
                        "created_at": c_iso,
                        "created_timestamp": c_ts,
                        "lang": t.get("lang") or "en",
                        "impressions": imp,
                        "likes": lk,
                        "reposts": rp,
                        "replies": re_cnt,
                        "quotes": qt,
                        "bookmarks": bm,
                        "engagement_rate": _calc_engagement_rate(imp, lk, rp, re_cnt, qt, bm),
                        "url": f"https://x.com/{handle}/status/{tid}",
                        "media": [],
                    })
            else:
                live_v2_warning = f"Live X API v2 posts unavailable ({res.get('error')}); using $0.00 Free Mode."
                source_mode = "free_fallback"

        if not items:
            items, freshest_author = _fetch_posts_free(handle, limit=limit, cached_posts=cached_posts)

        acct_update = None
        if freshest_author and (not cached_acct or not cached_acct.get("ok")):
            acct_update = _normalize_fx_profile(freshest_author, handle, cached_account=cached_acct)

        updated_snap = _update_snapshot_cache(
            handle,
            account=acct_update,
            posts=items,
            source_mode=source_mode,
        )
        final_items = (updated_snap.get("posts") or items)[:limit]
        analytics = _compute_posts_analytics(final_items)

        out: dict[str, Any] = {
            "ok": True,
            "handle": handle,
            "count": len(final_items),
            "items": final_items,
            "analytics": analytics,
            "source_mode": source_mode,
            "cost_incurred": cost_incurred,
            "cached": False,
            "fetched_at": updated_snap.get("updated_at") or datetime.now(timezone.utc).isoformat(),
        }
        if live_v2_warning:
            out["live_v2_warning"] = live_v2_warning
        return out


def _get_or_fetch_mentions(
    handle: str,
    limit: int = 20,
    mode: str = "auto",
    refresh: bool = False,
) -> dict[str, Any]:
    limit = max(1, min(int(limit or 20), 50))
    lock = _get_handle_lock(handle)
    with lock:
        snap = _read_json_file(_snapshot_path(handle))
        cached_mentions = snap.get("mentions") if isinstance(snap.get("mentions"), list) else None
        cached_acct = snap.get("account") if isinstance(snap.get("account"), dict) else None
        age = time.time() - float(snap.get("mentions_updated_epoch") or snap.get("updated_epoch") or 0.0)

        if not refresh and mode != "live_v2" and cached_mentions is not None and age < DEFAULT_TTL_SECONDS:
            items = cached_mentions[:limit]
            return {
                "ok": True,
                "handle": handle,
                "count": len(items),
                "items": items,
                "source_mode": snap.get("source_mode") or "free",
                "cost_incurred": "$0.00",
                "cached": True,
                "fetched_at": snap.get("updated_at") or datetime.now(timezone.utc).isoformat(),
            }

        live_v2_warning: str | None = None
        source_mode = "free"
        cost_incurred = "$0.00"
        items: list[dict[str, Any]] = []

        if mode == "live_v2":
            acct_id = (cached_acct or {}).get("id")
            if acct_id:
                path = f"/2/users/{acct_id}/mentions?max_results={max(5, min(limit, 100))}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username,name,profile_image_url,public_metrics"
                res = _request_x_v2(path, handle=handle)
                if res.get("ok"):
                    source_mode = "live_v2"
                    cost_incurred = "~$0.01 (X API v2)"
                    users = {
                        u.get("id"): u
                        for u in (((res.get("data") or {}).get("includes") or {}).get("users") or [])
                        if isinstance(u, dict)
                    }
                    for t in (res.get("data") or {}).get("data") or []:
                        pm = t.get("public_metrics") or {}
                        u = users.get(t.get("author_id")) or {}
                        u_pm = u.get("public_metrics") or {}
                        c_iso, c_ts = _parse_created_at_iso(t.get("created_at"))
                        tid = str(t.get("id") or "")
                        uname = u.get("username") or "unknown"
                        imp = int(pm.get("impression_count") or 0)
                        lk = int(pm.get("like_count") or 0)
                        rp = int(pm.get("retweet_count") or 0)
                        re_cnt = int(pm.get("reply_count") or 0)
                        items.append({
                            "id": tid,
                            "text": str(t.get("text") or ""),
                            "created_at": c_iso,
                            "created_timestamp": c_ts,
                            "author_username": uname,
                            "author_name": u.get("name") or uname,
                            "author_avatar": _upgrade_avatar_url(u.get("profile_image_url")),
                            "author_followers": int(u_pm.get("followers_count") or 0),
                            "impressions": imp,
                            "likes": lk,
                            "reposts": rp,
                            "replies": re_cnt,
                            "quotes": int(pm.get("quote_count") or 0),
                            "bookmarks": int(pm.get("bookmark_count") or 0),
                            "engagement_rate": _calc_engagement_rate(imp, lk, rp, re_cnt),
                            "url": f"https://x.com/{uname}/status/{tid}",
                        })
                else:
                    live_v2_warning = f"Live X API v2 mentions unavailable ({res.get('error')}); using $0.00 Free Mode."
                    source_mode = "free_fallback"

        if not items:
            items = _fetch_mentions_free(handle, limit=limit, cached_mentions=cached_mentions)

        updated_snap = _update_snapshot_cache(handle, mentions=items, source_mode=source_mode)
        final_items = (updated_snap.get("mentions") or items)[:limit]

        out: dict[str, Any] = {
            "ok": True,
            "handle": handle,
            "count": len(final_items),
            "items": final_items,
            "source_mode": source_mode,
            "cost_incurred": cost_incurred,
            "cached": False,
            "fetched_at": updated_snap.get("updated_at") or datetime.now(timezone.utc).isoformat(),
        }
        if live_v2_warning:
            out["live_v2_warning"] = live_v2_warning
        return out


# ---------------------------------------------------------------------------
# FastAPI Routes
# ---------------------------------------------------------------------------


@router.get("/health")
def health() -> dict[str, Any]:
    conn = _detect_connection()
    return _scrub_secrets({
        "ok": True,
        "version": "0.1.0",
        "app": conn.get("xurl_app"),
        "user": conn.get("handle"),
        "mode": conn.get("mode"),
        "cost_policy": conn.get("cost_policy"),
    })


@router.get("/status")
def status(handle: str | None = None, mode: str | None = None) -> dict[str, Any]:
    return _detect_connection(requested_handle=handle, requested_mode=mode)


@router.post("/config")
def update_config(body: dict[str, Any] = Body(default_factory=dict)) -> dict[str, Any]:
    saved = _save_dashboard_config(body if isinstance(body, dict) else {})
    conn = _detect_connection(requested_handle=saved.get("handle"), requested_mode=saved.get("default_mode"))
    return _scrub_secrets({
        "ok": True,
        "config": saved,
        "status": conn,
    })


@router.get("/account")
def account(
    handle: str | None = None,
    mode: str = "auto",
    refresh: bool = False,
) -> dict[str, Any]:
    resolved_handle, resolved_mode, conn = _resolve_request_params(handle, mode)
    acct = _get_or_fetch_account(resolved_handle, mode=resolved_mode, refresh=bool(refresh))
    acct["auto_linked"] = conn.get("auto_linked", True)
    acct["goals"] = conn.get("goals") or dict(DEFAULT_GOALS)
    if "cost_incurred" not in acct:
        acct["cost_incurred"] = "$0.00"
    if "source_mode" not in acct:
        acct["source_mode"] = "free"
    return _scrub_secrets(acct)


@router.get("/posts")
def posts(
    limit: int = 20,
    handle: str | None = None,
    mode: str = "auto",
    refresh: bool = False,
) -> dict[str, Any]:
    resolved_handle, resolved_mode, _ = _resolve_request_params(handle, mode)
    res = _get_or_fetch_posts(resolved_handle, limit=limit, mode=resolved_mode, refresh=bool(refresh))
    return _scrub_secrets(res)


@router.get("/mentions")
def mentions(
    limit: int = 20,
    handle: str | None = None,
    mode: str = "auto",
    refresh: bool = False,
) -> dict[str, Any]:
    resolved_handle, resolved_mode, _ = _resolve_request_params(handle, mode)
    res = _get_or_fetch_mentions(resolved_handle, limit=limit, mode=resolved_mode, refresh=bool(refresh))
    return _scrub_secrets(res)


@router.get("/summary")
def summary(
    handle: str | None = None,
    mode: str = "auto",
    refresh: bool = False,
    limit: int = 20,
) -> dict[str, Any]:
    resolved_handle, resolved_mode, conn = _resolve_request_params(handle, mode)
    lock = _get_handle_lock(resolved_handle)

    with lock:
        snap = _read_json_file(_snapshot_path(resolved_handle))
        age = time.time() - float(snap.get("updated_epoch") or 0.0)
        has_complete_cache = (
            isinstance(snap.get("account"), dict)
            and snap["account"].get("ok")
            and isinstance(snap.get("posts"), list)
            and len(snap["posts"]) > 0
            and isinstance(snap.get("mentions"), list)
        )

        if not refresh and resolved_mode != "live_v2" and has_complete_cache and age < DEFAULT_TTL_SECONDS:
            acct_data = dict(snap["account"])
            acct_data["cached"] = True
            acct_data["auto_linked"] = conn.get("auto_linked", True)
            posts_items = list(snap["posts"])[:limit]
            mentions_items = list(snap.get("mentions") or [])[:limit]
            analytics = _compute_posts_analytics(posts_items)
            history = list(snap.get("history") or [])
            fetched_at = snap.get("updated_at") or datetime.now(timezone.utc).isoformat()
            return _scrub_secrets({
                "ok": True,
                "cached": True,
                "handle": resolved_handle,
                "mode": resolved_mode,
                "source_mode": snap.get("source_mode") or "free",
                "cost_incurred": "$0.00",
                "status": conn,
                "account": acct_data,
                "posts": {"ok": True, "count": len(posts_items), "items": posts_items, "analytics": analytics},
                "mentions": {"ok": True, "count": len(mentions_items), "items": mentions_items},
                "analytics": analytics,
                "history": history,
                "goals": conn.get("goals") or dict(DEFAULT_GOALS),
                "posts_count": len(posts_items),
                "mentions_count": len(mentions_items),
                "recent_posts_impressions": analytics.get("total_impressions", 0),
                "verified_impressions_note": (
                    "X API does not expose verified-only impressions; total impressions shown. "
                    "Verified impressions are only in X Premium account analytics."
                ),
                "fetched_at": fetched_at,
            })

    # Fetch fresh data (concurrently in Free Mode for speed)
    if resolved_mode != "live_v2":
        cached_acct = snap.get("account") if isinstance(snap.get("account"), dict) else None
        cached_posts = snap.get("posts") if isinstance(snap.get("posts"), list) else None
        cached_mentions = snap.get("mentions") if isinstance(snap.get("mentions") or [], list) else None

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            f_acct = pool.submit(_fetch_account_free, resolved_handle, cached_acct)
            f_posts = pool.submit(_fetch_posts_free, resolved_handle, limit, cached_posts)
            f_mentions = pool.submit(_fetch_mentions_free, resolved_handle, min(limit, 15), cached_mentions)

            acct_data = f_acct.result()
            posts_items, freshest_author = f_posts.result()
            mentions_items = f_mentions.result()

        if not acct_data.get("ok") and freshest_author:
            acct_data = _normalize_fx_profile(freshest_author, resolved_handle, cached_account=cached_acct)

        updated_snap = _update_snapshot_cache(
            resolved_handle,
            account=acct_data if acct_data.get("ok") else None,
            posts=posts_items,
            mentions=mentions_items,
            source_mode="free",
        )
        final_posts = (updated_snap.get("posts") or posts_items)[:limit]
        final_mentions = (updated_snap.get("mentions") or mentions_items)[:limit]
        analytics = _compute_posts_analytics(final_posts)
        history = list(updated_snap.get("history") or [])
        conn_updated = _detect_connection(requested_handle=resolved_handle, requested_mode=resolved_mode)
        acct_data["auto_linked"] = conn_updated.get("auto_linked", True)

        return _scrub_secrets({
            "ok": True,
            "cached": False,
            "handle": resolved_handle,
            "mode": resolved_mode,
            "source_mode": "free",
            "cost_incurred": "$0.00",
            "status": conn_updated,
            "account": acct_data,
            "posts": {"ok": True, "count": len(final_posts), "items": final_posts, "analytics": analytics},
            "mentions": {"ok": True, "count": len(final_mentions), "items": final_mentions},
            "analytics": analytics,
            "history": history,
            "goals": conn_updated.get("goals") or dict(DEFAULT_GOALS),
            "posts_count": len(final_posts),
            "mentions_count": len(final_mentions),
            "recent_posts_impressions": analytics.get("total_impressions", 0),
            "verified_impressions_note": (
                "X API does not expose verified-only impressions; total impressions shown. "
                "Verified impressions are only in X Premium account analytics."
            ),
            "fetched_at": updated_snap.get("updated_at") or datetime.now(timezone.utc).isoformat(),
        })

    # Live v2 mode (with automatic Free Mode fallback inside helpers)
    acct_res = _get_or_fetch_account(resolved_handle, mode="live_v2", refresh=True)
    posts_res = _get_or_fetch_posts(resolved_handle, limit=limit, mode="live_v2", refresh=True)
    mentions_res = _get_or_fetch_mentions(resolved_handle, limit=min(limit, 15), mode="live_v2", refresh=True)
    updated_snap = _read_json_file(_snapshot_path(resolved_handle))
    conn_updated = _detect_connection(requested_handle=resolved_handle, requested_mode=resolved_mode)
    analytics = posts_res.get("analytics") or _compute_posts_analytics(posts_res.get("items") or [])
    warning = acct_res.get("live_v2_warning") or posts_res.get("live_v2_warning") or mentions_res.get("live_v2_warning")

    return _scrub_secrets({
        "ok": True,
        "cached": False,
        "handle": resolved_handle,
        "mode": resolved_mode,
        "source_mode": acct_res.get("source_mode") or "live_v2",
        "cost_incurred": acct_res.get("cost_incurred") or "$0.00",
        "live_v2_warning": warning,
        "status": conn_updated,
        "account": acct_res,
        "posts": {
            "ok": True,
            "count": posts_res.get("count", 0),
            "items": posts_res.get("items", []),
            "analytics": analytics,
        },
        "mentions": {
            "ok": True,
            "count": mentions_res.get("count", 0),
            "items": mentions_res.get("items", []),
        },
        "analytics": analytics,
        "history": list(updated_snap.get("history") or []),
        "goals": conn_updated.get("goals") or dict(DEFAULT_GOALS),
        "posts_count": posts_res.get("count", 0),
        "mentions_count": mentions_res.get("count", 0),
        "recent_posts_impressions": analytics.get("total_impressions", 0),
        "verified_impressions_note": (
            "X API does not expose verified-only impressions; total impressions shown. "
            "Verified impressions are only in X Premium account analytics."
        ),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    })

