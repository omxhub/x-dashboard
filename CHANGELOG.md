# Changelog

All notable changes to the **X Dashboard** plugin for Hermes Web Dashboard and Hermes Desktop.

## 0.1.0 — 2026-10-25

- **100% Free Mode (`$0.00`) by Default**: Routine refreshes use zero-cost public syndication (`api.fxtwitter.com`, Nitter/guest-token telemetry, Jina Reader, and local snapshot caching) so viewing your dashboard never burns X API credits.
- **Automatic Hermes X Account Detection**: Auto-links connected X accounts from `~/.xurl` OAuth2 sessions, `XCHAT_ACCESS_TOKEN` / `~/.hermes/xchat`, `USER.md`, or falls back cleanly to any public `@handle` (`@NousResearch` out of the box when no local account is linked).
- **Dual Web Dashboard & Hermes Desktop Native Plugin**: Ships both the Web Dashboard IIFE bundle (`dashboard/dist/index.js`) and the Hermes Desktop ESM plugin (`desktop/plugin.js`) from a shared TypeScript + React codebase.
- **Creator & Agent Command Center UI**:
  - 6-card KPI Bento Grid with live follower/following ratios, history sparklines, engagement quality tiers (`Elite >3%`, `Strong >1.5%`, `Steady`), and community pulse metrics.
  - Editable Creator Monetization Goal Trackers for Verified Followers and Organic Impressions with radial + linear progress gauges.
  - Interactive 20-Post Impressions & Engagement Trajectory SVG Chart with hover/click HUD inspection, Engagement Mix Breakdown, 24-Hour UTC Posting Cadence Heatmap, and #1 Top Performing Post Spotlight.
  - Interactive Posts Explorer, Mentions Radar, and Auto-Auth Inspector with keyword search, filter pills, sorting, and CSV/JSON export.
- **Safe Desktop Installer (`scripts/install-desktop.mjs`)**: Archives replaced plugin directories and sweeps stale `.backup-*` siblings into `~/.hermes/cache/scratch/archived-plugin-backups` so live `plugins/` and `desktop-plugins/` roots never suffer duplicate-ID collisions on Windows or POSIX.
