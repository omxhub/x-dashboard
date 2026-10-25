import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { host } from "@hermes/plugin-sdk";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
const xDashboardCss = '/* ==========================================================================\r\n   X Dashboard — Native Hermes Desktop & Web Dashboard Design System\r\n   Matches Hermes Desktop Activity / Honcho / Quota surfaces:\r\n   - Theme-variable driven (--background, --foreground, --ui-*, --chrome-*)\r\n   - Web Dashboard fallbacks (--bg-base, --bg-card, --text-primary, etc.)\r\n   - Skin-adaptive across light, dark, warm, and high-contrast themes\r\n   - Flat sections, 10px uppercase tracking labels, tabular-nums telemetry\r\n   - Explicit text-selection opt-in (data-selectable-text / user-select: text)\r\n   ========================================================================== */\r\n\r\n.xd-root {\r\n  /* Core Hermes Desktop -> Web Dashboard -> Default token bindings */\r\n  --xd-bg: var(--background, var(--bg-base, transparent));\r\n  --xd-fg: var(--foreground, var(--ui-text-primary, var(--text-primary, #e2e8f0)));\r\n  --xd-text: var(--ui-text-primary, var(--foreground, var(--text-primary, currentColor)));\r\n  --xd-text-secondary: var(\r\n    --ui-text-secondary,\r\n    var(--text-secondary, color-mix(in srgb, var(--xd-fg) 76%, transparent))\r\n  );\r\n  --xd-text-tertiary: var(\r\n    --ui-text-tertiary,\r\n    var(--color-muted-foreground, color-mix(in srgb, var(--xd-fg) 58%, transparent))\r\n  );\r\n  --xd-surface: var(\r\n    --ui-bg-elevated,\r\n    var(--bg-card, color-mix(in srgb, var(--xd-fg) 3.5%, transparent))\r\n  );\r\n  --xd-surface-subtle: color-mix(in srgb, var(--xd-fg) 2.5%, transparent);\r\n  --xd-surface-hover: var(\r\n    --chrome-action-hover,\r\n    color-mix(in srgb, var(--xd-fg) 6.5%, transparent)\r\n  );\r\n  --xd-border: var(\r\n    --ui-border-subtle,\r\n    var(--border-subtle, color-mix(in srgb, var(--xd-fg) 10%, transparent))\r\n  );\r\n  --xd-stroke: var(\r\n    --ui-stroke-secondary,\r\n    var(--border-default, color-mix(in srgb, var(--xd-fg) 15%, transparent))\r\n  );\r\n  --xd-accent: var(--ui-accent, var(--color-primary, #1d9bf0));\r\n  --xd-blue: var(--ui-blue, var(--xd-accent, #1d9bf0));\r\n  --xd-purple: var(--ui-purple, #8b5cf6);\r\n  --xd-yellow: var(--ui-yellow, #f59e0b);\r\n  --xd-emerald: var(--ui-green, #10b981);\r\n  --xd-rose: var(--ui-red, #f43f5e);\r\n\r\n  --xd-font-sans: var(\r\n    --theme-font-sans,\r\n    -apple-system,\r\n    BlinkMacSystemFont,\r\n    "Inter",\r\n    "Segoe UI",\r\n    sans-serif\r\n  );\r\n  --xd-font-mono: var(\r\n    --theme-font-mono,\r\n    "JetBrains Mono",\r\n    "Fira Code",\r\n    ui-monospace,\r\n    SFMono-Regular,\r\n    monospace\r\n  );\r\n  --xd-text-size: var(--conversation-text-font-size, 0.8125rem);\r\n  --xd-caption-size: var(--conversation-caption-font-size, 0.75rem);\r\n\r\n  display: flex;\r\n  flex-direction: column;\r\n  height: 100%;\r\n  min-height: 0;\r\n  width: 100%;\r\n  padding: 0 clamp(1.25rem, 4vw, 4rem) 2rem;\r\n  font-family: var(--xd-font-sans);\r\n  font-size: var(--xd-text-size);\r\n  color: var(--xd-fg);\r\n  background: var(--xd-bg);\r\n  box-sizing: border-box;\r\n  overflow-y: auto;\r\n  overflow-x: hidden;\r\n  -webkit-font-smoothing: antialiased;\r\n}\r\n\r\n.xd-root *,\r\n.xd-root *::before,\r\n.xd-root *::after {\r\n  box-sizing: border-box;\r\n}\r\n\r\n.xd-selectable,\r\n.xd-root [data-selectable-text="true"] {\r\n  user-select: text;\r\n  -webkit-user-select: text;\r\n}\r\n\r\n.xd-container {\r\n  width: 100%;\r\n  max-width: 1280px;\r\n  margin: 0 auto;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 1.35rem;\r\n}\r\n\r\n/* ── Signature Hermes Desktop Typography & Section Atoms ─────────────── */\r\n.xd-label {\r\n  font-size: 0.625rem;\r\n  font-weight: 500;\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.08em;\r\n  color: var(--xd-text-tertiary);\r\n  line-height: 1.2;\r\n}\r\n\r\n.xd-label-wide {\r\n  font-size: 0.625rem;\r\n  font-weight: 500;\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.12em;\r\n  color: var(--xd-text-tertiary);\r\n  line-height: 1.2;\r\n}\r\n\r\n.xd-caption {\r\n  font-size: var(--xd-caption-size);\r\n  color: var(--xd-text-tertiary);\r\n  line-height: 1.4;\r\n}\r\n\r\n.xd-tabular {\r\n  font-variant-numeric: tabular-nums;\r\n}\r\n\r\n.xd-section {\r\n  min-width: 0;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.5rem;\r\n}\r\n\r\n.xd-section-header {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 0.75rem;\r\n}\r\n\r\n/* ── Native Hermes Desktop Page Header (pb-4 pt-5) ──────────────────── */\r\n.xd-page-header {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 0.75rem;\r\n  padding-top: 1.25rem;\r\n  padding-bottom: 0.875rem;\r\n  border-bottom: 1px solid var(--xd-border);\r\n}\r\n\r\n.xd-page-title-group {\r\n  min-width: 0;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.15rem;\r\n}\r\n\r\n.xd-page-title-row {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 0.5rem;\r\n  flex-wrap: wrap;\r\n}\r\n\r\n.xd-page-icon {\r\n  width: 15px;\r\n  height: 15px;\r\n  color: var(--xd-text-secondary);\r\n  flex-shrink: 0;\r\n}\r\n\r\n.xd-page-title {\r\n  margin: 0;\r\n  font-size: 1rem;\r\n  font-weight: 600;\r\n  letter-spacing: -0.015em;\r\n  color: var(--xd-fg);\r\n  line-height: 1.25;\r\n}\r\n\r\n.xd-page-subtitle {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 0.375rem;\r\n  font-size: var(--xd-caption-size);\r\n  color: var(--xd-text-tertiary);\r\n  font-variant-numeric: tabular-nums;\r\n}\r\n\r\n.xd-header-toolbar {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 0.375rem;\r\n}\r\n\r\n/* ── Compact Handle Switcher & Chrome Buttons ───────────────────────── */\r\n.xd-handle-form {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  height: 1.75rem;\r\n  border-radius: 0.375rem;\r\n  border: 1px solid var(--xd-stroke);\r\n  background: var(--xd-surface);\r\n  padding: 0 0.2rem 0 0.5rem;\r\n  gap: 0.25rem;\r\n  transition: border-color 0.12s ease;\r\n}\r\n\r\n.xd-handle-form:focus-within {\r\n  border-color: var(--xd-accent);\r\n}\r\n\r\n.xd-handle-prefix {\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.72rem;\r\n  color: var(--xd-text-tertiary);\r\n  user-select: none;\r\n}\r\n\r\n.xd-handle-input {\r\n  background: transparent;\r\n  border: none;\r\n  color: var(--xd-fg);\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.72rem;\r\n  width: 6.75rem;\r\n  outline: none;\r\n  padding: 0;\r\n}\r\n\r\n.xd-handle-input::placeholder {\r\n  color: var(--xd-text-tertiary);\r\n}\r\n\r\n.xd-btn {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  gap: 0.35rem;\r\n  height: 1.75rem;\r\n  padding: 0 0.6rem;\r\n  border-radius: 0.375rem;\r\n  font-family: var(--xd-font-sans);\r\n  font-size: 0.72rem;\r\n  font-weight: 500;\r\n  color: var(--xd-fg);\r\n  background: transparent;\r\n  border: 1px solid var(--xd-stroke);\r\n  cursor: pointer;\r\n  white-space: nowrap;\r\n  transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;\r\n}\r\n\r\n.xd-btn:hover:not(:disabled) {\r\n  background: var(--xd-surface-hover);\r\n}\r\n\r\n.xd-btn:disabled {\r\n  opacity: 0.5;\r\n  cursor: default;\r\n}\r\n\r\n.xd-btn-sm {\r\n  height: 1.375rem;\r\n  padding: 0 0.45rem;\r\n  border-radius: 0.25rem;\r\n  font-size: 0.675rem;\r\n}\r\n\r\n.xd-btn-ghost {\r\n  border-color: transparent;\r\n  color: var(--xd-text-secondary);\r\n}\r\n\r\n.xd-btn-ghost:hover:not(:disabled) {\r\n  background: var(--xd-surface-hover);\r\n  color: var(--xd-fg);\r\n}\r\n\r\n.xd-btn-primary {\r\n  background: color-mix(in srgb, var(--xd-accent) 14%, transparent);\r\n  border-color: color-mix(in srgb, var(--xd-accent) 38%, transparent);\r\n  color: var(--xd-fg);\r\n}\r\n\r\n.xd-btn-primary:hover:not(:disabled) {\r\n  background: color-mix(in srgb, var(--xd-accent) 22%, transparent);\r\n  border-color: color-mix(in srgb, var(--xd-accent) 52%, transparent);\r\n}\r\n\r\n.xd-btn-live {\r\n  background: color-mix(in srgb, var(--xd-purple) 12%, transparent);\r\n  border-color: color-mix(in srgb, var(--xd-purple) 34%, transparent);\r\n  color: var(--xd-fg);\r\n}\r\n\r\n.xd-btn-live:hover:not(:disabled) {\r\n  background: color-mix(in srgb, var(--xd-purple) 20%, transparent);\r\n}\r\n\r\n/* ── Segmented Control (Hermes Desktop Native Feel) ─────────────────── */\r\n.xd-segmented {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  padding: 2px;\r\n  border-radius: 0.375rem;\r\n  background: color-mix(in srgb, var(--xd-fg) 5%, transparent);\r\n  border: 1px solid var(--xd-border);\r\n  gap: 1px;\r\n}\r\n\r\n.xd-segmented-item {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.3rem;\r\n  height: 1.4rem;\r\n  padding: 0 0.55rem;\r\n  border-radius: 0.25rem;\r\n  border: none;\r\n  background: transparent;\r\n  color: var(--xd-text-tertiary);\r\n  font-family: var(--xd-font-sans);\r\n  font-size: 0.6875rem;\r\n  font-weight: 500;\r\n  cursor: pointer;\r\n  transition: background-color 0.12s ease, color 0.12s ease;\r\n  white-space: nowrap;\r\n}\r\n\r\n.xd-segmented-item:hover {\r\n  color: var(--xd-fg);\r\n}\r\n\r\n.xd-segmented-item.is-active {\r\n  background: var(--xd-surface);\r\n  color: var(--xd-fg);\r\n  box-shadow: 0 1px 2px color-mix(in srgb, currentColor 8%, transparent);\r\n}\r\n\r\n/* ── Status Dots & Badges ───────────────────────────────────────────── */\r\n.xd-status-dot,\r\n.xd-pulse-dot {\r\n  width: 6px;\r\n  height: 6px;\r\n  border-radius: 999px;\r\n  background: var(--xd-blue);\r\n  display: inline-block;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.xd-status-dot.is-linked,\r\n.xd-autolink-pill.is-linked .xd-pulse-dot {\r\n  background: var(--xd-emerald);\r\n}\r\n\r\n.xd-autolink-pill {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.375rem;\r\n  padding: 0.125rem 0.5rem;\r\n  border-radius: 999px;\r\n  font-size: 0.6875rem;\r\n  font-weight: 500;\r\n  border: 1px solid var(--xd-stroke);\r\n  background: var(--xd-surface-subtle);\r\n  color: var(--xd-text-secondary);\r\n}\r\n\r\n.xd-autolink-pill.is-linked {\r\n  border-color: color-mix(in srgb, var(--xd-emerald) 38%, var(--xd-stroke));\r\n}\r\n\r\n.xd-zero-cost-badge {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.25rem;\r\n  padding: 0.125rem 0.5rem;\r\n  border-radius: 999px;\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.65rem;\r\n  font-weight: 500;\r\n  background: color-mix(in srgb, var(--xd-emerald) 12%, transparent);\r\n  border: 1px solid color-mix(in srgb, var(--xd-emerald) 32%, transparent);\r\n  color: var(--xd-text-secondary);\r\n}\r\n\r\n/* ── Profile Summary Strip (Flat Hermes Surface) ────────────────────── */\r\n.xd-profile-strip,\r\n.xd-hero {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.625rem;\r\n  padding: 0.875rem 1rem;\r\n  border-radius: 0.5rem;\r\n  border: 1px solid var(--xd-border);\r\n  background: var(--xd-surface);\r\n}\r\n\r\n.xd-profile-row {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 0.75rem;\r\n}\r\n\r\n.xd-profile-identity {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 0.75rem;\r\n  min-width: 0;\r\n}\r\n\r\n.xd-avatar-wrap {\r\n  position: relative;\r\n  width: 2.5rem;\r\n  height: 2.5rem;\r\n  border-radius: 999px;\r\n  border: 1px solid var(--xd-stroke);\r\n  background: var(--xd-surface-subtle);\r\n  flex-shrink: 0;\r\n}\r\n\r\n.xd-avatar-img,\r\n.xd-avatar-fallback {\r\n  width: 100%;\r\n  height: 100%;\r\n  border-radius: 999px;\r\n  object-fit: cover;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  font-size: 0.95rem;\r\n  font-weight: 600;\r\n  color: var(--xd-fg);\r\n  background: color-mix(in srgb, var(--xd-accent) 14%, transparent);\r\n}\r\n\r\n.xd-verified-badge {\r\n  position: absolute;\r\n  bottom: -2px;\r\n  right: -2px;\r\n  width: 14px;\r\n  height: 14px;\r\n  border-radius: 999px;\r\n  background: var(--xd-accent);\r\n  color: #fff;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  font-size: 9px;\r\n  font-weight: 700;\r\n  border: 1.5px solid var(--xd-bg, #000);\r\n}\r\n\r\n.xd-profile-titles {\r\n  min-width: 0;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.125rem;\r\n}\r\n\r\n.xd-name-line {\r\n  display: flex;\r\n  align-items: center;\r\n  flex-wrap: wrap;\r\n  gap: 0.4rem;\r\n}\r\n\r\n.xd-display-name {\r\n  margin: 0;\r\n  font-size: 0.9375rem;\r\n  font-weight: 600;\r\n  letter-spacing: -0.01em;\r\n  color: var(--xd-fg);\r\n}\r\n\r\n.xd-sub-badge {\r\n  font-size: 0.6rem;\r\n  font-weight: 500;\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.06em;\r\n  padding: 0.05rem 0.375rem;\r\n  border-radius: 0.25rem;\r\n  background: color-mix(in srgb, var(--xd-fg) 6%, transparent);\r\n  border: 1px solid var(--xd-border);\r\n  color: var(--xd-text-secondary);\r\n}\r\n\r\n.xd-handle-link {\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.72rem;\r\n  color: var(--xd-text-tertiary);\r\n  text-decoration: none;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.2rem;\r\n}\r\n\r\n.xd-handle-link:hover {\r\n  color: var(--xd-fg);\r\n  text-decoration: underline;\r\n}\r\n\r\n.xd-profile-badges,\r\n.xd-command-controls {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 0.4rem;\r\n}\r\n\r\n.xd-bio-row {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.5rem;\r\n}\r\n\r\n.xd-bio-text {\r\n  margin: 0;\r\n  font-size: var(--xd-text-size);\r\n  line-height: 1.5;\r\n  color: var(--xd-text-secondary);\r\n  max-width: 78ch;\r\n  overflow-wrap: anywhere;\r\n}\r\n\r\n.xd-meta-strip {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 0.875rem;\r\n  font-size: 0.7rem;\r\n  color: var(--xd-text-tertiary);\r\n}\r\n\r\n.xd-meta-item {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.25rem;\r\n}\r\n\r\n.xd-meta-item a {\r\n  color: var(--xd-text-secondary);\r\n  text-decoration: underline;\r\n  text-underline-offset: 2px;\r\n}\r\n\r\n.xd-meta-item a:hover {\r\n  color: var(--xd-fg);\r\n}\r\n\r\n/* ── Error / Status Banner ──────────────────────────────────────────── */\r\n.xd-banner-alert {\r\n  padding: 0.5rem 0.75rem;\r\n  border-radius: 0.375rem;\r\n  background: color-mix(in srgb, var(--xd-rose) 10%, transparent);\r\n  border: 1px solid color-mix(in srgb, var(--xd-rose) 35%, transparent);\r\n  color: var(--xd-fg);\r\n  font-size: var(--xd-caption-size);\r\n  display: flex;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.75rem;\r\n}\r\n\r\n/* ── Executive KPI Telemetry Strip (Activity Stat Style) ────────────── */\r\n.xd-kpi-grid {\r\n  display: grid;\r\n  grid-template-columns: repeat(6, minmax(0, 1fr));\r\n  gap: 0.75rem;\r\n}\r\n\r\n.xd-root[data-layout="compact"] .xd-kpi-grid {\r\n  grid-template-columns: repeat(3, minmax(0, 1fr));\r\n}\r\n\r\n.xd-root[data-layout="narrow"] .xd-kpi-grid {\r\n  grid-template-columns: repeat(2, minmax(0, 1fr));\r\n}\r\n\r\n@media (max-width: 1120px) {\r\n  .xd-kpi-grid {\r\n    grid-template-columns: repeat(3, minmax(0, 1fr));\r\n  }\r\n}\r\n\r\n@media (max-width: 640px) {\r\n  .xd-kpi-grid {\r\n    grid-template-columns: repeat(2, minmax(0, 1fr));\r\n  }\r\n}\r\n\r\n.xd-kpi-card {\r\n  min-width: 0;\r\n  padding: 0.65rem 0.75rem;\r\n  border-radius: 0.5rem;\r\n  border: 1px solid var(--xd-border);\r\n  background: var(--xd-surface);\r\n  display: flex;\r\n  flex-direction: column;\r\n  justify-content: space-between;\r\n  gap: 0.3rem;\r\n}\r\n\r\n.xd-kpi-top {\r\n  display: flex;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.35rem;\r\n  min-width: 0;\r\n}\r\n\r\n.xd-kpi-label {\r\n  font-size: 0.625rem;\r\n  font-weight: 500;\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.1em;\r\n  color: var(--xd-text-tertiary);\r\n  white-space: nowrap;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n}\r\n\r\n.xd-kpi-pill {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.25rem;\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.625rem;\r\n  font-weight: 500;\r\n  font-variant-numeric: tabular-nums;\r\n  padding: 0.1rem 0.4rem;\r\n  border-radius: 999px;\r\n  background: color-mix(in srgb, var(--xd-blue) 12%, transparent);\r\n  border: 1px solid color-mix(in srgb, var(--xd-blue) 28%, transparent);\r\n  color: var(--xd-text-secondary);\r\n  white-space: nowrap;\r\n}\r\n\r\n.xd-kpi-pill.is-emerald {\r\n  background: color-mix(in srgb, var(--xd-emerald) 12%, transparent);\r\n  border-color: color-mix(in srgb, var(--xd-emerald) 30%, transparent);\r\n}\r\n\r\n.xd-kpi-pill.is-amber {\r\n  background: color-mix(in srgb, var(--xd-yellow) 14%, transparent);\r\n  border-color: color-mix(in srgb, var(--xd-yellow) 32%, transparent);\r\n}\r\n\r\n.xd-kpi-pill.is-violet {\r\n  background: color-mix(in srgb, var(--xd-purple) 12%, transparent);\r\n  border-color: color-mix(in srgb, var(--xd-purple) 30%, transparent);\r\n}\r\n\r\n.xd-kpi-value {\r\n  font-size: 1.125rem;\r\n  font-weight: 600;\r\n  letter-spacing: -0.02em;\r\n  font-variant-numeric: tabular-nums;\r\n  color: var(--xd-fg);\r\n  line-height: 1.2;\r\n}\r\n\r\n.xd-kpi-sub {\r\n  display: flex;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  font-size: 0.65rem;\r\n  color: var(--xd-text-tertiary);\r\n  font-variant-numeric: tabular-nums;\r\n  gap: 0.35rem;\r\n  min-width: 0;\r\n}\r\n\r\n.xd-kpi-sub > span:first-child {\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.xd-sparkline {\r\n  width: 54px;\r\n  height: 16px;\r\n  overflow: visible;\r\n  flex-shrink: 0;\r\n}\r\n\r\n/* ── Monetization & Creator Growth Goal Trackers ────────────────────── */\r\n.xd-goals-grid {\r\n  display: grid;\r\n  grid-template-columns: repeat(2, minmax(0, 1fr));\r\n  gap: 0.75rem;\r\n}\r\n\r\n.xd-root[data-layout="narrow"] .xd-goals-grid {\r\n  grid-template-columns: 1fr;\r\n}\r\n\r\n@media (max-width: 820px) {\r\n  .xd-goals-grid {\r\n    grid-template-columns: 1fr;\r\n  }\r\n}\r\n\r\n.xd-goal-card {\r\n  border-radius: 0.5rem;\r\n  padding: 0.75rem 0.875rem;\r\n  background: var(--xd-surface);\r\n  border: 1px solid var(--xd-border);\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 0.875rem;\r\n  min-width: 0;\r\n}\r\n\r\n.xd-goal-radial {\r\n  position: relative;\r\n  width: 52px;\r\n  height: 52px;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.xd-goal-radial svg {\r\n  width: 100%;\r\n  height: 100%;\r\n  transform: rotate(-90deg);\r\n}\r\n\r\n.xd-goal-radial-track {\r\n  stroke: color-mix(in srgb, currentColor 11%, transparent);\r\n}\r\n\r\n.xd-goal-radial-pct {\r\n  position: absolute;\r\n  inset: 0;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.68rem;\r\n  font-weight: 600;\r\n  font-variant-numeric: tabular-nums;\r\n  color: var(--xd-fg);\r\n}\r\n\r\n.xd-goal-content {\r\n  flex: 1;\r\n  min-width: 0;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.375rem;\r\n}\r\n\r\n.xd-goal-header {\r\n  display: flex;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.5rem;\r\n  flex-wrap: wrap;\r\n}\r\n\r\n.xd-goal-title {\r\n  font-size: 0.75rem;\r\n  font-weight: 600;\r\n  color: var(--xd-fg);\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 0.375rem;\r\n}\r\n\r\n.xd-goal-target-btn {\r\n  background: transparent;\r\n  border: 1px dashed var(--xd-stroke);\r\n  color: var(--xd-text-secondary);\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.65rem;\r\n  font-variant-numeric: tabular-nums;\r\n  padding: 0.1rem 0.45rem;\r\n  border-radius: 0.25rem;\r\n  cursor: pointer;\r\n}\r\n\r\n.xd-goal-target-btn:hover {\r\n  background: var(--xd-surface-hover);\r\n  color: var(--xd-fg);\r\n}\r\n\r\n.xd-goal-edit-inline {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.25rem;\r\n}\r\n\r\n.xd-goal-input {\r\n  width: 5.5rem;\r\n  background: var(--xd-bg);\r\n  border: 1px solid var(--xd-accent);\r\n  color: var(--xd-fg);\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.68rem;\r\n  padding: 0.15rem 0.35rem;\r\n  border-radius: 0.25rem;\r\n  outline: none;\r\n}\r\n\r\n.xd-progress-track {\r\n  height: 6px;\r\n  border-radius: 999px;\r\n  background: color-mix(in srgb, currentColor 9%, transparent);\r\n  overflow: hidden;\r\n}\r\n\r\n.xd-progress-fill {\r\n  height: 100%;\r\n  border-radius: 999px;\r\n  background: var(--xd-accent);\r\n  transition: width 0.25s ease;\r\n}\r\n\r\n.xd-progress-fill.is-emerald {\r\n  background: var(--xd-emerald);\r\n}\r\n\r\n.xd-goal-meta {\r\n  display: flex;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.5rem;\r\n  font-size: 0.66rem;\r\n  color: var(--xd-text-tertiary);\r\n  font-family: var(--xd-font-mono);\r\n  font-variant-numeric: tabular-nums;\r\n}\r\n\r\n/* ── Visual Analytics Grid (2-Column Hermes Layout) ─────────────────── */\r\n.xd-analytics-grid {\r\n  display: grid;\r\n  grid-template-columns: 1.35fr 1fr;\r\n  gap: 1.25rem;\r\n  align-items: start;\r\n}\r\n\r\n.xd-root[data-layout="compact"] .xd-analytics-grid,\r\n.xd-root[data-layout="narrow"] .xd-analytics-grid {\r\n  grid-template-columns: 1fr;\r\n}\r\n\r\n@media (max-width: 1024px) {\r\n  .xd-analytics-grid {\r\n    grid-template-columns: 1fr;\r\n  }\r\n}\r\n\r\n.xd-panel {\r\n  min-width: 0;\r\n  border-radius: 0.5rem;\r\n  padding: 0.875rem 1rem;\r\n  background: var(--xd-surface);\r\n  border: 1px solid var(--xd-border);\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.75rem;\r\n}\r\n\r\n.xd-panel-header {\r\n  display: flex;\r\n  justify-content: space-between;\r\n  align-items: baseline;\r\n  gap: 0.5rem;\r\n  flex-wrap: wrap;\r\n}\r\n\r\n.xd-panel-title {\r\n  margin: 0;\r\n  font-size: 0.625rem;\r\n  font-weight: 500;\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.08em;\r\n  color: var(--xd-text-tertiary);\r\n}\r\n\r\n.xd-panel-subtitle {\r\n  margin: 0.15rem 0 0;\r\n  font-size: 0.68rem;\r\n  color: var(--xd-text-tertiary);\r\n}\r\n\r\n/* ── SVG Trajectory Chart & Selected Bar HUD ────────────────────────── */\r\n.xd-chart-stage {\r\n  position: relative;\r\n  width: 100%;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.5rem;\r\n}\r\n\r\n.xd-trajectory-svg {\r\n  width: 100%;\r\n  height: 176px;\r\n  overflow: visible;\r\n  display: block;\r\n}\r\n\r\n.xd-chart-grid-line {\r\n  stroke: color-mix(in srgb, currentColor 9%, transparent);\r\n}\r\n\r\n.xd-chart-axis-text {\r\n  fill: currentColor;\r\n  opacity: 0.5;\r\n  font-size: 8.5px;\r\n  font-family: var(--xd-font-mono);\r\n}\r\n\r\n.xd-chart-axis-text.is-selected {\r\n  opacity: 0.95;\r\n  font-weight: 600;\r\n  fill: var(--xd-emerald);\r\n}\r\n\r\n.xd-chart-axis-tick {\r\n  stroke: currentColor;\r\n  opacity: 0.25;\r\n  stroke-width: 1;\r\n}\r\n\r\n.xd-chart-value-label {\r\n  fill: currentColor;\r\n  opacity: 0.65;\r\n  font-size: 8.5px;\r\n  font-family: var(--xd-font-mono);\r\n  font-weight: 600;\r\n  pointer-events: none;\r\n}\r\n\r\n.xd-chart-value-label.is-selected {\r\n  fill: var(--xd-emerald);\r\n  opacity: 1;\r\n}\r\n\r\n.xd-bar-group {\r\n  cursor: pointer;\r\n}\r\n\r\n.xd-bar-hit {\r\n  pointer-events: all;\r\n}\r\n\r\n.xd-bar-rect {\r\n  transition: opacity 0.12s ease;\r\n}\r\n\r\n.xd-bar-group:hover .xd-bar-rect {\r\n  opacity: 0.85;\r\n}\r\n\r\n.xd-chart-hud {\r\n  padding: 0.5rem 0.65rem;\r\n  border-radius: 0.375rem;\r\n  background: var(--xd-surface-subtle);\r\n  border: 1px solid var(--xd-border);\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.5rem;\r\n  font-size: 0.7rem;\r\n}\r\n\r\n.xd-chart-hud-text {\r\n  color: var(--xd-fg);\r\n  max-width: 420px;\r\n  white-space: nowrap;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n}\r\n\r\n.xd-chart-hud-metrics {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  gap: 0.6rem;\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.66rem;\r\n  font-variant-numeric: tabular-nums;\r\n  color: var(--xd-text-secondary);\r\n}\r\n\r\n/* ── TokenMix-Style Interaction Mix & 24h Cadence Strip ─────────────── */\r\n.xd-mix-stacked-bar {\r\n  display: flex;\r\n  height: 0.5rem;\r\n  overflow: hidden;\r\n  border-radius: 999px;\r\n  background: color-mix(in srgb, currentColor 9%, transparent);\r\n}\r\n\r\n.xd-mix-list {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.25rem;\r\n}\r\n\r\n.xd-mix-row {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 0.5rem;\r\n  padding: 0.15rem 0;\r\n  font-size: 0.7rem;\r\n}\r\n\r\n.xd-mix-label {\r\n  color: var(--xd-fg);\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.4rem;\r\n}\r\n\r\n.xd-mix-dot {\r\n  width: 8px;\r\n  height: 8px;\r\n  border-radius: 2px;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.xd-mix-bar-bg {\r\n  height: 6px;\r\n  border-radius: 999px;\r\n  background: color-mix(in srgb, currentColor 9%, transparent);\r\n  overflow: hidden;\r\n  flex: 1;\r\n}\r\n\r\n.xd-mix-bar-fill {\r\n  height: 100%;\r\n  border-radius: 999px;\r\n}\r\n\r\n.xd-mix-val {\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.68rem;\r\n  font-variant-numeric: tabular-nums;\r\n  color: var(--xd-text-tertiary);\r\n}\r\n\r\n.xd-cadence-strip {\r\n  display: grid;\r\n  grid-template-columns: repeat(24, minmax(0, 1fr));\r\n  gap: 2px;\r\n  height: 44px;\r\n  align-items: end;\r\n  padding-top: 4px;\r\n}\r\n\r\n.xd-cadence-col {\r\n  display: flex;\r\n  flex-direction: column;\r\n  align-items: center;\r\n  justify-content: flex-end;\r\n  height: 100%;\r\n  gap: 2px;\r\n}\r\n\r\n.xd-cadence-bar {\r\n  width: 100%;\r\n  border-radius: 2px;\r\n  background: var(--xd-accent);\r\n  min-height: 2px;\r\n}\r\n\r\n.xd-cadence-hr {\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 8.5px;\r\n  color: var(--xd-text-tertiary);\r\n  line-height: 1;\r\n}\r\n\r\n.xd-breakdown-strip {\r\n  display: grid;\r\n  grid-template-columns: repeat(3, minmax(0, 1fr));\r\n  gap: 0.5rem;\r\n  padding-top: 0.5rem;\r\n  border-top: 1px solid var(--xd-border);\r\n}\r\n\r\n/* ── Top Performing Post Spotlight ──────────────────────────────────── */\r\n.xd-spotlight-card {\r\n  border-radius: 0.375rem;\r\n  padding: 0.7rem 0.8rem;\r\n  background: color-mix(in srgb, var(--xd-accent) 5%, var(--xd-surface-subtle));\r\n  border: 1px solid color-mix(in srgb, var(--xd-accent) 24%, var(--xd-border));\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.45rem;\r\n}\r\n\r\n.xd-spotlight-top {\r\n  display: flex;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.5rem;\r\n}\r\n\r\n.xd-spotlight-badge {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.3rem;\r\n  font-size: 0.625rem;\r\n  font-weight: 600;\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.08em;\r\n  color: var(--xd-text-secondary);\r\n}\r\n\r\n.xd-spotlight-text {\r\n  margin: 0;\r\n  font-size: var(--xd-text-size);\r\n  line-height: 1.45;\r\n  color: var(--xd-fg);\r\n  white-space: pre-wrap;\r\n  overflow-wrap: anywhere;\r\n}\r\n\r\n.xd-spotlight-metrics {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 0.5rem;\r\n}\r\n\r\n.xd-metric-chip {\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.65rem;\r\n  font-variant-numeric: tabular-nums;\r\n  padding: 0.1rem 0.4rem;\r\n  border-radius: 0.25rem;\r\n  background: var(--xd-surface);\r\n  border: 1px solid var(--xd-border);\r\n  color: var(--xd-text-secondary);\r\n}\r\n\r\n/* ── Honcho-Style Text Tabs & Explorer Toolbar ──────────────────────── */\r\n.xd-tabs-bar {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.75rem;\r\n  border-bottom: 1px solid var(--xd-border);\r\n  padding-bottom: 0.4rem;\r\n}\r\n\r\n.xd-tab-buttons {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 0.75rem;\r\n}\r\n\r\n.xd-tab-btn {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.35rem;\r\n  height: 1.75rem;\r\n  padding: 0 0.25rem;\r\n  background: transparent;\r\n  border: none;\r\n  border-bottom: 2px solid transparent;\r\n  color: var(--xd-text-tertiary);\r\n  font-family: var(--xd-font-sans);\r\n  font-size: var(--xd-caption-size);\r\n  font-weight: 500;\r\n  cursor: pointer;\r\n  transition: color 0.12s ease, border-color 0.12s ease;\r\n}\r\n\r\n.xd-tab-btn:hover {\r\n  color: var(--xd-fg);\r\n}\r\n\r\n.xd-tab-btn.is-active {\r\n  color: var(--xd-fg);\r\n  border-bottom-color: var(--xd-fg);\r\n}\r\n\r\n.xd-tab-count {\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.65rem;\r\n  font-variant-numeric: tabular-nums;\r\n  color: var(--xd-text-tertiary);\r\n}\r\n\r\n.xd-explorer-toolbar {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.5rem;\r\n}\r\n\r\n.xd-search-input {\r\n  flex: 1;\r\n  min-width: 180px;\r\n  height: 1.75rem;\r\n  background: var(--xd-bg);\r\n  border: 1px solid var(--xd-stroke);\r\n  border-radius: 0.375rem;\r\n  padding: 0 0.6rem;\r\n  color: var(--xd-fg);\r\n  font-family: var(--xd-font-sans);\r\n  font-size: 0.75rem;\r\n  outline: none;\r\n}\r\n\r\n.xd-search-input::placeholder {\r\n  color: var(--xd-text-tertiary);\r\n}\r\n\r\n.xd-search-input:focus {\r\n  border-color: var(--xd-accent);\r\n}\r\n\r\n.xd-filter-pills {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  padding: 2px;\r\n  border-radius: 0.375rem;\r\n  background: color-mix(in srgb, var(--xd-fg) 5%, transparent);\r\n  border: 1px solid var(--xd-border);\r\n  gap: 1px;\r\n}\r\n\r\n.xd-filter-pill {\r\n  height: 1.375rem;\r\n  padding: 0 0.5rem;\r\n  border-radius: 0.25rem;\r\n  font-family: var(--xd-font-sans);\r\n  font-size: 0.68rem;\r\n  font-weight: 500;\r\n  background: transparent;\r\n  border: none;\r\n  color: var(--xd-text-tertiary);\r\n  cursor: pointer;\r\n}\r\n\r\n.xd-filter-pill:hover {\r\n  color: var(--xd-fg);\r\n}\r\n\r\n.xd-filter-pill.is-active {\r\n  background: var(--xd-surface);\r\n  color: var(--xd-fg);\r\n}\r\n\r\n.xd-sort-select {\r\n  height: 1.75rem;\r\n  background: var(--xd-bg);\r\n  border: 1px solid var(--xd-stroke);\r\n  border-radius: 0.375rem;\r\n  padding: 0 0.5rem;\r\n  color: var(--xd-fg);\r\n  font-family: var(--xd-font-sans);\r\n  font-size: 0.72rem;\r\n  outline: none;\r\n}\r\n\r\n/* ── Feed List & Hairline Post Rows ─────────────────────────────────── */\r\n.xd-feed-list {\r\n  display: flex;\r\n  flex-direction: column;\r\n}\r\n\r\n.xd-post-card {\r\n  padding: 0.75rem 0;\r\n  border-bottom: 1px solid var(--xd-border);\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.4rem;\r\n}\r\n\r\n.xd-post-card:last-child {\r\n  border-bottom: none;\r\n  padding-bottom: 0.15rem;\r\n}\r\n\r\n.xd-post-top {\r\n  display: flex;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.5rem;\r\n  font-size: 0.7rem;\r\n  color: var(--xd-text-tertiary);\r\n  font-variant-numeric: tabular-nums;\r\n}\r\n\r\n.xd-post-top strong {\r\n  color: var(--xd-fg);\r\n  font-weight: 600;\r\n}\r\n\r\n.xd-post-text {\r\n  margin: 0;\r\n  font-size: var(--xd-text-size);\r\n  line-height: 1.5;\r\n  color: var(--xd-fg);\r\n  white-space: pre-wrap;\r\n  word-break: break-word;\r\n  max-width: 82ch;\r\n}\r\n\r\n.xd-entity {\r\n  color: var(--xd-accent);\r\n  font-weight: 500;\r\n}\r\n\r\n.xd-post-footer {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.5rem;\r\n  padding-top: 0.1rem;\r\n}\r\n\r\n.xd-post-metrics {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  gap: 0.75rem;\r\n  font-family: var(--xd-font-mono);\r\n  font-size: 0.68rem;\r\n  font-variant-numeric: tabular-nums;\r\n  color: var(--xd-text-tertiary);\r\n}\r\n\r\n.xd-post-metrics strong {\r\n  color: var(--xd-text-secondary);\r\n  font-weight: 600;\r\n}\r\n\r\n.xd-external-link {\r\n  font-size: 0.7rem;\r\n  font-weight: 500;\r\n  color: var(--xd-accent);\r\n  text-decoration: none;\r\n}\r\n\r\n.xd-external-link:hover {\r\n  text-decoration: underline;\r\n}\r\n\r\n/* ── Connection & Auth Sources Inspector ────────────────────────────── */\r\n.xd-auth-grid {\r\n  display: grid;\r\n  grid-template-columns: repeat(3, minmax(0, 1fr));\r\n  gap: 0.625rem;\r\n  padding: 0.25rem 0 0.5rem;\r\n}\r\n\r\n.xd-root[data-layout="compact"] .xd-auth-grid,\r\n.xd-root[data-layout="narrow"] .xd-auth-grid {\r\n  grid-template-columns: 1fr;\r\n}\r\n\r\n@media (max-width: 880px) {\r\n  .xd-auth-grid {\r\n    grid-template-columns: 1fr;\r\n  }\r\n}\r\n\r\n.xd-auth-card {\r\n  border-radius: 0.375rem;\r\n  padding: 0.65rem 0.75rem;\r\n  background: var(--xd-surface-subtle);\r\n  border: 1px solid var(--xd-border);\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.25rem;\r\n}\r\n\r\n.xd-auth-card.is-detected {\r\n  border-color: color-mix(in srgb, var(--xd-emerald) 35%, var(--xd-border));\r\n}\r\n\r\n/* ── Footer Telemetry Line ──────────────────────────────────────────── */\r\n.xd-footer-bar {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  gap: 0.5rem;\r\n  padding-top: 0.5rem;\r\n  font-size: 0.625rem;\r\n  color: var(--xd-text-tertiary);\r\n  border-top: 1px solid var(--xd-border);\r\n  font-variant-numeric: tabular-nums;\r\n}\r\n';
function computePostEngagementRate(post) {
  if (typeof post.engagement_rate === "number" && !Number.isNaN(post.engagement_rate)) {
    return post.engagement_rate;
  }
  const impressions = Math.max(0, post.impressions ?? 0);
  const interactions = (post.likes ?? 0) + (post.reposts ?? 0) + (post.replies ?? 0) + (post.quotes ?? 0) + (post.bookmarks ?? 0);
  if (impressions <= 0) {
    return interactions > 0 ? Math.min(100, Number((interactions * 0.45).toFixed(2))) : 0;
  }
  return Number((interactions / impressions * 100).toFixed(2));
}
function computeAnalyticsFromPosts(posts, partial, fallbackImpressions) {
  let totalImpressions = 0;
  let totalLikes = 0;
  let totalReposts = 0;
  let totalReplies = 0;
  let totalBookmarks = 0;
  let totalQuotes = 0;
  const postingByHour = Array.from({ length: 24 }, () => 0);
  const impressionsByHour = Array.from({ length: 24 }, () => 0);
  const postingByDay = {};
  let bestPost = null;
  let bestScore = -1;
  for (const p of posts) {
    const imp = Math.max(0, p.impressions || 0);
    const likes = Math.max(0, p.likes || 0);
    const reposts = Math.max(0, p.reposts || 0);
    const replies = Math.max(0, p.replies || 0);
    const bookmarks = Math.max(0, p.bookmarks || 0);
    const quotes = Math.max(0, p.quotes || 0);
    totalImpressions += imp;
    totalLikes += likes;
    totalReposts += reposts;
    totalReplies += replies;
    totalBookmarks += bookmarks;
    totalQuotes += quotes;
    const score = imp + (likes + reposts * 2 + replies * 1.5 + bookmarks * 2 + quotes * 2) * 25;
    if (score > bestScore) {
      bestScore = score;
      bestPost = p;
    }
    if (p.created_at) {
      const dt = new Date(p.created_at);
      if (!Number.isNaN(dt.getTime())) {
        const hr = dt.getUTCHours();
        postingByHour[hr] = (postingByHour[hr] || 0) + 1;
        impressionsByHour[hr] = (impressionsByHour[hr] || 0) + imp;
        const dayKey = p.created_at.slice(0, 10);
        postingByDay[dayKey] = (postingByDay[dayKey] || 0) + 1;
      }
    }
  }
  const finalImpressions = partial?.total_impressions ?? (totalImpressions || fallbackImpressions || 0);
  const finalLikes = partial?.total_likes ?? totalLikes;
  const finalReposts = partial?.total_reposts ?? totalReposts;
  const finalReplies = partial?.total_replies ?? totalReplies;
  const finalBookmarks = partial?.total_bookmarks ?? totalBookmarks;
  const finalQuotes = partial?.total_quotes ?? totalQuotes;
  const totalEngagements = finalLikes + finalReposts + finalReplies + finalBookmarks + finalQuotes;
  const computedAvgRate = finalImpressions > 0 ? Number((totalEngagements / finalImpressions * 100).toFixed(2)) : posts.length > 0 ? Number(
    (posts.reduce((acc, item) => acc + computePostEngagementRate(item), 0) / posts.length).toFixed(2)
  ) : 0;
  const normalizedHourCounts = Array.isArray(partial?.posting_by_hour) && partial.posting_by_hour.length === 24 ? partial.posting_by_hour : postingByHour;
  return {
    total_impressions: finalImpressions,
    total_likes: finalLikes,
    total_reposts: finalReposts,
    total_replies: finalReplies,
    total_bookmarks: finalBookmarks,
    total_quotes: finalQuotes,
    avg_engagement_rate: typeof partial?.avg_engagement_rate === "number" ? Number(partial.avg_engagement_rate.toFixed(2)) : computedAvgRate,
    top_post: partial?.top_post ?? bestPost,
    posting_by_hour: normalizedHourCounts,
    impressions_by_hour: impressionsByHour,
    posting_by_day: partial?.posting_by_day ?? postingByDay
  };
}
function normalizeSummaryPayload(raw) {
  const rawAccount = raw.account ?? {};
  const rawStatus = raw.status ?? {};
  const handle = rawStatus.handle || rawAccount.username || "NousResearch";
  const rawPosts = Array.isArray(raw.posts?.items) ? raw.posts.items : [];
  const posts = rawPosts.map((p, idx) => ({
    id: String(p.id || `post-${idx}`),
    text: p.text || "",
    created_at: p.created_at || (/* @__PURE__ */ new Date()).toISOString(),
    created_timestamp: p.created_timestamp,
    lang: p.lang,
    impressions: Number(p.impressions || 0),
    likes: Number(p.likes || 0),
    reposts: Number(p.reposts || 0),
    replies: Number(p.replies || 0),
    quotes: Number(p.quotes || 0),
    bookmarks: Number(p.bookmarks || 0),
    engagement_rate: computePostEngagementRate(p),
    url: p.url || `https://x.com/${handle}/status/${p.id || idx}`,
    replying_to: p.replying_to,
    media: Array.isArray(p.media) ? p.media : []
  }));
  const rawMentions = Array.isArray(raw.mentions?.items) ? raw.mentions.items : [];
  const mentions = rawMentions.map((m, idx) => ({
    id: String(m.id || `mention-${idx}`),
    text: m.text || "",
    created_at: m.created_at || (/* @__PURE__ */ new Date()).toISOString(),
    author_username: m.author_username || "unknown",
    author_name: m.author_name || m.author_username || "X User",
    author_avatar: m.author_avatar,
    author_followers: m.author_followers,
    impressions: Number(m.impressions || 0),
    likes: Number(m.likes || 0),
    reposts: Number(m.reposts || 0),
    replies: Number(m.replies || 0),
    url: m.url || `https://x.com/${m.author_username || "i"}/status/${m.id || idx}`
  }));
  const defaultAuthSources = [
    {
      id: "xurl",
      label: "xurl CLI (`xurl auth status`)",
      detected: Boolean(rawStatus.xurl_available),
      handle: rawStatus.xurl_available ? handle : void 0,
      detail: rawStatus.xurl_available ? "xurl CLI session linked" : "Not detected on PATH"
    },
    {
      id: "x_bearer",
      label: "X API v2 Bearer Token (`X_BEARER_TOKEN`)",
      detected: Boolean(rawStatus.xchat_configured),
      handle: rawStatus.xchat_configured ? handle : void 0,
      detail: rawStatus.xchat_configured ? "Scoped X_BEARER_TOKEN configured" : "Not configured"
    },
    {
      id: "public_free",
      label: "Zero-Cost Public Syndication & Cache",
      detected: true,
      handle,
      detail: "100% Free ($0.00) · Zero API keys required"
    }
  ];
  const status = {
    connected: rawStatus.connected ?? Boolean(rawAccount.ok ?? true),
    auto_linked: rawStatus.auto_linked ?? rawAccount.auto_linked ?? Boolean(rawStatus.xurl_available || rawStatus.xchat_configured),
    active_source: rawStatus.active_source || rawAccount.source_mode || (rawStatus.xurl_available ? "xurl" : rawStatus.xchat_configured ? "xchat" : "public_free"),
    auth_sources: Array.isArray(rawStatus.auth_sources) && rawStatus.auth_sources.length > 0 ? rawStatus.auth_sources : defaultAuthSources,
    handle,
    available_handles: Array.isArray(rawStatus.available_handles) && rawStatus.available_handles.length > 0 ? rawStatus.available_handles : [handle],
    x_search_available: Boolean(rawStatus.x_search_available),
    xurl_available: Boolean(rawStatus.xurl_available),
    xchat_configured: Boolean(rawStatus.xchat_configured),
    mode: rawStatus.mode === "free" || rawStatus.mode === "live_v2" || rawStatus.mode === "auto" ? rawStatus.mode : "auto",
    cost_policy: rawStatus.cost_policy || "$0.00 Free Mode by default — uses public syndication & local cache without burning X API credits",
    cache_updated_at: rawStatus.cache_updated_at || rawAccount.fetched_at
  };
  const account = {
    ok: rawAccount.ok ?? true,
    id: rawAccount.id,
    username: rawAccount.username || handle,
    name: rawAccount.name || `@${handle}`,
    description: rawAccount.description || "",
    profile_image_url: rawAccount.profile_image_url,
    banner_url: rawAccount.banner_url,
    location: rawAccount.location,
    website: rawAccount.website,
    created_at: rawAccount.created_at,
    subscription_type: rawAccount.subscription_type || (rawAccount.verified ? "Premium" : "Standard"),
    verified: Boolean(rawAccount.verified || (rawAccount.verified_followers_count ?? 0) > 0),
    verified_type: rawAccount.verified_type,
    followers_count: Number(rawAccount.followers_count || 0),
    following_count: Number(rawAccount.following_count || 0),
    tweet_count: Number(rawAccount.tweet_count || posts.length || 0),
    listed_count: Number(rawAccount.listed_count || 0),
    media_count: Number(rawAccount.media_count || posts.filter((p) => (p.media?.length ?? 0) > 0).length),
    likes_count: Number(rawAccount.likes_count || 0),
    verified_followers_count: Number(rawAccount.verified_followers_count || 0),
    verified_followers_cached: Boolean(rawAccount.verified_followers_cached),
    source_mode: rawAccount.source_mode || status.active_source,
    cost_incurred: rawAccount.cost_incurred || "$0.00",
    auto_linked: rawAccount.auto_linked ?? status.auto_linked,
    fetched_at: rawAccount.fetched_at || status.cache_updated_at,
    error: rawAccount.error
  };
  const analytics = computeAnalyticsFromPosts(
    posts,
    raw.analytics,
    raw.recent_posts_impressions
  );
  const history = Array.isArray(raw.history) ? raw.history : [];
  const goals = {
    verified_followers: Number(raw.goals?.verified_followers || 500),
    impressions: Number(raw.goals?.impressions || 5e5)
  };
  return {
    status,
    account,
    posts,
    mentions,
    analytics,
    history,
    goals
  };
}
const PLUGIN_API_PREFIX = "/api/plugins/x-dashboard";
let configuredHost = null;
function configureXDashboardHost(host2) {
  configuredHost = host2;
}
function getDefaultHost() {
  const sdk = typeof window !== "undefined" ? window.__HERMES_PLUGIN_SDK__ : void 0;
  const sdkFetch = sdk && typeof sdk.fetchJSON === "function" ? sdk.fetchJSON.bind(sdk) : null;
  return {
    fetchJSON: async (url, init) => {
      if (sdkFetch) {
        return sdkFetch(url, init);
      }
      const res = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...init?.headers || {}
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    navigateTo: (routePath) => {
      if (typeof window !== "undefined" && window.location) {
        window.location.assign(routePath);
      }
    }
  };
}
function getHost() {
  return configuredHost ?? getDefaultHost();
}
function fetchJSON(url, init) {
  return getHost().fetchJSON(url, init);
}
function buildQuery(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== void 0 && v !== "") {
      sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
async function loadDashboardData(options) {
  const qs = buildQuery({
    handle: options?.handle,
    mode: options?.mode ?? "auto",
    refresh: options?.refresh ? "true" : "false"
  });
  const summaryRes = await fetchJSON(`${PLUGIN_API_PREFIX}/summary${qs}`);
  const hasUnifiedAccount = summaryRes && typeof summaryRes === "object" && summaryRes.account && typeof summaryRes.account === "object" && ("username" in summaryRes.account || "followers_count" in summaryRes.account);
  const hasUnifiedPosts = summaryRes && typeof summaryRes === "object" && summaryRes.posts && Array.isArray(summaryRes.posts.items);
  if (hasUnifiedAccount && hasUnifiedPosts) {
    return normalizeSummaryPayload(summaryRes);
  }
  const sliceQs = buildQuery({
    handle: options?.handle,
    mode: options?.mode,
    refresh: options?.refresh ? "true" : void 0
  });
  const [accountRes, postsRes, mentionsRes, statusRes] = await Promise.all([
    hasUnifiedAccount ? Promise.resolve(summaryRes.account) : fetchJSON(`${PLUGIN_API_PREFIX}/account${sliceQs}`).catch(
      (err) => ({ ok: false, error: String(err) })
    ),
    hasUnifiedPosts ? Promise.resolve(summaryRes.posts) : fetchJSON(
      `${PLUGIN_API_PREFIX}/posts${buildQuery({
        handle: options?.handle,
        limit: 20,
        refresh: options?.refresh ? "true" : void 0
      })}`
    ).catch(() => ({ ok: false, items: [] })),
    summaryRes?.mentions && Array.isArray(summaryRes.mentions.items) ? Promise.resolve(summaryRes.mentions) : fetchJSON(
      `${PLUGIN_API_PREFIX}/mentions${buildQuery({
        handle: options?.handle,
        limit: 15,
        refresh: options?.refresh ? "true" : void 0
      })}`
    ).catch(() => ({ ok: false, items: [] })),
    summaryRes?.status ? Promise.resolve(summaryRes.status) : fetchJSON(`${PLUGIN_API_PREFIX}/status${sliceQs}`).catch(() => ({}))
  ]);
  return normalizeSummaryPayload({
    ...summaryRes,
    account: accountRes,
    posts: postsRes,
    mentions: mentionsRes,
    status: statusRes
  });
}
async function saveDashboardConfig(update) {
  return fetchJSON(`${PLUGIN_API_PREFIX}/config`, {
    method: "POST",
    body: JSON.stringify(update)
  });
}
const READABLE_TOKENS = {
  "--ui-text-secondary": "color-mix(in srgb, var(--foreground, currentColor) 76%, transparent)",
  "--ui-text-tertiary": "color-mix(in srgb, var(--foreground, currentColor) 58%, transparent)"
};
function ensureXDashboardStyles() {
  if (typeof document === "undefined" || !document.head) return;
  const existing = document.getElementById("x-dashboard-styles");
  if (!existing) {
    const style = document.createElement("style");
    style.id = "x-dashboard-styles";
    style.textContent = xDashboardCss;
    document.head.appendChild(style);
  }
}
function formatCompactNumber(n) {
  const val = Number(n || 0);
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e4) return `${(val / 1e3).toFixed(1)}K`;
  return val.toLocaleString();
}
function formatRelativeTime(iso) {
  if (!iso) return "just now";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso.slice(0, 10);
  const diffSec = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1e3));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return dt.toISOString().slice(0, 10);
}
function safeExternalUrl(raw, fallback) {
  const candidate = (raw || "").trim() || (fallback || "").trim();
  if (!candidate) return null;
  if (candidate.startsWith("https://") || candidate.startsWith("http://")) {
    return candidate;
  }
  if (/^[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/.*)?$/.test(candidate)) {
    return `https://${candidate}`;
  }
  return fallback && (fallback.startsWith("https://") || fallback.startsWith("http://")) ? fallback : null;
}
function escapeCsvCell(raw) {
  const cr = String.fromCharCode(13);
  const lf = String.fromCharCode(10);
  const cleaned = String(raw || "").split(cr + lf).join(" ").split(cr).join(" ").split(lf).join(" ").replace(/"/g, '""');
  const safeFormula = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${safeFormula}"`;
}
function highlightEntities(text) {
  if (!text) return [];
  const parts = text.split(/(https?:\/\/\S+|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("@") || part.startsWith("#")) {
      return /* @__PURE__ */ jsx("span", { className: "xd-entity", children: part }, idx);
    }
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return /* @__PURE__ */ jsx(
        "a",
        {
          href: part,
          target: "_blank",
          rel: "noreferrer",
          className: "xd-external-link",
          children: part
        },
        idx
      );
    }
    return part;
  });
}
function getEngagementTier(rate) {
  if (rate >= 3) return { label: "Elite >3%", className: "xd-kpi-pill is-emerald" };
  if (rate >= 1.5) return { label: "Strong >1.5%", className: "xd-kpi-pill" };
  return { label: "Steady", className: "xd-kpi-pill is-amber" };
}
function Sparkline({
  values,
  color = "var(--xd-accent)"
}) {
  const pts = values.length >= 2 ? values : [10, 12, 11, 14, 15, 18];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1, max - min);
  const width = 54;
  const height = 16;
  const coords = pts.map((v, i) => {
    const x = i / (pts.length - 1) * width;
    const y = height - 2 - (v - min) / span * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return /* @__PURE__ */ jsx("svg", { className: "xd-sparkline", viewBox: `0 0 ${width} ${height}`, "aria-hidden": "true", children: /* @__PURE__ */ jsx(
    "polyline",
    {
      fill: "none",
      stroke: color,
      strokeWidth: "1.75",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      points: coords.join(" ")
    }
  ) });
}
function RadialGauge({
  value,
  goal,
  color = "var(--xd-accent)"
}) {
  const safeGoal = Math.max(1, goal);
  const pct = Math.min(100, Math.max(0, value / safeGoal * 100));
  const r = 21;
  const c = 2 * Math.PI * r;
  const offset = c - pct / 100 * c;
  return /* @__PURE__ */ jsxs("div", { className: "xd-goal-radial", children: [
    /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 52 52", children: [
      /* @__PURE__ */ jsx(
        "circle",
        {
          className: "xd-goal-radial-track",
          cx: "26",
          cy: "26",
          r,
          fill: "none",
          strokeWidth: "5"
        }
      ),
      /* @__PURE__ */ jsx(
        "circle",
        {
          cx: "26",
          cy: "26",
          r,
          fill: "none",
          stroke: color,
          strokeWidth: "5",
          strokeLinecap: "round",
          strokeDasharray: c.toFixed(2),
          strokeDashoffset: offset.toFixed(2)
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "xd-goal-radial-pct", children: [
      pct.toFixed(0),
      "%"
    ] })
  ] });
}
function XDashboardPage() {
  useEffect(() => {
    ensureXDashboardStyles();
  }, []);
  const rootRef = useRef(null);
  const [layout, setLayout] = useState("wide");
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const update = (width) => {
      if (width > 0 && width < 520) setLayout("narrow");
      else if (width > 0 && width < 820) setLayout("compact");
      else setLayout("wide");
    };
    update(node.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width ?? node.getBoundingClientRect().width;
      update(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [handleInput, setHandleInput] = useState("");
  const [activeMode, setActiveMode] = useState("auto");
  const [activeTab, setActiveTab] = useState("posts");
  const [searchQuery, setSearchQuery] = useState("");
  const [postFilter, setPostFilter] = useState("all");
  const [postSort, setPostSort] = useState(
    "latest"
  );
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);
  const [editingFollowersGoal, setEditingFollowersGoal] = useState(false);
  const [followersGoalInput, setFollowersGoalInput] = useState("500");
  const [editingImpressionsGoal, setEditingImpressionsGoal] = useState(false);
  const [impressionsGoalInput, setImpressionsGoalInput] = useState("500000");
  const [statusNotice, setStatusNotice] = useState(null);
  const fetchDashboard = useCallback(
    async (opts) => {
      setLoading(true);
      setError(null);
      try {
        const result = await loadDashboardData({
          handle: opts?.handle !== void 0 ? opts.handle : handleInput || void 0,
          mode: opts?.mode ?? activeMode,
          refresh: opts?.refresh ?? false
        });
        setData(result);
        if (!handleInput && result.status.handle) {
          setHandleInput(result.status.handle);
        }
        setFollowersGoalInput(String(result.goals.verified_followers || 500));
        setImpressionsGoalInput(String(result.goals.impressions || 5e5));
        setSelectedPostIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [handleInput, activeMode]
  );
  useEffect(() => {
    void fetchDashboard({ refresh: false });
  }, []);
  const handleSwitchSubmit = async (e) => {
    e.preventDefault();
    const cleaned = handleInput.trim().replace(/^@+/, "");
    if (!cleaned) return;
    setHandleInput(cleaned);
    await saveDashboardConfig({ handle: cleaned, mode: activeMode }).catch(() => void 0);
    await fetchDashboard({ handle: cleaned, mode: activeMode, refresh: false });
  };
  const handleSaveGoal = async (kind, rawVal) => {
    const parsed = Math.max(10, parseInt(rawVal.replace(/,/g, ""), 10) || 0);
    if (!data) return;
    const updatedGoals = {
      ...data.goals,
      [kind]: parsed
    };
    setData({
      ...data,
      goals: updatedGoals
    });
    if (kind === "verified_followers") {
      setEditingFollowersGoal(false);
      setFollowersGoalInput(String(parsed));
    } else {
      setEditingImpressionsGoal(false);
      setImpressionsGoalInput(String(parsed));
    }
    await saveDashboardConfig({ goals: updatedGoals }).catch(() => void 0);
    setStatusNotice(`Saved ${kind === "verified_followers" ? "Verified Followers" : "Impressions"} target (${parsed.toLocaleString()})`);
    setTimeout(() => setStatusNotice(null), 3500);
  };
  const handleExport = (format) => {
    if (!data) return;
    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `x-dashboard-${data.status.handle}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusNotice("Exported telemetry JSON");
    } else {
      const headers = ["id", "created_at", "impressions", "likes", "reposts", "replies", "bookmarks", "engagement_rate", "text"];
      const rows = data.posts.map((p) => [
        p.id,
        p.created_at,
        p.impressions,
        p.likes,
        p.reposts,
        p.replies,
        p.bookmarks,
        computePostEngagementRate(p),
        escapeCsvCell(p.text)
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `x-posts-${data.status.handle}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusNotice("Exported posts CSV");
    }
    setTimeout(() => setStatusNotice(null), 3e3);
  };
  const account = data?.account;
  const status = data?.status;
  const posts = data?.posts ?? [];
  const mentions = data?.mentions ?? [];
  const analytics = data?.analytics;
  const goals = data?.goals ?? { verified_followers: 500, impressions: 5e5 };
  const history = data?.history ?? [];
  const handle = status?.handle || account?.username || "NousResearch";
  const followers = account?.followers_count ?? 0;
  const following = account?.following_count ?? 0;
  const verifiedFollowers = account?.verified_followers_count ?? 0;
  const followRatio = following > 0 ? (followers / following).toFixed(2) : followers > 0 ? "∞" : "0.0";
  const followerDelta = history.length >= 2 ? followers - (history[0]?.followers_count ?? followers) : 0;
  const recentImpressions = analytics?.total_impressions ?? 0;
  const avgImpressionsPerPost = posts.length > 0 ? Math.round(recentImpressions / posts.length) : 0;
  const avgEngagementRate = analytics?.avg_engagement_rate ?? 0;
  const engagementTier = getEngagementTier(avgEngagementRate);
  const totalInteractions = (analytics?.total_likes ?? 0) + (analytics?.total_reposts ?? 0) + (analytics?.total_replies ?? 0) + (analytics?.total_bookmarks ?? 0) + (analytics?.total_quotes ?? 0);
  const replyPostsCount = posts.filter(
    (p) => Boolean(p.replying_to) || p.text.trim().startsWith("@")
  ).length;
  const mediaPostsCount = posts.filter(
    (p) => Array.isArray(p.media) && p.media.length > 0
  ).length;
  const originalPostsCount = Math.max(0, posts.length - replyPostsCount);
  const replyRatioPct = posts.length > 0 ? Math.round(replyPostsCount / posts.length * 100) : 0;
  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((p) => {
      if (q && !p.text.toLowerCase().includes(q)) return false;
      const isReply = Boolean(p.replying_to) || p.text.trim().startsWith("@");
      const hasMedia = Array.isArray(p.media) && p.media.length > 0;
      if (postFilter === "originals" && isReply) return false;
      if (postFilter === "replies" && !isReply) return false;
      if (postFilter === "media" && !hasMedia) return false;
      return true;
    }).sort((a, b) => {
      if (postSort === "impressions") return (b.impressions || 0) - (a.impressions || 0);
      if (postSort === "likes") return (b.likes || 0) - (a.likes || 0);
      if (postSort === "engagement") {
        return computePostEngagementRate(b) - computePostEngagementRate(a);
      }
      return (b.created_at || "").localeCompare(a.created_at || "");
    });
  }, [posts, searchQuery, postFilter, postSort]);
  const chartPosts = useMemo(() => {
    const slice = posts.slice(0, 20).reverse();
    return slice;
  }, [posts]);
  const activeChartPost = chartPosts[selectedPostIndex] ?? chartPosts[chartPosts.length - 1] ?? posts[0];
  const peakHourInfo = useMemo(() => {
    const byHour = analytics?.posting_by_hour ?? Array.from({ length: 24 }, () => 0);
    const impByHour = analytics?.impressions_by_hour ?? Array.from({ length: 24 }, () => 0);
    let bestHr = 14;
    let bestVal = -1;
    for (let h = 0; h < 24; h++) {
      const score = (impByHour[h] || 0) + (byHour[h] || 0) * 100;
      if (score > bestVal) {
        bestVal = score;
        bestHr = h;
      }
    }
    return {
      byHour,
      impByHour,
      peakHourLabel: `${String(bestHr).padStart(2, "0")}:00 UTC`
    };
  }, [analytics]);
  const autoLinkLabel = useMemo(() => {
    if (!status) return `Auto-Linked via Hermes (@${handle})`;
    if (status.auto_linked) {
      const src = status.active_source === "xurl" ? "xurl OAuth2" : status.active_source === "xchat" ? "Hermes XChat" : status.active_source;
      return `Auto-Linked via Hermes (${src} · @${handle})`;
    }
    return `Public Free Mode (@${handle})`;
  }, [status, handle]);
  const mixItems = [
    { label: "Likes", val: analytics?.total_likes ?? 0, color: "var(--xd-rose)" },
    { label: "Reposts", val: analytics?.total_reposts ?? 0, color: "var(--xd-emerald)" },
    { label: "Replies", val: analytics?.total_replies ?? 0, color: "var(--xd-blue)" },
    { label: "Bookmarks", val: analytics?.total_bookmarks ?? 0, color: "var(--xd-yellow)" },
    { label: "Quotes", val: analytics?.total_quotes ?? 0, color: "var(--xd-purple)" }
  ];
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: rootRef,
      className: "xd-root xd-selectable",
      style: READABLE_TOKENS,
      "data-layout": layout,
      "data-selectable-text": "true",
      "data-testid": "x-dashboard-root",
      children: [
        /* @__PURE__ */ jsx("style", { children: xDashboardCss }),
        /* @__PURE__ */ jsxs("div", { className: "xd-container", children: [
          /* @__PURE__ */ jsxs("header", { className: "xd-page-header", "aria-label": "X Dashboard Header", children: [
            /* @__PURE__ */ jsxs("div", { className: "xd-page-title-group", children: [
              /* @__PURE__ */ jsxs("div", { className: "xd-page-title-row", children: [
                /* @__PURE__ */ jsx(
                  "svg",
                  {
                    className: "xd-page-icon",
                    viewBox: "0 0 16 16",
                    fill: "currentColor",
                    "aria-hidden": "true",
                    children: /* @__PURE__ */ jsx("path", { d: "M12.6 1h2.2L10 6.5 15.7 15h-4.4L7.8 9.9 3.6 15H1.4l5.1-5.9L1.1 1h4.5l3.1 4.6L12.6 1zm-.8 12.6h1.2L5.2 2.3H3.9l7.9 11.3z" })
                  }
                ),
                /* @__PURE__ */ jsx("h1", { className: "xd-page-title", children: "X Dashboard" }),
                /* @__PURE__ */ jsxs(
                  "span",
                  {
                    className: `xd-autolink-pill ${status?.auto_linked ? "is-linked" : ""}`,
                    "data-testid": "xd-autolink-pill",
                    children: [
                      /* @__PURE__ */ jsx(
                        "span",
                        {
                          className: `xd-status-dot ${status?.auto_linked ? "is-linked" : ""}`
                        }
                      ),
                      autoLinkLabel
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: "xd-zero-cost-badge",
                    title: "Default refreshes use zero-cost public syndication and local telemetry cache without burning X API credits.",
                    "data-testid": "xd-zero-cost-badge",
                    children: "⚡ $0.00 Free Mode Active"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "xd-page-subtitle", "data-selectable-text": "true", children: [
                /* @__PURE__ */ jsxs("span", { children: [
                  "@",
                  handle
                ] }),
                /* @__PURE__ */ jsx("span", { children: "·" }),
                /* @__PURE__ */ jsxs("span", { children: [
                  "Source: ",
                  status?.active_source || "public_free"
                ] }),
                status?.cache_updated_at ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("span", { children: "·" }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    "Synced ",
                    formatRelativeTime(status.cache_updated_at)
                  ] })
                ] }) : null,
                statusNotice ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("span", { children: "·" }),
                  /* @__PURE__ */ jsx("span", { style: { color: "var(--xd-emerald)", fontWeight: 500 }, children: statusNotice })
                ] }) : null
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "xd-header-toolbar", children: [
              /* @__PURE__ */ jsxs("form", { className: "xd-handle-form", onSubmit: handleSwitchSubmit, children: [
                /* @__PURE__ */ jsx("span", { className: "xd-handle-prefix", children: "@" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    className: "xd-handle-input",
                    value: handleInput,
                    onChange: (e) => setHandleInput(e.target.value),
                    placeholder: "switch handle...",
                    "aria-label": "X Handle",
                    "data-testid": "xd-handle-input"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "submit",
                    className: "xd-btn xd-btn-sm xd-btn-ghost",
                    disabled: loading,
                    "data-testid": "xd-switch-handle-btn",
                    children: "Switch"
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "xd-btn xd-btn-primary",
                  disabled: loading,
                  onClick: () => {
                    setActiveMode("free");
                    void fetchDashboard({ mode: "free", refresh: true });
                  },
                  "data-testid": "xd-refresh-free-btn",
                  children: loading ? "Syncing…" : "↻ Refresh ($0.00)"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "xd-btn xd-btn-live",
                  disabled: loading,
                  onClick: () => {
                    setActiveMode("live_v2");
                    void fetchDashboard({ mode: "live_v2", refresh: true });
                  },
                  title: "Sync verified_followers_count and owned metrics via local Hermes xurl/xchat OAuth2 token",
                  "data-testid": "xd-sync-v2-btn",
                  children: "⚡ Sync Official X API"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "xd-btn",
                  onClick: () => handleExport("json"),
                  title: "Export full dashboard snapshot as JSON",
                  children: "JSON"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "xd-btn",
                  onClick: () => handleExport("csv"),
                  title: "Export posts metrics as CSV",
                  children: "CSV"
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "section",
            {
              className: "xd-profile-strip",
              "aria-label": "X Profile Command Header",
              "data-selectable-text": "true",
              children: [
                /* @__PURE__ */ jsxs("div", { className: "xd-profile-row", children: [
                  /* @__PURE__ */ jsxs("div", { className: "xd-profile-identity", children: [
                    /* @__PURE__ */ jsxs("div", { className: "xd-avatar-wrap", children: [
                      account?.profile_image_url ? /* @__PURE__ */ jsx(
                        "img",
                        {
                          src: account.profile_image_url,
                          alt: account.name || handle,
                          className: "xd-avatar-img"
                        }
                      ) : /* @__PURE__ */ jsx("div", { className: "xd-avatar-fallback", children: (account?.name || handle).slice(0, 1).toUpperCase() }),
                      /* @__PURE__ */ jsx("span", { className: "xd-verified-badge", title: "Verified X Creator", children: "✓" })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "xd-profile-titles", children: [
                      /* @__PURE__ */ jsxs("div", { className: "xd-name-line", children: [
                        /* @__PURE__ */ jsx("h2", { className: "xd-display-name", children: account?.name || `@${handle}` }),
                        /* @__PURE__ */ jsx("span", { className: "xd-sub-badge", children: account?.subscription_type || "Premium" }),
                        account?.cost_incurred ? /* @__PURE__ */ jsxs("span", { className: "xd-kpi-pill is-emerald", children: [
                          "Cost: ",
                          account.cost_incurred
                        ] }) : null
                      ] }),
                      /* @__PURE__ */ jsxs(
                        "a",
                        {
                          href: `https://x.com/${handle}`,
                          target: "_blank",
                          rel: "noreferrer",
                          className: "xd-handle-link",
                          children: [
                            "@",
                            handle,
                            " ↗"
                          ]
                        }
                      )
                    ] })
                  ] }),
                  status?.available_handles && status.available_handles.length > 1 ? /* @__PURE__ */ jsxs("div", { className: "xd-profile-badges", children: [
                    /* @__PURE__ */ jsx("span", { className: "xd-label", children: "Detected:" }),
                    status.available_handles.map((h) => /* @__PURE__ */ jsxs(
                      "button",
                      {
                        type: "button",
                        className: "xd-btn xd-btn-sm",
                        onClick: () => {
                          setHandleInput(h);
                          void fetchDashboard({ handle: h, refresh: false });
                        },
                        children: [
                          "@",
                          h
                        ]
                      },
                      h
                    ))
                  ] }) : null
                ] }),
                account?.description ? /* @__PURE__ */ jsx("p", { className: "xd-bio-text", "data-selectable-text": "true", children: highlightEntities(account.description) }) : /* @__PURE__ */ jsxs("p", { className: "xd-bio-text", "data-selectable-text": "true", children: [
                  "Hermes Creator & Autonomous Agent Telemetry for @",
                  handle,
                  " — zero-key public analytics + optional local OAuth2 enrichment."
                ] }),
                account?.location || account?.website || account?.created_at ? /* @__PURE__ */ jsxs("div", { className: "xd-meta-strip", children: [
                  account?.location ? /* @__PURE__ */ jsxs("span", { className: "xd-meta-item", children: [
                    "📍 ",
                    account.location
                  ] }) : null,
                  safeExternalUrl(account?.website) ? /* @__PURE__ */ jsxs("span", { className: "xd-meta-item", children: [
                    "🔗",
                    " ",
                    /* @__PURE__ */ jsx(
                      "a",
                      {
                        href: safeExternalUrl(account?.website) || "#",
                        target: "_blank",
                        rel: "noreferrer",
                        children: (account?.website || "").replace(/^https?:\/\//, "")
                      }
                    )
                  ] }) : null,
                  account?.created_at ? /* @__PURE__ */ jsxs("span", { className: "xd-meta-item", children: [
                    "Joined ",
                    account.created_at.slice(0, 10)
                  ] }) : null
                ] }) : null
              ]
            }
          ),
          error ? /* @__PURE__ */ jsxs("div", { className: "xd-banner-alert", role: "alert", children: [
            /* @__PURE__ */ jsxs("span", { children: [
              "⚠️ Telemetry Warning: ",
              error
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "xd-btn xd-btn-sm",
                onClick: () => void fetchDashboard({ refresh: false }),
                children: "Retry"
              }
            )
          ] }) : null,
          /* @__PURE__ */ jsxs("section", { className: "xd-section", "aria-label": "Executive KPIs", children: [
            /* @__PURE__ */ jsxs("div", { className: "xd-section-header", children: [
              /* @__PURE__ */ jsx("span", { className: "xd-label", children: "Overview Telemetry" }),
              /* @__PURE__ */ jsxs("span", { className: "xd-caption xd-tabular", children: [
                posts.length,
                " indexed posts · ",
                mentions.length,
                " mentions"
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "xd-kpi-grid", children: [
              /* @__PURE__ */ jsxs("div", { className: "xd-kpi-card", "data-testid": "kpi-followers", children: [
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-top", children: [
                  /* @__PURE__ */ jsx("span", { className: "xd-kpi-label", children: "Total Followers" }),
                  /* @__PURE__ */ jsxs("span", { className: "xd-kpi-pill", children: [
                    followRatio,
                    "x Ratio"
                  ] })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "xd-kpi-value", children: followers.toLocaleString() }),
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-sub", children: [
                  /* @__PURE__ */ jsxs("span", { children: [
                    followerDelta >= 0 ? `+${followerDelta}` : followerDelta,
                    " vs history ·",
                    " ",
                    following.toLocaleString(),
                    " following"
                  ] }),
                  /* @__PURE__ */ jsx(
                    Sparkline,
                    {
                      values: history.length >= 2 ? history.map((h) => h.followers_count) : [
                        Math.max(0, followers - 18),
                        Math.max(0, followers - 12),
                        Math.max(0, followers - 7),
                        followers
                      ],
                      color: "var(--xd-accent)"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "xd-kpi-card", "data-testid": "kpi-verified-followers", children: [
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-top", children: [
                  /* @__PURE__ */ jsx("span", { className: "xd-kpi-label", children: "Verified Followers" }),
                  /* @__PURE__ */ jsx("span", { className: "xd-kpi-pill is-emerald", children: account?.verified_followers_cached || verifiedFollowers > 0 ? "X API Cached" : "Public Mode" })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "xd-kpi-value", children: verifiedFollowers.toLocaleString() }),
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-sub", children: [
                  /* @__PURE__ */ jsx("span", { children: followers > 0 ? `${(verifiedFollowers / followers * 100).toFixed(1)}% of audience` : "Target: 500 verified" }),
                  /* @__PURE__ */ jsxs("span", { style: { color: "var(--xd-emerald)", fontWeight: 600 }, children: [
                    Math.min(
                      100,
                      Math.round(
                        verifiedFollowers / Math.max(1, goals.verified_followers) * 100
                      )
                    ),
                    "%"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "xd-kpi-card", "data-testid": "kpi-impressions", children: [
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-top", children: [
                  /* @__PURE__ */ jsx("span", { className: "xd-kpi-label", children: "Recent Impressions" }),
                  /* @__PURE__ */ jsxs("span", { className: "xd-kpi-pill", children: [
                    formatCompactNumber(avgImpressionsPerPost),
                    " / post"
                  ] })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "xd-kpi-value", children: formatCompactNumber(recentImpressions) }),
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-sub", children: [
                  /* @__PURE__ */ jsxs("span", { children: [
                    "Across last ",
                    posts.length,
                    " posts"
                  ] }),
                  /* @__PURE__ */ jsx(
                    Sparkline,
                    {
                      values: chartPosts.length >= 2 ? chartPosts.map((p) => p.impressions) : [120, 340, 280, 610, 490],
                      color: "var(--xd-emerald)"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "xd-kpi-card", "data-testid": "kpi-engagement", children: [
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-top", children: [
                  /* @__PURE__ */ jsx("span", { className: "xd-kpi-label", children: "Engagement Rate" }),
                  /* @__PURE__ */ jsx("span", { className: engagementTier.className, children: engagementTier.label })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-value", children: [
                  avgEngagementRate.toFixed(2),
                  "%"
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-sub", children: [
                  /* @__PURE__ */ jsxs("span", { children: [
                    totalInteractions.toLocaleString(),
                    " total interactions"
                  ] }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    analytics?.total_bookmarks ?? 0,
                    " saves"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "xd-kpi-card", "data-testid": "kpi-posts", children: [
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-top", children: [
                  /* @__PURE__ */ jsx("span", { className: "xd-kpi-label", children: "Posts & Media" }),
                  /* @__PURE__ */ jsxs("span", { className: "xd-kpi-pill is-violet", children: [
                    account?.listed_count ?? 0,
                    " Listed"
                  ] })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "xd-kpi-value", children: (account?.tweet_count ?? posts.length).toLocaleString() }),
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-sub", children: [
                  /* @__PURE__ */ jsxs("span", { children: [
                    account?.media_count ?? mediaPostsCount,
                    " media posts"
                  ] }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    (account?.likes_count ?? analytics?.total_likes ?? 0).toLocaleString(),
                    " likes"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "xd-kpi-card", "data-testid": "kpi-community", children: [
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-top", children: [
                  /* @__PURE__ */ jsx("span", { className: "xd-kpi-label", children: "Community Pulse" }),
                  /* @__PURE__ */ jsx("span", { className: "xd-kpi-pill is-emerald", children: "Active Radar" })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "xd-kpi-value", children: mentions.length }),
                /* @__PURE__ */ jsxs("div", { className: "xd-kpi-sub", children: [
                  /* @__PURE__ */ jsx("span", { children: "Recent @mentions" }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    replyRatioPct,
                    "% reply cadence"
                  ] })
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "xd-section", "aria-label": "Creator Monetization Goals", children: [
            /* @__PURE__ */ jsx("div", { className: "xd-section-header", children: /* @__PURE__ */ jsx("span", { className: "xd-label", children: "Creator Monetization Goals" }) }),
            /* @__PURE__ */ jsxs("div", { className: "xd-goals-grid", children: [
              /* @__PURE__ */ jsxs("div", { className: "xd-goal-card", "data-testid": "goal-verified-followers", children: [
                /* @__PURE__ */ jsx(
                  RadialGauge,
                  {
                    value: verifiedFollowers,
                    goal: goals.verified_followers,
                    color: "var(--xd-accent)"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "xd-goal-content", children: [
                  /* @__PURE__ */ jsxs("div", { className: "xd-goal-header", children: [
                    /* @__PURE__ */ jsx("div", { className: "xd-goal-title", children: /* @__PURE__ */ jsx("span", { children: "Verified Followers Eligibility" }) }),
                    editingFollowersGoal ? /* @__PURE__ */ jsxs("div", { className: "xd-goal-edit-inline", children: [
                      /* @__PURE__ */ jsx(
                        "input",
                        {
                          type: "number",
                          className: "xd-goal-input",
                          value: followersGoalInput,
                          onChange: (e) => setFollowersGoalInput(e.target.value),
                          "aria-label": "Verified Followers Target"
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          className: "xd-btn xd-btn-sm xd-btn-primary",
                          onClick: () => void handleSaveGoal("verified_followers", followersGoalInput),
                          children: "Save"
                        }
                      )
                    ] }) : /* @__PURE__ */ jsxs(
                      "button",
                      {
                        type: "button",
                        className: "xd-goal-target-btn",
                        onClick: () => setEditingFollowersGoal(true),
                        title: "Click to customize Verified Followers target",
                        children: [
                          "Target: ",
                          goals.verified_followers.toLocaleString(),
                          " ✎"
                        ]
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "xd-progress-track", children: /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "xd-progress-fill",
                      style: {
                        width: `${Math.min(
                          100,
                          verifiedFollowers / Math.max(1, goals.verified_followers) * 100
                        )}%`
                      }
                    }
                  ) }),
                  /* @__PURE__ */ jsxs("div", { className: "xd-goal-meta", children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      verifiedFollowers.toLocaleString(),
                      " /",
                      " ",
                      goals.verified_followers.toLocaleString(),
                      " verified"
                    ] }),
                    /* @__PURE__ */ jsxs("span", { children: [
                      Math.max(
                        0,
                        goals.verified_followers - verifiedFollowers
                      ).toLocaleString(),
                      " ",
                      "remaining"
                    ] })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "xd-goal-card", "data-testid": "goal-impressions", children: [
                /* @__PURE__ */ jsx(
                  RadialGauge,
                  {
                    value: recentImpressions,
                    goal: goals.impressions,
                    color: "var(--xd-emerald)"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "xd-goal-content", children: [
                  /* @__PURE__ */ jsxs("div", { className: "xd-goal-header", children: [
                    /* @__PURE__ */ jsx("div", { className: "xd-goal-title", children: /* @__PURE__ */ jsx("span", { children: "Organic Impressions Target" }) }),
                    editingImpressionsGoal ? /* @__PURE__ */ jsxs("div", { className: "xd-goal-edit-inline", children: [
                      /* @__PURE__ */ jsx(
                        "input",
                        {
                          type: "number",
                          className: "xd-goal-input",
                          value: impressionsGoalInput,
                          onChange: (e) => setImpressionsGoalInput(e.target.value),
                          "aria-label": "Impressions Target"
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          className: "xd-btn xd-btn-sm",
                          onClick: () => void handleSaveGoal("impressions", "500000"),
                          children: "500K"
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          className: "xd-btn xd-btn-sm",
                          onClick: () => void handleSaveGoal("impressions", "5000000"),
                          children: "5M"
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          className: "xd-btn xd-btn-sm xd-btn-primary",
                          onClick: () => void handleSaveGoal("impressions", impressionsGoalInput),
                          children: "Save"
                        }
                      )
                    ] }) : /* @__PURE__ */ jsxs(
                      "button",
                      {
                        type: "button",
                        className: "xd-goal-target-btn",
                        onClick: () => setEditingImpressionsGoal(true),
                        title: "Click to customize Impressions target (500K or 5M)",
                        children: [
                          "Target: ",
                          formatCompactNumber(goals.impressions),
                          " ✎"
                        ]
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "xd-progress-track", children: /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "xd-progress-fill is-emerald",
                      style: {
                        width: `${Math.min(
                          100,
                          recentImpressions / Math.max(1, goals.impressions) * 100
                        )}%`
                      }
                    }
                  ) }),
                  /* @__PURE__ */ jsxs("div", { className: "xd-goal-meta", children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      recentImpressions.toLocaleString(),
                      " /",
                      " ",
                      goals.impressions.toLocaleString(),
                      " impressions"
                    ] }),
                    /* @__PURE__ */ jsx("span", { children: avgImpressionsPerPost > 0 ? `~${Math.ceil(
                      Math.max(0, goals.impressions - recentImpressions) / avgImpressionsPerPost
                    )} posts at current velocity` : `${Math.max(
                      0,
                      goals.impressions - recentImpressions
                    ).toLocaleString()} remaining` })
                  ] })
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "xd-analytics-grid", "aria-label": "Visual Analytics Suite", children: [
            /* @__PURE__ */ jsxs("div", { className: "xd-panel", children: [
              /* @__PURE__ */ jsxs("div", { className: "xd-panel-header", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsxs("h2", { className: "xd-panel-title", children: [
                    "Impressions Trajectory (Last ",
                    chartPosts.length || 20,
                    " Posts)"
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "xd-panel-subtitle", children: "Click any bar to inspect reach, saves, and engagement rate" })
                ] }),
                /* @__PURE__ */ jsxs("span", { className: "xd-kpi-pill", children: [
                  "Peak:",
                  " ",
                  formatCompactNumber(
                    Math.max(0, ...chartPosts.map((p) => p.impressions || 0))
                  ),
                  " ",
                  "imp"
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "xd-chart-stage", children: chartPosts.length > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsxs(
                  "svg",
                  {
                    className: "xd-trajectory-svg",
                    viewBox: "0 0 680 185",
                    role: "img",
                    "aria-label": "Impressions and engagement trajectory chart",
                    children: [
                      [25, 70, 115, 160].map((y) => /* @__PURE__ */ jsx(
                        "line",
                        {
                          className: "xd-chart-grid-line",
                          x1: "8",
                          y1: y,
                          x2: "672",
                          y2: y,
                          strokeDasharray: "3 3"
                        },
                        y
                      )),
                      (() => {
                        const maxImp = Math.max(
                          1,
                          ...chartPosts.map((p) => p.impressions || 0)
                        );
                        const peakIdx = chartPosts.reduce(
                          (best, p, i) => (p.impressions || 0) > (chartPosts[best]?.impressions || 0) ? i : best,
                          0
                        );
                        const count = chartPosts.length;
                        const slotW = 656 / Math.max(1, count);
                        const barW = Math.max(8, Math.min(26, slotW * 0.64));
                        return /* @__PURE__ */ jsx(Fragment, { children: chartPosts.map((post, idx) => {
                          const x = 12 + idx * slotW + (slotW - barW) / 2;
                          const centerX = x + barW / 2;
                          const h = Math.max(
                            5,
                            (post.impressions || 0) / maxImp * 132
                          );
                          const y = 160 - h;
                          const isSelected = idx === selectedPostIndex;
                          const isPeak = idx === peakIdx && count > 1;
                          const dateStr = (post.created_at || "").slice(5, 10);
                          const prevDateStr = idx > 0 ? (chartPosts[idx - 1]?.created_at || "").slice(5, 10) : "";
                          const showDateLabel = Boolean(dateStr) && (idx === 0 || idx === count - 1 || isSelected || dateStr !== prevDateStr);
                          return /* @__PURE__ */ jsxs(
                            "g",
                            {
                              className: "xd-bar-group",
                              onMouseEnter: () => setSelectedPostIndex(idx),
                              onClick: () => setSelectedPostIndex(idx),
                              children: [
                                /* @__PURE__ */ jsx(
                                  "rect",
                                  {
                                    className: "xd-bar-hit",
                                    x,
                                    y: 20,
                                    width: barW,
                                    height: 140,
                                    fill: "transparent"
                                  }
                                ),
                                /* @__PURE__ */ jsx(
                                  "rect",
                                  {
                                    className: "xd-bar-rect",
                                    x,
                                    y,
                                    width: barW,
                                    height: h,
                                    rx: "3",
                                    fill: isSelected ? "var(--xd-emerald)" : "var(--xd-accent)",
                                    fillOpacity: isSelected ? 0.95 : 0.72
                                  }
                                ),
                                isSelected || isPeak ? /* @__PURE__ */ jsx(
                                  "text",
                                  {
                                    className: `xd-chart-value-label${isSelected ? " is-selected" : ""}`,
                                    x: centerX,
                                    y: Math.max(14, y - 5),
                                    textAnchor: "middle",
                                    children: formatCompactNumber(post.impressions || 0)
                                  }
                                ) : null,
                                showDateLabel ? /* @__PURE__ */ jsx(
                                  "text",
                                  {
                                    className: `xd-chart-axis-text${isSelected ? " is-selected" : ""}`,
                                    x: centerX,
                                    y: "176",
                                    textAnchor: "middle",
                                    children: dateStr
                                  }
                                ) : /* @__PURE__ */ jsx(
                                  "line",
                                  {
                                    className: "xd-chart-axis-tick",
                                    x1: centerX,
                                    y1: "162",
                                    x2: centerX,
                                    y2: "166"
                                  }
                                )
                              ]
                            },
                            post.id
                          );
                        }) });
                      })()
                    ]
                  }
                ),
                activeChartPost ? /* @__PURE__ */ jsxs(
                  "div",
                  {
                    className: "xd-chart-hud",
                    "data-testid": "xd-chart-hud",
                    "data-selectable-text": "true",
                    children: [
                      /* @__PURE__ */ jsxs("div", { className: "xd-chart-hud-text", children: [
                        /* @__PURE__ */ jsxs("strong", { children: [
                          (activeChartPost.created_at || "").slice(0, 10),
                          ":"
                        ] }),
                        " ",
                        activeChartPost.text
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "xd-chart-hud-metrics", children: [
                        /* @__PURE__ */ jsxs("span", { children: [
                          "👁 ",
                          activeChartPost.impressions.toLocaleString()
                        ] }),
                        /* @__PURE__ */ jsxs("span", { children: [
                          "♥ ",
                          activeChartPost.likes.toLocaleString()
                        ] }),
                        /* @__PURE__ */ jsxs("span", { children: [
                          "↻ ",
                          activeChartPost.reposts.toLocaleString()
                        ] }),
                        /* @__PURE__ */ jsxs("span", { children: [
                          "💬 ",
                          activeChartPost.replies.toLocaleString()
                        ] }),
                        /* @__PURE__ */ jsxs("span", { children: [
                          "🔖 ",
                          (activeChartPost.bookmarks || 0).toLocaleString()
                        ] }),
                        /* @__PURE__ */ jsxs("span", { children: [
                          "⚡ ",
                          computePostEngagementRate(activeChartPost),
                          "%"
                        ] })
                      ] })
                    ]
                  }
                ) : null
              ] }) : /* @__PURE__ */ jsx("div", { className: "xd-chart-hud", children: /* @__PURE__ */ jsxs("span", { children: [
                "No recent posts found for @",
                handle,
                " yet."
              ] }) }) }),
              analytics?.top_post ? /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "xd-spotlight-card",
                  "data-testid": "xd-top-post-spotlight",
                  "data-selectable-text": "true",
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "xd-spotlight-top", children: [
                      /* @__PURE__ */ jsx("span", { className: "xd-spotlight-badge", children: "#1 Top Performing Post Spotlight" }),
                      /* @__PURE__ */ jsx(
                        "a",
                        {
                          href: safeExternalUrl(
                            analytics.top_post.url,
                            `https://x.com/${handle}/status/${analytics.top_post.id}`
                          ) || `https://x.com/${handle}/status/${analytics.top_post.id}`,
                          target: "_blank",
                          rel: "noreferrer",
                          className: "xd-external-link",
                          children: "Open on X ↗"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "xd-spotlight-text", children: highlightEntities(analytics.top_post.text) }),
                    /* @__PURE__ */ jsxs("div", { className: "xd-spotlight-metrics", children: [
                      /* @__PURE__ */ jsxs("span", { className: "xd-metric-chip", children: [
                        "👁 ",
                        analytics.top_post.impressions.toLocaleString(),
                        " imp"
                      ] }),
                      /* @__PURE__ */ jsxs("span", { className: "xd-metric-chip", children: [
                        "♥ ",
                        analytics.top_post.likes.toLocaleString(),
                        " likes"
                      ] }),
                      /* @__PURE__ */ jsxs("span", { className: "xd-metric-chip", children: [
                        "↻ ",
                        analytics.top_post.reposts.toLocaleString(),
                        " reposts"
                      ] }),
                      /* @__PURE__ */ jsxs("span", { className: "xd-metric-chip", children: [
                        "💬 ",
                        analytics.top_post.replies.toLocaleString(),
                        " replies"
                      ] }),
                      /* @__PURE__ */ jsxs("span", { className: "xd-metric-chip", children: [
                        "🔖 ",
                        (analytics.top_post.bookmarks || 0).toLocaleString(),
                        " saves"
                      ] }),
                      /* @__PURE__ */ jsxs("span", { className: "xd-metric-chip", children: [
                        "⚡ ",
                        computePostEngagementRate(analytics.top_post),
                        "% ER"
                      ] })
                    ] })
                  ]
                }
              ) : null
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "xd-panel", children: [
              /* @__PURE__ */ jsxs("div", { className: "xd-panel-header", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("h2", { className: "xd-panel-title", children: "Engagement Mix & Cadence Rhythm" }),
                  /* @__PURE__ */ jsx("p", { className: "xd-panel-subtitle", children: "Interaction breakdown & 24-hour UTC distribution" })
                ] }),
                /* @__PURE__ */ jsxs("span", { className: "xd-kpi-pill is-emerald", children: [
                  "Peak: ",
                  peakHourInfo.peakHourLabel
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "xd-mix-stacked-bar", "aria-hidden": "true", children: mixItems.map((item) => {
                const pct = totalInteractions > 0 ? item.val / totalInteractions * 100 : 20;
                return /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      width: `${Math.max(2, pct)}%`,
                      background: item.color
                    }
                  },
                  item.label
                );
              }) }),
              /* @__PURE__ */ jsx("div", { className: "xd-mix-list", children: mixItems.map((item) => {
                const pct = totalInteractions > 0 ? Math.round(item.val / totalInteractions * 100) : 0;
                return /* @__PURE__ */ jsxs("div", { className: "xd-mix-row", children: [
                  /* @__PURE__ */ jsxs("span", { className: "xd-mix-label", children: [
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "xd-mix-dot",
                        style: { background: item.color }
                      }
                    ),
                    item.label
                  ] }),
                  /* @__PURE__ */ jsxs("span", { className: "xd-mix-val", children: [
                    item.val.toLocaleString(),
                    " · ",
                    pct,
                    "%"
                  ] })
                ] }, item.label);
              }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsxs("div", { className: "xd-panel-header", style: { marginBottom: 4 }, children: [
                  /* @__PURE__ */ jsx("span", { className: "xd-label", children: "24-Hour Posting Activity (UTC)" }),
                  /* @__PURE__ */ jsx("span", { className: "xd-caption", children: "00h → 23h" })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "xd-cadence-strip", "aria-label": "24-Hour Posting Activity", children: peakHourInfo.byHour.map((count, hr) => {
                  const maxCount = Math.max(1, ...peakHourInfo.byHour);
                  const heightPct = Math.max(8, Math.round(count / maxCount * 100));
                  return /* @__PURE__ */ jsxs(
                    "div",
                    {
                      className: "xd-cadence-col",
                      title: `${String(hr).padStart(2, "0")}:00 UTC — ${count} posts (${(peakHourInfo.impByHour[hr] || 0).toLocaleString()} impressions)`,
                      children: [
                        /* @__PURE__ */ jsx(
                          "div",
                          {
                            className: "xd-cadence-bar",
                            style: {
                              height: `${heightPct}%`,
                              opacity: count > 0 ? 0.9 : 0.18
                            }
                          }
                        ),
                        hr % 4 === 0 ? /* @__PURE__ */ jsx("span", { className: "xd-cadence-hr", children: String(hr).padStart(2, "0") }) : /* @__PURE__ */ jsx("span", { className: "xd-cadence-hr", children: " " })
                      ]
                    },
                    hr
                  );
                }) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "xd-breakdown-strip", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("div", { className: "xd-label", children: "Originals" }),
                  /* @__PURE__ */ jsx("div", { className: "xd-tabular", style: { fontWeight: 600, marginTop: 2 }, children: originalPostsCount })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("div", { className: "xd-label", children: "Replies" }),
                  /* @__PURE__ */ jsxs("div", { className: "xd-tabular", style: { fontWeight: 600, marginTop: 2 }, children: [
                    replyPostsCount,
                    " (",
                    replyRatioPct,
                    "%)"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("div", { className: "xd-label", children: "Media Posts" }),
                  /* @__PURE__ */ jsx("div", { className: "xd-tabular", style: { fontWeight: 600, marginTop: 2 }, children: mediaPostsCount })
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "section",
            {
              className: "xd-panel",
              "aria-label": "Interactive Posts and Mentions Explorer",
              "data-selectable-text": "true",
              children: [
                /* @__PURE__ */ jsx("div", { className: "xd-tabs-bar", children: /* @__PURE__ */ jsxs("div", { className: "xd-tab-buttons", role: "tablist", children: [
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      type: "button",
                      role: "tab",
                      "aria-selected": activeTab === "posts",
                      className: `xd-tab-btn ${activeTab === "posts" ? "is-active" : ""}`,
                      onClick: () => setActiveTab("posts"),
                      "data-testid": "tab-posts",
                      children: [
                        "Posts Explorer",
                        /* @__PURE__ */ jsx("span", { className: "xd-tab-count", children: posts.length })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      type: "button",
                      role: "tab",
                      "aria-selected": activeTab === "mentions",
                      className: `xd-tab-btn ${activeTab === "mentions" ? "is-active" : ""}`,
                      onClick: () => setActiveTab("mentions"),
                      "data-testid": "tab-mentions",
                      children: [
                        "Mentions & Community Radar",
                        /* @__PURE__ */ jsx("span", { className: "xd-tab-count", children: mentions.length })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      role: "tab",
                      "aria-selected": activeTab === "connection",
                      className: `xd-tab-btn ${activeTab === "connection" ? "is-active" : ""}`,
                      onClick: () => setActiveTab("connection"),
                      "data-testid": "tab-connection",
                      children: "Hermes Auto-Auth & Zero-Cost Architecture"
                    }
                  )
                ] }) }),
                activeTab === "posts" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsxs("div", { className: "xd-explorer-toolbar", children: [
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "search",
                        className: "xd-search-input",
                        placeholder: "Search posts by keyword, #hashtag, or @mention...",
                        value: searchQuery,
                        onChange: (e) => setSearchQuery(e.target.value),
                        "aria-label": "Search posts",
                        "data-testid": "xd-posts-search"
                      }
                    ),
                    /* @__PURE__ */ jsx("div", { className: "xd-filter-pills", children: [
                      ["all", "All"],
                      ["originals", "Originals"],
                      ["replies", "Replies"],
                      ["media", "Media"]
                    ].map(([id, label]) => /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        className: `xd-filter-pill ${postFilter === id ? "is-active" : ""}`,
                        onClick: () => setPostFilter(id),
                        children: label
                      },
                      id
                    )) }),
                    /* @__PURE__ */ jsxs(
                      "select",
                      {
                        className: "xd-sort-select",
                        value: postSort,
                        onChange: (e) => setPostSort(
                          e.target.value
                        ),
                        "aria-label": "Sort posts",
                        children: [
                          /* @__PURE__ */ jsx("option", { value: "latest", children: "Sort: Latest" }),
                          /* @__PURE__ */ jsx("option", { value: "impressions", children: "Sort: Most Impressions" }),
                          /* @__PURE__ */ jsx("option", { value: "likes", children: "Sort: Most Likes" }),
                          /* @__PURE__ */ jsx("option", { value: "engagement", children: "Sort: Highest Engagement %" })
                        ]
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "xd-feed-list", "data-testid": "xd-posts-list", children: filteredPosts.length > 0 ? filteredPosts.map((post) => {
                    const er = computePostEngagementRate(post);
                    const tier = getEngagementTier(er);
                    return /* @__PURE__ */ jsxs(
                      "article",
                      {
                        className: "xd-post-card",
                        "data-selectable-text": "true",
                        children: [
                          /* @__PURE__ */ jsxs("div", { className: "xd-post-top", children: [
                            /* @__PURE__ */ jsxs("span", { children: [
                              /* @__PURE__ */ jsxs("strong", { children: [
                                "@",
                                handle
                              ] }),
                              " · ",
                              formatRelativeTime(post.created_at),
                              " ",
                              /* @__PURE__ */ jsxs("span", { style: { opacity: 0.7 }, children: [
                                "(",
                                (post.created_at || "").slice(0, 16).replace("T", " "),
                                ")"
                              ] })
                            ] }),
                            /* @__PURE__ */ jsxs("span", { className: tier.className, children: [
                              er,
                              "% ER"
                            ] })
                          ] }),
                          /* @__PURE__ */ jsx("p", { className: "xd-post-text", children: highlightEntities(post.text) }),
                          /* @__PURE__ */ jsxs("div", { className: "xd-post-footer", children: [
                            /* @__PURE__ */ jsxs("div", { className: "xd-post-metrics", children: [
                              /* @__PURE__ */ jsxs("span", { children: [
                                "👁 ",
                                /* @__PURE__ */ jsx("strong", { children: post.impressions.toLocaleString() }),
                                " imp"
                              ] }),
                              /* @__PURE__ */ jsxs("span", { children: [
                                "♥ ",
                                /* @__PURE__ */ jsx("strong", { children: post.likes.toLocaleString() }),
                                " likes"
                              ] }),
                              /* @__PURE__ */ jsxs("span", { children: [
                                "↻ ",
                                /* @__PURE__ */ jsx("strong", { children: post.reposts.toLocaleString() }),
                                " reposts"
                              ] }),
                              /* @__PURE__ */ jsxs("span", { children: [
                                "💬 ",
                                /* @__PURE__ */ jsx("strong", { children: post.replies.toLocaleString() }),
                                " replies"
                              ] }),
                              /* @__PURE__ */ jsxs("span", { children: [
                                "🔖 ",
                                /* @__PURE__ */ jsx("strong", { children: (post.bookmarks || 0).toLocaleString() }),
                                " saves"
                              ] })
                            ] }),
                            /* @__PURE__ */ jsx(
                              "a",
                              {
                                href: safeExternalUrl(
                                  post.url,
                                  `https://x.com/${handle}/status/${post.id}`
                                ) || `https://x.com/${handle}/status/${post.id}`,
                                target: "_blank",
                                rel: "noreferrer",
                                className: "xd-external-link",
                                children: "View on X ↗"
                              }
                            )
                          ] })
                        ]
                      },
                      post.id
                    );
                  }) : /* @__PURE__ */ jsx("div", { className: "xd-post-card", children: /* @__PURE__ */ jsx(
                    "p",
                    {
                      className: "xd-post-text",
                      style: { color: "var(--xd-text-secondary)" },
                      children: "No posts match the current filter criteria."
                    }
                  ) }) })
                ] }) : null,
                activeTab === "mentions" ? /* @__PURE__ */ jsx("div", { className: "xd-feed-list", "data-testid": "xd-mentions-list", children: mentions.length > 0 ? mentions.map((m) => /* @__PURE__ */ jsxs(
                  "article",
                  {
                    className: "xd-post-card",
                    "data-selectable-text": "true",
                    children: [
                      /* @__PURE__ */ jsxs("div", { className: "xd-post-top", children: [
                        /* @__PURE__ */ jsxs("span", { children: [
                          /* @__PURE__ */ jsx("strong", { children: m.author_name || `@${m.author_username}` }),
                          " ",
                          /* @__PURE__ */ jsxs("span", { className: "xd-entity", children: [
                            "@",
                            m.author_username
                          ] }),
                          " ·",
                          " ",
                          formatRelativeTime(m.created_at)
                        ] }),
                        typeof m.author_followers === "number" ? /* @__PURE__ */ jsxs("span", { className: "xd-kpi-pill", children: [
                          formatCompactNumber(m.author_followers),
                          " followers"
                        ] }) : null
                      ] }),
                      /* @__PURE__ */ jsx("p", { className: "xd-post-text", children: highlightEntities(m.text) }),
                      /* @__PURE__ */ jsxs("div", { className: "xd-post-footer", children: [
                        /* @__PURE__ */ jsxs("div", { className: "xd-post-metrics", children: [
                          /* @__PURE__ */ jsxs("span", { children: [
                            "👁 ",
                            /* @__PURE__ */ jsx("strong", { children: m.impressions.toLocaleString() }),
                            " imp"
                          ] }),
                          /* @__PURE__ */ jsxs("span", { children: [
                            "♥ ",
                            /* @__PURE__ */ jsx("strong", { children: m.likes.toLocaleString() }),
                            " likes"
                          ] }),
                          /* @__PURE__ */ jsxs("span", { children: [
                            "↻ ",
                            /* @__PURE__ */ jsx("strong", { children: m.reposts.toLocaleString() }),
                            " reposts"
                          ] }),
                          /* @__PURE__ */ jsxs("span", { children: [
                            "💬 ",
                            /* @__PURE__ */ jsx("strong", { children: m.replies.toLocaleString() }),
                            " replies"
                          ] })
                        ] }),
                        /* @__PURE__ */ jsx(
                          "a",
                          {
                            href: safeExternalUrl(
                              m.url,
                              `https://x.com/${m.author_username}/status/${m.id}`
                            ) || `https://x.com/${m.author_username}/status/${m.id}`,
                            target: "_blank",
                            rel: "noreferrer",
                            className: "xd-external-link",
                            children: "Reply on X ↗"
                          }
                        )
                      ] })
                    ]
                  },
                  m.id
                )) : /* @__PURE__ */ jsx("div", { className: "xd-post-card", children: /* @__PURE__ */ jsx(
                  "p",
                  {
                    className: "xd-post-text",
                    style: { color: "var(--xd-text-secondary)" },
                    children: "No recent mentions cached yet. Click Refresh or configure x_search / xurl to populate community mentions."
                  }
                ) }) }) : null,
                activeTab === "connection" ? /* @__PURE__ */ jsxs("div", { className: "xd-feed-list", "data-testid": "xd-connection-inspector", children: [
                  /* @__PURE__ */ jsx("div", { className: "xd-auth-grid", children: (status?.auth_sources ?? []).map((src) => /* @__PURE__ */ jsxs(
                    "div",
                    {
                      className: `xd-auth-card ${src.detected ? "is-detected" : ""}`,
                      "data-selectable-text": "true",
                      children: [
                        /* @__PURE__ */ jsxs("div", { className: "xd-kpi-top", children: [
                          /* @__PURE__ */ jsx("strong", { className: "xd-auth-title", children: src.label }),
                          /* @__PURE__ */ jsx(
                            "span",
                            {
                              className: src.detected ? "xd-kpi-pill is-emerald" : "xd-kpi-pill is-amber",
                              children: src.detected ? "Detected" : "Optional"
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsx("p", { className: "xd-auth-detail", children: src.detail || (src.detected ? "Ready for telemetry" : "Not configured") }),
                        src.handle ? /* @__PURE__ */ jsxs("span", { className: "xd-auth-handle", children: [
                          "Linked Handle: @",
                          src.handle
                        ] }) : null
                      ]
                    },
                    src.id
                  )) }),
                  /* @__PURE__ */ jsxs("div", { className: "xd-post-card", "data-selectable-text": "true", children: [
                    /* @__PURE__ */ jsxs("div", { className: "xd-post-top", children: [
                      /* @__PURE__ */ jsx("strong", { children: "Zero-Cost Guarantee & Hermes Auto-Link Policy" }),
                      /* @__PURE__ */ jsx("span", { className: "xd-zero-cost-badge", children: "Cost Policy: $0.00 Default" })
                    ] }),
                    /* @__PURE__ */ jsx(
                      "p",
                      {
                        className: "xd-post-text",
                        style: { color: "var(--xd-text-secondary)" },
                        children: status?.cost_policy || "X Dashboard resolves your configured handle via Hermes plugin settings, X_DASHBOARD_HANDLE, xurl CLI, or any public @handle, and defaults to 100% Free Mode ($0.00) so routine dashboard refreshes never burn paid X API or xAI credits."
                      }
                    )
                  ] })
                ] }) : null
              ]
            }
          ),
          /* @__PURE__ */ jsxs("footer", { className: "xd-footer-bar", children: [
            /* @__PURE__ */ jsxs("span", { children: [
              "Hermes X Dashboard · Read-only telemetry · Active source:",
              " ",
              /* @__PURE__ */ jsx("strong", { children: status?.active_source || "public_free" })
            ] }),
            /* @__PURE__ */ jsx("span", { children: "100% Free Mode ($0.00) by default · Optional X API sync on demand" })
          ] })
        ] })
      ]
    }
  );
}
const X_DASHBOARD_DESKTOP_PATH = "/x-dashboard";
function createXDashboardContributions(render, navigate = () => void 0) {
  return [
    {
      id: "page",
      area: "routes",
      title: "X Dashboard",
      order: 90,
      data: { path: X_DASHBOARD_DESKTOP_PATH },
      render
    },
    {
      id: "nav",
      area: "sidebar.nav",
      order: 90,
      data: {
        path: X_DASHBOARD_DESKTOP_PATH,
        label: "X Dashboard",
        codicon: "graph"
      }
    },
    {
      id: "open",
      area: "palette",
      order: 90,
      data: {
        id: "x-dashboard.open",
        label: "Open X Dashboard",
        keywords: ["x", "twitter", "analytics", "dashboard"],
        run: () => navigate(X_DASHBOARD_DESKTOP_PATH)
      }
    }
  ];
}
function createDesktopXDashboardHost(ctx, desktop) {
  return {
    async fetchJSON(url, init) {
      let path = url;
      if (url === PLUGIN_API_PREFIX || url.startsWith(`${PLUGIN_API_PREFIX}/`) || url.startsWith(`${PLUGIN_API_PREFIX}?`)) {
        path = url.slice(PLUGIN_API_PREFIX.length) || "/";
      } else if (!url.startsWith("/")) {
        throw new Error(`Desktop X Dashboard cannot access external path: ${url}`);
      }
      const options = {};
      if (init?.method) {
        options.method = init.method;
      }
      if (init?.body !== void 0 && init?.body !== null) {
        options.body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      }
      return ctx.rest(path, options);
    },
    navigateTo: (path) => desktop.navigate(path)
  };
}
function DesktopXDashboardPage() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("style", { children: xDashboardCss }),
    /* @__PURE__ */ jsx(XDashboardPage, {})
  ] });
}
const plugin = {
  id: "x-dashboard",
  name: "X Dashboard",
  defaultEnabled: true,
  register(ctx) {
    configureXDashboardHost(createDesktopXDashboardHost(ctx, host));
    ctx.registerMany(
      createXDashboardContributions(
        () => /* @__PURE__ */ jsx(DesktopXDashboardPage, {}),
        (path) => host.navigate(path)
      )
    );
  }
};
export {
  plugin as default
};
