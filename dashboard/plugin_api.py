"""FastAPI router for the x-dashboard Hermes dashboard plugin.

Read-only X analytics for @omx0r via the local `xurl` CLI (OAuth 2.0,
tokens stay in ~/.xurl). No writes, DMs, follows, likes or deletes.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter

router = APIRouter()

def _resolve_xurl() -> tuple[str, str | None]:
    env = os.environ.get("XURL_BIN")
    if env:
        return env, None
    found = shutil.which("xurl")
    if found and not found.lower().endswith(".cmd"):
        return found, None
    node = shutil.which("node")
    cli = Path("C:/Users/q2p/AppData/Local/hermes/tools/node-26.7.0-win32-x64/node_modules/@xdevplatform/xurl/cli.js")
    if node and cli.exists():
        return node, str(cli)
    candidate = Path("C:/Users/q2p/AppData/Local/hermes/tools/node-26.7.0-win32-x64/xurl")
    if candidate.exists():
        return str(candidate), None
    return "xurl", None

XURL, XURL_CLI = _resolve_xurl()
APP = os.environ.get("X_ANALYTICS_APP", "omx0r-xurl")
USER = os.environ.get("X_ANALYTICS_USER", "omx0r")

_cache: dict[str, Any] = {}
_cache_lock = threading.Lock()


def _run_xurl(path: str, timeout: int = 30) -> dict:
    """Run xurl against a raw X API v2 path. Returns parsed JSON or {ok:false}."""
    cmd = [XURL]
    if XURL_CLI:
        cmd.append(XURL_CLI)
    cmd += ["--app", APP, path]
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, check=False
        )
    except FileNotFoundError:
        return {"ok": False, "error": "xurl not found on PATH"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "xurl timed out"}
    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    if proc.returncode != 0:
        return {"ok": False, "error": err or out or f"xurl exit {proc.returncode}"}
    try:
        data = json.loads(out) if out else {}
    except json.JSONDecodeError:
        return {"ok": False, "error": f"non-JSON xurl output: {out[:200]}"}
    if isinstance(data, dict) and data.get("errors"):
        return {"ok": False, "error": data["errors"]}
    return {"ok": True, "data": data}


def _account_id() -> str | None:
    with _cache_lock:
        v = _cache.get("account_id")
    if v:
        return v
    res = _run_xurl("/2/users/me?user.fields=public_metrics,verified_followers_count,subscription_type,profile_image_url,created_at,description")
    if not res["ok"]:
        return None
    uid = (res["data"].get("data") or {}).get("id")
    if uid:
        with _cache_lock:
            _cache["account_id"] = uid
            _cache["account_raw"] = res["data"].get("data")
    return uid


@router.get("/health")
def health() -> dict:
    return {"ok": True, "app": APP, "user": USER}


@router.get("/account")
def account() -> dict:
    res = _run_xurl("/2/users/me?user.fields=public_metrics,verified_followers_count,subscription_type,profile_image_url,created_at,description")
    if not res["ok"]:
        return {"ok": False, "error": res["error"]}
    d = res["data"].get("data") or {}
    pm = d.get("public_metrics") or {}
    with _cache_lock:
        _cache["account_id"] = d.get("id")
        _cache["account_raw"] = d
    return {
        "ok": True,
        "id": d.get("id"),
        "username": d.get("username"),
        "name": d.get("name"),
        "description": d.get("description"),
        "profile_image_url": d.get("profile_image_url"),
        "created_at": d.get("created_at"),
        "subscription_type": d.get("subscription_type"),
        "verified": d.get("verified"),
        "verified_type": d.get("verified_type"),
        "followers_count": pm.get("followers_count"),
        "following_count": pm.get("following_count"),
        "tweet_count": pm.get("tweet_count"),
        "listed_count": pm.get("listed_count"),
        "media_count": pm.get("media_count"),
        "verified_followers_count": d.get("verified_followers_count"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/posts")
def posts(limit: int = 20) -> dict:
    limit = max(1, min(int(limit or 20), 100))
    uid = _account_id()
    if not uid:
        # fall back to /2/users/me/tweets (some tokens support "me")
        path = f"/2/users/me/tweets?max_results={limit}&tweet.fields=created_at,public_metrics,lang,possibly_sensitive&sort_order=recency"
    else:
        path = f"/2/users/{uid}/tweets?max_results={limit}&tweet.fields=created_at,public_metrics,lang,possibly_sensitive&sort_order=recency"
    res = _run_xurl(path)
    if not res["ok"]:
        return {"ok": False, "error": res["error"]}
    items = []
    for t in (res["data"].get("data") or []):
        pm = t.get("public_metrics") or {}
        items.append({
            "id": t.get("id"),
            "text": t.get("text"),
            "created_at": t.get("created_at"),
            "lang": t.get("lang"),
            "impressions": pm.get("impression_count"),
            "likes": pm.get("like_count"),
            "reposts": pm.get("retweet_count"),
            "replies": pm.get("reply_count"),
            "quotes": pm.get("quote_count"),
            "bookmarks": pm.get("bookmark_count"),
        })
    return {"ok": True, "count": len(items), "items": items, "fetched_at": datetime.now(timezone.utc).isoformat()}


@router.get("/mentions")
def mentions(limit: int = 20) -> dict:
    limit = max(1, min(int(limit or 20), 100))
    uid = _account_id()
    if not uid:
        return {"ok": False, "error": "could not resolve account id"}
    path = f"/2/users/{uid}/mentions?max_results={limit}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username,name,profile_image_url"
    res = _run_xurl(path)
    if not res["ok"]:
        return {"ok": False, "error": res["error"]}
    users = {u.get("id"): u for u in ((res["data"].get("includes") or {}).get("users") or [])}
    items = []
    for t in (res["data"].get("data") or []):
        pm = t.get("public_metrics") or {}
        u = users.get(t.get("author_id")) or {}
        items.append({
            "id": t.get("id"),
            "text": t.get("text"),
            "created_at": t.get("created_at"),
            "author_username": u.get("username"),
            "author_name": u.get("name"),
            "impressions": pm.get("impression_count"),
            "likes": pm.get("like_count"),
            "reposts": pm.get("retweet_count"),
            "replies": pm.get("reply_count"),
        })
    return {"ok": True, "count": len(items), "items": items, "fetched_at": datetime.now(timezone.utc).isoformat()}


@router.get("/summary")
def summary() -> dict:
    acct = account()
    ps = posts(20)
    ms = mentions(10)
    total_impressions = 0
    if ps.get("ok"):
        for p in ps.get("items", []):
            total_impressions += int(p.get("impressions") or 0)
    return {
        "ok": True,
        "account": acct if acct.get("ok") else {"ok": False, "error": acct.get("error")},
        "posts_count": (ps.get("count") if ps.get("ok") else 0),
        "mentions_count": (ms.get("count") if ms.get("ok") else 0),
        "recent_posts_impressions": total_impressions,
        "verified_impressions_note": "X API does not expose verified-only impressions; total impressions shown. Verified impressions are only in X Premium account analytics.",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
