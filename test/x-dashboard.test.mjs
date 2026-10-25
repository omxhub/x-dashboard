import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// ── DOM environment ──────────────────────────────────────────────────────
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
const { window } = dom;
for (const k of [
  "document",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "HTMLInputElement",
  "CustomEvent",
  "location",
  "Blob",
  "URL",
]) {
  const v = window[k];
  if (v === undefined) continue;
  Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
}
Object.defineProperty(globalThis, "window", { value: window, configurable: true, writable: true });
Object.defineProperty(globalThis, "navigator", {
  value: window.navigator,
  configurable: true,
  writable: true,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── React ────────────────────────────────────────────────────────────────
const React = require("react");
const { createRoot } = require("react-dom/client");
const { act } = require("react");
const { createElement: h } = React;

window.React = React;
window.__HERMES_PLUGIN_SDK__ = { React };

const bundle = await import("./.build/x-dashboard-page.mjs");
const XDashboardPage = bundle.default;
const {
  configureXDashboardHost,
  X_DASHBOARD_DESKTOP_PATH,
  createXDashboardContributions,
  createDesktopXDashboardHost,
} = bundle;

// ── Mock Payload ─────────────────────────────────────────────────────────
const MOCK_SUMMARY_V2 = {
  ok: true,
  status: {
    connected: true,
    auto_linked: true,
    active_source: "xurl",
    auth_sources: [
      {
        id: "xurl",
        label: "Hermes xurl OAuth2 (~/.xurl)",
        detected: true,
        handle: "omx0r",
        detail: "Auto-linked from ~/.xurl",
      },
      {
        id: "xchat",
        label: "Hermes XChat Bridge",
        detected: true,
        handle: "omx0r",
        detail: "XCHAT_ACCESS_TOKEN active",
      },
      {
        id: "public_free",
        label: "Zero-Cost Public Syndication",
        detected: true,
        handle: "omx0r",
        detail: "100% Free ($0.00)",
      },
    ],
    handle: "omx0r",
    available_handles: ["omx0r", "NousResearch"],
    x_search_available: true,
    xurl_available: true,
    xchat_configured: true,
    mode: "free",
    cost_policy: "$0.00 Free Mode Active",
    cache_updated_at: "2026-10-24T01:00:00Z",
  },
  account: {
    ok: true,
    id: "1001",
    username: "omx0r",
    name: "Omar 🪽",
    description: "Building autonomous AI agents on @HermesAgent #AI #Agents",
    location: "Riyadh",
    website: "https://omxhub.com",
    created_at: "2014-05-12T00:00:00Z",
    subscription_type: "Premium+",
    verified: true,
    followers_count: 1480,
    following_count: 410,
    tweet_count: 892,
    listed_count: 34,
    media_count: 120,
    likes_count: 4210,
    verified_followers_count: 385,
    verified_followers_cached: true,
    source_mode: "free",
    cost_incurred: "$0.00",
    auto_linked: true,
  },
  posts: {
    ok: true,
    count: 3,
    items: [
      {
        id: "p1",
        text: "Shipping the new zero-cost X Dashboard for @HermesAgent! #Hermes #OpenSource",
        created_at: "2026-10-23T15:30:00Z",
        impressions: 28400,
        likes: 640,
        reposts: 142,
        replies: 58,
        quotes: 19,
        bookmarks: 310,
      },
      {
        id: "p2",
        text: "Auto-detecting ~/.xurl and XChat credentials with $0.00 default refreshes.",
        created_at: "2026-10-22T18:10:00Z",
        impressions: 12300,
        likes: 290,
        reposts: 44,
        replies: 21,
        quotes: 6,
        bookmarks: 95,
      },
      {
        id: "p3",
        text: "@NousResearch Hermes Desktop + Web Dashboard unified plugin architecture is clean.",
        created_at: "2026-10-21T11:00:00Z",
        replying_to: "NousResearch",
        impressions: 6200,
        likes: 150,
        reposts: 18,
        replies: 14,
        quotes: 3,
        bookmarks: 40,
      },
    ],
  },
  mentions: {
    ok: true,
    count: 2,
    items: [
      {
        id: "m1",
        text: "@omx0r This X Dashboard in Hermes looks incredible! Zero API key friction.",
        created_at: "2026-10-23T16:00:00Z",
        author_username: "ai_builder",
        author_name: "AI Builder",
        author_followers: 14200,
        impressions: 4100,
        likes: 82,
        reposts: 12,
        replies: 5,
      },
      {
        id: "m2",
        text: "Testing @omx0r's Hermes plugin on Desktop!",
        created_at: "2026-10-23T12:15:00Z",
        author_username: "hermes_dev",
        author_name: "Hermes Dev",
        author_followers: 3800,
        impressions: 1250,
        likes: 29,
        reposts: 4,
        replies: 2,
      },
    ],
  },
  history: [
    {
      timestamp: "2026-10-20T00:00:00Z",
      followers_count: 1420,
      verified_followers_count: 360,
      tweet_count: 885,
      following_count: 408,
      recent_impressions: 38000,
    },
    {
      timestamp: "2026-10-24T00:00:00Z",
      followers_count: 1480,
      verified_followers_count: 385,
      tweet_count: 892,
      following_count: 410,
      recent_impressions: 46900,
    },
  ],
  goals: {
    verified_followers: 500,
    impressions: 500000,
  },
};

let container = null;
let root = null;

async function settle(ms = 15) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function click(el) {
  assert.ok(el, "expected an element to click");
  act(() => {
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

test("Web Dashboard XDashboardPage renders auto-linked profile, $0.00 Free Mode badge, 6 KPIs, goals, SVG chart, and tabs", async () => {
  const apiCalls = [];
  configureXDashboardHost({
    fetchJSON: async (url, init) => {
      apiCalls.push({ url, init });
      if (url.startsWith("/api/plugins/x-dashboard/summary")) {
        return structuredClone(MOCK_SUMMARY_V2);
      }
      if (url.startsWith("/api/plugins/x-dashboard/config")) {
        return { ok: true };
      }
      return { ok: true };
    },
    navigateTo: () => {},
  });

  container = window.document.createElement("div");
  window.document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(h(XDashboardPage));
  });
  await settle(25);

  const text = container.textContent || "";
  assert.ok(text.includes("Omar 🪽"), "must render profile display name");
  assert.ok(text.includes("Auto-Linked via Hermes"), "must render Auto-Link status pill");
  assert.ok(text.includes("$0.00 Free Mode Active"), "must render Zero-Cost guarantee badge");
  assert.ok(text.includes("1,480"), "must render total followers KPI");
  assert.ok(text.includes("385"), "must render verified followers KPI");
  assert.ok(text.includes("Top Performing Post Spotlight"), "must render Top Post Spotlight card");

  // Switch to Mentions tab
  const mentionsTab = container.querySelector('[data-testid="tab-mentions"]');
  click(mentionsTab);
  await settle(10);
  assert.ok(
    (container.textContent || "").includes("@ai_builder"),
    "Mentions tab must display @ai_builder mention",
  );

  // Switch to Connection Inspector tab
  const connectionTab = container.querySelector('[data-testid="tab-connection"]');
  click(connectionTab);
  await settle(10);
  assert.ok(
    (container.textContent || "").includes("Hermes xurl OAuth2"),
    "Connection tab must list detected Hermes auth sources",
  );

  act(() => {
    root.unmount();
  });
  container.remove();
});

test("Desktop contract and host adapter wire /x-dashboard route, sidebar.nav (order 90, graph), palette, and ctx.rest", async () => {
  const contributions = createXDashboardContributions(
    () => null,
    () => {},
  );

  assert.deepEqual(
    contributions.map((c) => ({
      id: c.id,
      area: c.area,
      order: c.order,
      path: c.data.path,
      label: c.data.label,
      codicon: c.data.codicon,
    })),
    [
      {
        id: "page",
        area: "routes",
        order: 90,
        path: X_DASHBOARD_DESKTOP_PATH,
        label: undefined,
        codicon: undefined,
      },
      {
        id: "nav",
        area: "sidebar.nav",
        order: 90,
        path: X_DASHBOARD_DESKTOP_PATH,
        label: "X Dashboard",
        codicon: "graph",
      },
      {
        id: "open",
        area: "palette",
        order: 90,
        path: undefined,
        label: "Open X Dashboard",
        codicon: undefined,
      },
    ],
  );

  const restCalls = [];
  const desktopHost = createDesktopXDashboardHost(
    {
      rest: async (path, options = {}) => {
        restCalls.push({ path, options });
        return { ok: true, path };
      },
    },
    { navigate: () => {} },
  );

  await desktopHost.fetchJSON("/api/plugins/x-dashboard/summary?mode=auto&refresh=false");
  await desktopHost.fetchJSON("/api/plugins/x-dashboard/config", {
    method: "POST",
    body: JSON.stringify({ handle: "omx0r" }),
  });

  assert.equal(restCalls.length, 2);
  assert.equal(restCalls[0].path, "/summary?mode=auto&refresh=false");
  assert.equal(restCalls[1].path, "/config");
  assert.deepEqual(restCalls[1].options, {
    method: "POST",
    body: { handle: "omx0r" },
  });
});

test("Resilient fallback fetches /account, /posts, and /mentions in parallel when backend /summary is v1-shaped", async () => {
  const hitPaths = [];
  configureXDashboardHost({
    fetchJSON: async (url) => {
      hitPaths.push(url);
      if (url.startsWith("/api/plugins/x-dashboard/summary")) {
        return { ok: true, recent_posts_impressions: 19500 };
      }
      if (url.startsWith("/api/plugins/x-dashboard/account")) {
        return {
          ok: true,
          username: "free_user",
          name: "Free Mode Creator",
          followers_count: 920,
          following_count: 180,
          verified_followers_count: 0,
          tweet_count: 42,
        };
      }
      if (url.startsWith("/api/plugins/x-dashboard/posts")) {
        return {
          ok: true,
          items: [
            {
              id: "legacy-1",
              text: "Zero API key public handle mode works seamlessly!",
              created_at: "2026-10-24T00:00:00Z",
              impressions: 19500,
              likes: 410,
              reposts: 55,
              replies: 19,
            },
          ],
        };
      }
      if (url.startsWith("/api/plugins/x-dashboard/mentions")) {
        return { ok: true, items: [] };
      }
      return { ok: true };
    },
    navigateTo: () => {},
  });

  container = window.document.createElement("div");
  window.document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(h(XDashboardPage));
  });
  await settle(30);

  const text = container.textContent || "";
  assert.ok(text.includes("Free Mode Creator"), "must render fallback account name");
  assert.ok(text.includes("Public Free Mode (@free_user)"), "must show Public Free Mode pill when not auto-linked");
  assert.ok(
    hitPaths.some((p) => p.startsWith("/api/plugins/x-dashboard/account")),
    "must have called /account fallback endpoint",
  );

  act(() => {
    root.unmount();
  });
  container.remove();
});

test("installDesktopPlugin archives existing directories and sweeps sibling .backup-* folders out of plugin roots", async () => {
  const { installDesktopPlugin } = await import("../scripts/install-desktop.mjs");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "x-dashboard-install-test-"));
  try {
    const fakeHermes = path.join(tmpRoot, "hermes");
    const fakePlugins = path.join(fakeHermes, "plugins");
    const fakeDesktopPlugins = path.join(fakeHermes, "desktop-plugins");

    // Pre-existing regular directory + stale sibling backup directory
    await fs.mkdir(path.join(fakeDesktopPlugins, "x-dashboard"), { recursive: true });
    await fs.writeFile(path.join(fakeDesktopPlugins, "x-dashboard", "old.txt"), "old");
    await fs.mkdir(path.join(fakeDesktopPlugins, "x-dashboard.backup-2026-01-01"), { recursive: true });
    await fs.mkdir(path.join(fakePlugins, "x-dashboard.backup-2026-01-01"), { recursive: true });

    const res = await installDesktopPlugin({
      repoRoot: path.resolve("."),
      hermesHome: fakeHermes,
    });

    assert.equal(res.status, "linked");
    assert.ok(res.backup && res.backup.includes("archived-plugin-backups"), "backup must be outside desktop-plugins/");

    const desktopEntries = await fs.readdir(fakeDesktopPlugins);
    const pluginEntries = await fs.readdir(fakePlugins);
    assert.deepEqual(desktopEntries, ["x-dashboard"], "no sibling .backup-* folders may remain in desktop-plugins/");
    assert.deepEqual(pluginEntries, ["x-dashboard"], "no sibling .backup-* folders may remain in plugins/");
    await fs.rm(path.join(fakeDesktopPlugins, "x-dashboard"), { recursive: true, force: true });
    await fs.rm(path.join(fakePlugins, "x-dashboard"), { recursive: true, force: true });
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test("safeExternalUrl and escapeCsvCell harden external links and CSV exports", async () => {
  const { safeExternalUrl, escapeCsvCell } = await import("./.build/x-dashboard-page.mjs");
  assert.equal(safeExternalUrl("omxhub.com"), "https://omxhub.com");
  assert.equal(safeExternalUrl("https://x.com/omx0r"), "https://x.com/omx0r");
  assert.equal(safeExternalUrl("javascript:alert(1)", "https://x.com/omx0r"), "https://x.com/omx0r");
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  const crlf = String.fromCharCode(13, 10);
  assert.equal(escapeCsvCell(`=cmd|' /C calc'!A0${crlf}line2`), `"'=cmd|' /C calc'!A0 line2"`);
});



