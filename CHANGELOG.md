# Changelog

All notable changes to the **X Dashboard** plugin for Hermes Web Dashboard and Hermes Desktop.

## 0.2.1 — 2026-11-19

- **Version consistency**: `/health` now reports the real plugin version via a single `__version__` constant (was hardcoded `0.1.0`); refreshed module docstring and `User-Agent`.
- **Request race guard**: dashboard fetches carry a monotonic sequence id — a slow stale response from an earlier handle switch/refresh can no longer overwrite newer data (`fetchSeqRef` in `XDashboardPage.tsx`).
- **Snapshot write safety**: the Free Mode `/summary` fresh-fetch path now runs under the same per-handle lock as the slice endpoints, preventing duplicate upstream fetches and last-writer-wins snapshot races on concurrent refreshes.
- **Honest sparklines**: KPI sparklines with fewer than 2 history points render a flat line instead of a fabricated upward curve.

## 0.2.0 — 2026-11-16

- **Hermes Desktop Native Design System Overhaul**:
  - Redesigned the entire surface (`src/XDashboardPage.tsx` and `src/x-dashboard.css`) to match native Hermes Desktop Activity, Honcho, and Quota panels with theme-variable bindings (`--background`, `--foreground`, `--ui-*`, `--chrome-*`), flat precision surfaces, `10px` uppercase tracking labels, and `tabular-nums` telemetry.
  - Added single-X stylized SVG header (`Dashboard`) with inline `@handle` switcher, **$0.00 Free Mode** refresh, on-demand **⚡ Sync Official X API**, and JSON/CSV export controls.
  - Refined the **Executive KPI Bento Grid** to a responsive **3×2** layout on desktop with `Premium+` subscription badge formatting.
  - Upgraded the **Impressions & Engagement Trajectory SVG Chart** to a clean bars-only design with deduplicated `MM-DD` X-axis labels, minimum horizontal spacing, and peak/selected value pills.
  - Filtered zero-value slices from the stacked **Engagement Mix** bar and aligned the **24-Hour UTC Posting Activity** cadence grid across all 24 hours (`00h → 23h`).
- **Detected Handle Pill Management & Persistence**:
  - Added an inline remove (`×`) button on every detected `@handle` pill (even when a single handle is present) that persists removed handles to `hidden_handles` in `<hermes_home>/plugin-data/x-dashboard/config.json`.
  - Automatically switches to the next available handle when the active handle is removed, and automatically unhides any handle when manually switched via the `@handle` input bar.

## 0.1.0 — 2026-10-25

- **100% Free Mode (`$0.00`) by Default**: Routine refreshes use zero-cost public syndication (`api.fxtwitter.com` / `api.vxtwitter.com`, Jina Reader `r.jina.ai`, and local snapshot caching in `<hermes_home>/plugin-data/x-dashboard/`) so viewing your dashboard never burns X API or xAI credits. Paid `x_search` discovery is strictly opt-in (`enable_x_search: false` by default).
- **Scoped Hermes X Account Resolution**: Resolves handles from plugin settings (`<hermes_home>/plugin-data/x-dashboard/config.json` / `plugins.entries.x-dashboard.settings`), Hermes-scoped `X_DASHBOARD_HANDLE` (`agent.secret_scope.get_secret`), `xurl auth status` when `xurl` is on `PATH`, or falls back cleanly to any public `@handle` (`@NousResearch` out of the box when no handle is configured).
- **Dual Web Dashboard & Hermes Desktop Native Plugin**: Ships both the Web Dashboard IIFE bundle (`dashboard/dist/index.js`) and the Hermes Desktop ESM plugin (`desktop/plugin.js`) from a shared TypeScript + React codebase.
- **Creator & Agent Command Center UI**:
  - 6-card KPI Bento Grid with live follower/following ratios, history sparklines, engagement quality tiers (`Elite >3%`, `Strong >1.5%`, `Steady`), and community pulse metrics.
  - Editable Creator Monetization Goal Trackers for Verified Followers and Organic Impressions with radial + linear progress gauges.
  - Interactive 20-Post Impressions & Engagement Trajectory SVG Chart with hover/click HUD inspection, Engagement Mix Breakdown, 24-Hour UTC Posting Cadence Heatmap, and #1 Top Performing Post Spotlight.
  - Interactive Posts Explorer, Mentions Radar, and Auto-Auth Inspector with keyword search, filter pills, sorting, and CSV/JSON export.
- **Safe Desktop Installer (`scripts/install-desktop.mjs`)**: Archives replaced plugin directories and sweeps stale `.backup-*` siblings into `~/.hermes/cache/scratch/archived-plugin-backups` so live `plugins/` and `desktop-plugins/` roots never suffer duplicate-ID collisions on Windows or POSIX.
