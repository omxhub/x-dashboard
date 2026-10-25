"""Unit & integration tests for C:\\Dev\\x-dashboard\\dashboard\\plugin_api.py."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import MagicMock, patch

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "dashboard"))

# Provide lightweight standalone shims when running outside the Hermes runtime (e.g. GitHub Actions CI)
try:
    import agent.secret_scope  # noqa: F401
except ModuleNotFoundError:
    agent_mod = types.ModuleType("agent")
    secret_scope_mod = types.ModuleType("agent.secret_scope")
    secret_scope_mod.get_secret = lambda name, default=None: os.environ.get(name, default)  # type: ignore[attr-defined]
    agent_mod.secret_scope = secret_scope_mod  # type: ignore[attr-defined]
    sys.modules["agent"] = agent_mod
    sys.modules["agent.secret_scope"] = secret_scope_mod

try:
    import plugins.plugin_storage  # noqa: F401
except ModuleNotFoundError:
    plugins_mod = types.ModuleType("plugins")
    plugin_storage_mod = types.ModuleType("plugins.plugin_storage")

    def _stub_plugin_data_dir(plugin_name: str) -> Path:
        base = Path(os.environ.get("HERMES_HOME") or (Path.home() / ".hermes"))
        d = base / "plugin-data" / plugin_name
        d.mkdir(parents=True, exist_ok=True)
        return d

    plugin_storage_mod.plugin_data_dir = _stub_plugin_data_dir  # type: ignore[attr-defined]
    plugins_mod.plugin_storage = plugin_storage_mod  # type: ignore[attr-defined]
    sys.modules["plugins"] = plugins_mod
    sys.modules["plugins.plugin_storage"] = plugin_storage_mod

import plugin_api  # noqa: E402


SAMPLE_XURL_STATUS = """\
  default  [(no credentials)]
      redirect_uri: http://localhost:8080/callback  [built-in default]
      oauth2: (none)
      oauth1: –
      bearer: –

▸ omx0r-xurl  [client_id: super_secret_client_id]
      redirect_uri: http://localhost:8080/callback  [built-in default]
    ▸ oauth2: omx0r
      oauth1: –
      bearer: ✓
"""

SAMPLE_FX_PROFILE = {
    "code": 200,
    "message": "OK",
    "user": {
        "screen_name": "omx0r",
        "id": "146497881",
        "name": "Omar 🪽",
        "description": "Airport worker running AI agents that build my products.",
        "followers": 690,
        "following": 425,
        "tweets": 2225,
        "likes": 2755,
        "media_count": 478,
        "location": "Madinah",
        "banner_url": "https://pbs.twimg.com/profile_banners/146497881/1790292770",
        "avatar_url": "https://pbs.twimg.com/profile_images/2108594027209576448/Pq0merQq_normal.jpg",
        "joined": "Fri May 21 15:45:12 +0000 2010",
        "website": {"url": "http://omxhub.com", "display_url": "omxhub.com"},
        "verification": {"verified": True, "type": "BLUE"},
    },
}

SAMPLE_FX_TWEET = {
    "code": 200,
    "message": "OK",
    "tweet": {
        "id": "2113318190021214360",
        "url": "https://x.com/omx0r/status/2113318190021214360",
        "text": "My AI bots have more friends than me 😅 #HermesAgent @NousResearch",
        "created_at": "Thu Oct 22 17:14:54 +0000 2026",
        "created_timestamp": 1792689294,
        "views": 400,
        "likes": 12,
        "retweets": 3,
        "replies": 4,
        "quotes": 1,
        "bookmarks": 5,
        "lang": "en",
        "author": {
            "screen_name": "omx0r",
            "name": "Omar 🪽",
            "followers": 690,
        },
        "media": {
            "all": [
                {
                    "type": "photo",
                    "url": "https://pbs.twimg.com/media/sample.jpg",
                }
            ]
        },
    },
}

SAMPLE_FX_MENTION = {
    "code": 200,
    "message": "OK",
    "tweet": {
        "id": "2113790708091851007",
        "url": "https://x.com/OscarElevenFit/status/2113790708091851007",
        "text": "@omx0r Hahaha what could be more gamer than dying in a souls game",
        "created_at": "Sat Oct 24 00:32:00 +0000 2026",
        "created_timestamp": 1792801920,
        "views": 25,
        "likes": 2,
        "retweets": 0,
        "replies": 1,
        "quotes": 0,
        "bookmarks": 0,
        "author": {
            "screen_name": "OscarElevenFit",
            "name": "Oscar",
            "followers": 1240,
            "avatar_url": "https://pbs.twimg.com/profile_images/123/avatar_normal.jpg",
        },
    },
}


class PluginApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.hermes_home = Path(self.temp_dir.name)
        self.env_patcher = patch.dict(
            os.environ,
            {
                "HERMES_HOME": str(self.hermes_home),
                "X_BEARER_TOKEN": "secret_bearer_token_value_123",
            },
            clear=False,
        )
        self.env_patcher.start()
        plugin_api._xurl_status_cache["ts"] = 0.0
        plugin_api._xurl_status_cache["data"] = None
        plugin_api._x_search_cooldown_until = 0.0

    def tearDown(self) -> None:
        self.env_patcher.stop()
        self.temp_dir.cleanup()

    def test_parse_xurl_auth_status(self) -> None:
        parsed = plugin_api._parse_xurl_auth_status(SAMPLE_XURL_STATUS)
        self.assertEqual(parsed["primary_handle"], "omx0r")
        self.assertEqual(parsed["default_app"], "omx0r-xurl")
        self.assertIn("omx0r", parsed["handles"])
        self.assertTrue(parsed["has_bearer"])

    def test_scrub_secrets_removes_sensitive_fields_and_bearers(self) -> None:
        dirty = {
            "ok": True,
            "access_token": "tok_123",
            "refresh_token": "ref_456",
            "client_secret": "sec_789",
            "nested": {
                "xchat_access_token": "tok_nested",
                "message": "Header had Bearer secret_jwt_token_here in it",
            },
        }
        clean = plugin_api._scrub_secrets(dirty)
        self.assertNotIn("access_token", clean)
        self.assertNotIn("refresh_token", clean)
        self.assertNotIn("client_secret", clean)
        self.assertNotIn("xchat_access_token", clean["nested"])
        self.assertIn("Bearer [REDACTED]", clean["nested"]["message"])
        self.assertNotIn("secret_jwt_token_here", json.dumps(clean))

    @patch.object(plugin_api, "_get_xurl_auth_info")
    @patch.object(plugin_api, "_check_x_search_available", return_value=True)
    def test_detect_connection_auto_links_hermes_accounts_without_leaking_secrets(
        self, _mock_xsearch: MagicMock, mock_xurl: MagicMock
    ) -> None:
        mock_xurl.return_value = {
            "available": True,
            "apps": [{"name": "omx0r-xurl", "is_default": True, "oauth2_handle": "omx0r"}],
            "default_app": "omx0r-xurl",
            "handles": ["omx0r"],
            "primary_handle": "omx0r",
            "has_bearer": False,
        }
        status = plugin_api.status()
        self.assertTrue(status["ok"])
        self.assertTrue(status["connected"])
        self.assertTrue(status["auto_linked"])
        self.assertEqual(status["handle"], "omx0r")
        self.assertEqual(status["active_source"], "xurl")
        self.assertEqual(status["cost_policy"], "zero_cost_free_default")
        self.assertFalse(status["x_search_enabled"])

        serialized = json.dumps(status)
        self.assertNotIn("secret_bearer_token_value_123", serialized)

    @patch.object(plugin_api, "_get_xurl_auth_info")
    def test_config_persistence_and_goal_updates(self, mock_xurl: MagicMock) -> None:
        mock_xurl.return_value = {
            "available": True,
            "apps": [],
            "default_app": None,
            "handles": ["omx0r"],
            "primary_handle": "omx0r",
            "has_bearer": False,
        }
        res = plugin_api.update_config(
            {
                "handle": "@NousResearch",
                "mode": "free",
                "enable_x_search": True,
                "goals": {"verified_followers": 1000, "impressions": 1000000},
            }
        )
        self.assertTrue(res["ok"])
        self.assertEqual(res["config"]["handle"], "NousResearch")
        self.assertEqual(res["config"]["default_mode"], "free")
        self.assertTrue(res["config"]["enable_x_search"])
        self.assertEqual(res["config"]["goals"]["verified_followers"], 1000)
        self.assertEqual(res["config"]["goals"]["impressions"], 1000000)

    @patch.object(plugin_api.requests, "get")
    @patch.object(plugin_api, "_check_x_search_available", return_value=True)
    @patch.object(plugin_api, "_run_x_search_query")
    @patch.object(plugin_api, "_get_xurl_auth_info")
    def test_summary_free_mode_normalization_and_snapshot_history(
        self,
        mock_xurl: MagicMock,
        mock_xsearch: MagicMock,
        _mock_xsearch_avail: MagicMock,
        mock_requests_get: MagicMock,
    ) -> None:
        mock_xurl.return_value = {
            "available": True,
            "apps": [{"name": "omx0r-xurl", "is_default": True, "oauth2_handle": "omx0r"}],
            "default_app": "omx0r-xurl",
            "handles": ["omx0r"],
            "primary_handle": "omx0r",
            "has_bearer": False,
        }
        def fake_xsearch(query: str, **_kwargs):
            if "mentioning" in query:
                return {
                    "inline_citations": [{"url": "https://x.com/OscarElevenFit/status/2113790708091851007"}],
                    "answer": "",
                }
            return {
                "inline_citations": [{"url": "https://x.com/omx0r/status/2113318190021214360"}],
                "answer": "",
            }

        mock_xsearch.side_effect = fake_xsearch

        def fake_get(url: str, **_kwargs):
            resp = MagicMock()
            resp.status_code = 200
            if url == "https://api.fxtwitter.com/omx0r":
                resp.json.return_value = SAMPLE_FX_PROFILE
            elif "r.jina.ai" in url:
                resp.text = "https://x.com/omx0r/status/2113318190021214360"
            elif "2113318190021214360" in url:
                resp.json.return_value = SAMPLE_FX_TWEET
            elif "2113790708091851007" in url:
                resp.json.return_value = SAMPLE_FX_MENTION
            else:
                resp.status_code = 404
                resp.json.return_value = {}
            return resp

        mock_requests_get.side_effect = fake_get

        # By default enable_x_search is False so paid x_search is not invoked
        default_summary = plugin_api.summary(handle="omx0r", mode="free", refresh=True)
        self.assertTrue(default_summary["ok"])
        mock_xsearch.assert_not_called()

        # Opting in via enable_x_search=True enables x_search enrichment
        plugin_api.update_config({"enable_x_search": True})
        summary = plugin_api.summary(handle="omx0r", mode="free", refresh=True)
        self.assertTrue(summary["ok"])
        self.assertEqual(summary["cost_incurred"], "$0.00")
        self.assertEqual(summary["account"]["username"], "omx0r")
        self.assertEqual(summary["account"]["followers_count"], 690)
        self.assertTrue(summary["account"]["profile_image_url"].endswith("_400x400.jpg"))
        self.assertEqual(summary["posts"]["count"], 1)
        self.assertEqual(summary["posts"]["items"][0]["impressions"], 400)
        self.assertEqual(summary["posts"]["items"][0]["engagement_rate"], 6.25)
        self.assertEqual(summary["mentions"]["count"], 1)
        self.assertEqual(summary["mentions"]["items"][0]["author_username"], "OscarElevenFit")
        self.assertEqual(summary["analytics"]["total_impressions"], 400)
        self.assertEqual(len(summary["history"]), 1)

        # Second call without refresh should hit the fast TTL snapshot cache
        cached_summary = plugin_api.summary(handle="omx0r", mode="auto", refresh=False)
        self.assertTrue(cached_summary["cached"])
        self.assertEqual(cached_summary["account"]["followers_count"], 690)

    @patch.object(plugin_api, "_request_x_v2")
    @patch.object(plugin_api, "_fetch_account_free")
    def test_live_v2_falls_back_gracefully_on_402_credits_depleted(
        self, mock_free_acct: MagicMock, mock_v2: MagicMock
    ) -> None:
        mock_v2.return_value = {
            "ok": False,
            "status": 402,
            "error": "X API v2 HTTP 402: CreditsDepleted",
        }
        mock_free_acct.return_value = {
            "ok": True,
            "username": "omx0r",
            "followers_count": 690,
            "source_mode": "free",
            "cost_incurred": "$0.00",
        }
        acct = plugin_api._fetch_account_live_v2("omx0r")
        self.assertTrue(acct["ok"])
        self.assertEqual(acct["source_mode"], "free_fallback")
        self.assertEqual(acct["cost_incurred"], "$0.00")
        self.assertIn("402", acct["live_v2_warning"])

    def test_normalize_external_url_upgrades_domains_and_rejects_unsafe_schemes(self) -> None:
        self.assertEqual(
            plugin_api._normalize_external_url({"display_url": "omxhub.com", "url": "https://omxhub.com"}),
            "https://omxhub.com",
        )
        self.assertEqual(
            plugin_api._normalize_external_url({"display_url": "omxhub.com"}),
            "https://omxhub.com",
        )
        self.assertIsNone(plugin_api._normalize_external_url("javascript:alert(1)"))
        self.assertIsNone(plugin_api._normalize_external_url("data:text/html,hi"))


if __name__ == "__main__":
    unittest.main()
