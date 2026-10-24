# X Dashboard v2 — Zero-Cost Creator & Agent Command Center for Hermes

<p align="center">
  <strong>100% Free Mode ($0.00) by default · Automatic Hermes X Account Detection (<code>xurl</code> / <code>xchat</code> / Public Handle) · Dual Web Dashboard &amp; Hermes Desktop Native Plugin</strong>
</p>

<p align="center">
  <a href="https://omx0r.github.io/x-dashboard/"><strong>🌐 Live Interactive Demo &amp; Product Showcase →</strong></a>
</p>

---

## Why X Dashboard v2?

Most X/Twitter analytics tools either lock creators behind expensive monthly SaaS subscriptions or burn paid X API v2 credits on every page refresh. **X Dashboard v2** is engineered specifically for the **Hermes Agent** ecosystem:

1. **⚡ 100% Free Mode ($0.00) by Default**: Routine refreshes use zero-cost public syndication, Nitter/guest-token telemetry, and local snapshot caching so viewing your dashboard **never burns X API credits**.
2. **🔗 Zero-Friction Hermes Auto-Link**: Automatically detects your connected X identity from your local Hermes environment (`~/.xurl` OAuth2 tokens, `XCHAT_ACCESS_TOKEN`, `~/.hermes/xchat`, or `x_search`) or lets you type **any public `@handle`** immediately with **zero API keys required**.
3. **🖥️ Dual-Host Native Architecture**: Ships both the **Hermes Web Dashboard IIFE bundle** (`dashboard/dist/index.js`) and the **Hermes Desktop ESM plugin** (`desktop/plugin.js`) from a single TypeScript + React codebase.
4. **📊 Bespoke Interactive SVG Visual Analytics**:
   - **6-Card Executive KPI Bento Grid** with live follower/following ratios, history sparklines, engagement quality tiers (`Elite >3%`, `Strong >1.5%`, `Steady`), and community pulse metrics.
   - **Editable Creator Monetization Goal Trackers** for **Verified Followers** (default `500`) and **Organic Impressions** (`500K` / `5M` presets or custom inline target) with radial + linear progress gauges and velocity pace estimates.
   - **Interactive 20-Post Impressions & Engagement Trajectory SVG Chart** with hover/click HUD inspection, **Engagement Mix Breakdown**, **24-Hour UTC Posting Cadence Heatmap**, and **#1 Top Performing Post Spotlight**.
   - **Interactive Posts Explorer, Mentions Radar & Auto-Auth Inspector** with instant keyword/hashtag search, filter pills (`All`, `Originals`, `Replies`, `Media`), and multi-metric sorting.

---

## Automatic Hermes X Account Detection Cascade

When X Dashboard loads, the backend (`dashboard/plugin_api.py`) resolves your account automatically using a zero-configuration cascade:

| Priority | Source | How It Works | Default Refresh Cost |
| :--- | :--- | :--- | :--- |
| **1** | **Dashboard Config / Query** | Saved `@handle` in `~/.hermes/x-dashboard/config.json` or live handle switcher input | **$0.00** (Free Mode) |
| **2** | **Hermes `xurl` OAuth2 (`~/.xurl`)** | Reads your local `xurl` profile/token automatically if installed | **$0.00** (Cached / Free Mode) · Optional on-demand X API v2 sync |
| **3** | **Hermes XChat (`XCHAT_ACCESS_TOKEN`)** | Detects active Hermes XChat credentials in environment or `~/.hermes/xchat` | **$0.00** (Cached / Free Mode) |
| **4** | **Public Handle Mode (`@any_handle`)** | Works out-of-the-box for any X creator or agent handle with zero keys | **$0.00** (100% Free) |

> **On-Demand Official X API v2 Sync**: Want to refresh `verified_followers_count` or owned non-public metrics from the official X API v2? Click **⚡ Sync Official X API v2** in the header anytime—paid v2 calls only happen when you explicitly request them.

---

## Quick Installation

### 1. Clone into Hermes Plugins

```bash
git clone https://github.com/omx0r/x-dashboard.git ~/.hermes/plugins/x-dashboard
cd ~/.hermes/plugins/x-dashboard
```

### 2. Enable for Hermes Web Dashboard

Ensure `x-dashboard` is enabled in `~/.hermes/config.yaml`:

```yaml
plugins:
  enabled:
    - x-dashboard
```

Restart the Hermes Web Dashboard and click **X Dashboard** in the sidebar.

### 3. Install into Hermes Desktop (One Command)

To register the native ESM plugin (`~/.hermes/desktop-plugins/x-dashboard/plugin.js`) for **Hermes Desktop** (adding `/x-dashboard`, the sidebar **X Dashboard** graph icon, and the `Open X Dashboard` command palette action):

```bash
node scripts/install-desktop.mjs
```

---

## Development, Build & Verification

```bash
# Typecheck TypeScript sources
npm run typecheck

# Build both Web Dashboard (dashboard/dist/index.js) and Desktop (desktop/plugin.js)
npm run build

# Run Frontend JSDOM & Desktop Contract tests
npm test

# Run Backend Python API tests
pytest -q
```

### Repository Architecture

```text
x-dashboard/
├── plugin.yaml                 # Hermes plugin metadata
├── __init__.py                 # Hermes plugin lifecycle & route registration
├── dashboard/
│   ├── manifest.json           # Web Dashboard tab manifest
│   ├── plugin_api.py           # Zero-cost Free Mode + Auto-Link + X API v2 backend
│   └── dist/
│       ├── index.js            # Built Web Dashboard IIFE bundle
│       └── style.css           # Extracted stylesheet (also injected inline)
├── desktop/
│   └── plugin.js               # Built Hermes Desktop ESM bundle
├── src/
│   ├── XDashboardPage.tsx      # Main Xenia Creator & Agent Command Center UI
│   ├── x-dashboard.css         # Dark-first, Hermes theme-adaptive glassmorphism CSS
│   ├── sdk.ts                  # Dual-host API bridge (Web fetchJSON + Desktop ctx.rest)
│   ├── types.ts                # Unified v2 + legacy normalization & client analytics
│   ├── index.tsx               # Web Dashboard __HERMES_PLUGINS__ entry
│   └── desktop/                # Hermes Desktop contract, host adapter & ESM entry
├── scripts/
│   └── install-desktop.mjs     # Installer for ~/.hermes/desktop-plugins/x-dashboard
├── docs/
│   └── index.html              # Interactive GitHub Pages product showcase & live demo
├── test/
│   └── x-dashboard.test.mjs    # JSDOM frontend & Desktop contract test suite
└── tests/
    └── test_plugin_api.py      # Python backend unit tests
```

---

## Live Preview & Interactive Showcase

Explore the live interactive demo at **[https://omx0r.github.io/x-dashboard/](https://omx0r.github.io/x-dashboard/)** (served directly from [`docs/index.html`](./docs/index.html)).

## License

MIT
