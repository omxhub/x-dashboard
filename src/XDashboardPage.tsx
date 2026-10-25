import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";
import xDashboardCss from "./x-dashboard.css?inline";
import { loadDashboardData, saveDashboardConfig } from "./sdk";
import {
  computePostEngagementRate,
  type NormalizedXDashboardData,
  type XPost,
} from "./types";

const READABLE_TOKENS: CSSProperties = {
  "--ui-text-secondary":
    "color-mix(in srgb, var(--foreground, currentColor) 76%, transparent)",
  "--ui-text-tertiary":
    "color-mix(in srgb, var(--foreground, currentColor) 58%, transparent)",
} as CSSProperties;

export function ensureXDashboardStyles(): void {
  if (typeof document === "undefined" || !document.head) return;
  const existing = document.getElementById("x-dashboard-styles");
  if (!existing) {
    const style = document.createElement("style");
    style.id = "x-dashboard-styles";
    style.textContent = xDashboardCss;
    document.head.appendChild(style);
  }
}

export function formatCompactNumber(n: number | undefined | null): string {
  const val = Number(n || 0);
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 10_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

export function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "just now";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso.slice(0, 10);
  const diffSec = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return dt.toISOString().slice(0, 10);
}

export function safeExternalUrl(
  raw: string | undefined | null,
  fallback?: string,
): string | null {
  const candidate = (raw || "").trim() || (fallback || "").trim();
  if (!candidate) return null;
  if (candidate.startsWith("https://") || candidate.startsWith("http://")) {
    return candidate;
  }
  if (/^[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/.*)?$/.test(candidate)) {
    return `https://${candidate}`;
  }
  return fallback && (fallback.startsWith("https://") || fallback.startsWith("http://"))
    ? fallback
    : null;
}

export function escapeCsvCell(raw: string | undefined | null): string {
  const cr = String.fromCharCode(13);
  const lf = String.fromCharCode(10);
  const cleaned = String(raw || "")
    .split(cr + lf)
    .join(" ")
    .split(cr)
    .join(" ")
    .split(lf)
    .join(" ")
    .replace(/"/g, '""');
  const safeFormula = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${safeFormula}"`;
}

export function highlightEntities(text: string): ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(https?:\/\/\S+|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("@") || part.startsWith("#")) {
      return (
        <span key={idx} className="xd-entity">
          {part}
        </span>
      );
    }
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="xd-external-link"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function getEngagementTier(rate: number): { label: string; className: string } {
  if (rate >= 3.0) return { label: "Elite >3%", className: "xd-kpi-pill is-emerald" };
  if (rate >= 1.5) return { label: "Strong >1.5%", className: "xd-kpi-pill" };
  return { label: "Steady", className: "xd-kpi-pill is-amber" };
}

function Sparkline({
  values,
  color = "var(--xd-accent)",
}: {
  values: number[];
  color?: string;
}) {
  const pts = values.length >= 2 ? values : [10, 12, 11, 14, 15, 18];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1, max - min);
  const width = 54;
  const height = 16;
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * width;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="xd-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}

function RadialGauge({
  value,
  goal,
  color = "var(--xd-accent)",
}: {
  value: number;
  goal: number;
  color?: string;
}) {
  const safeGoal = Math.max(1, goal);
  const pct = Math.min(100, Math.max(0, (value / safeGoal) * 100));
  const r = 21;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="xd-goal-radial">
      <svg viewBox="0 0 52 52">
        <circle
          className="xd-goal-radial-track"
          cx="26"
          cy="26"
          r={r}
          fill="none"
          strokeWidth="5"
        />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
        />
      </svg>
      <div className="xd-goal-radial-pct">{pct.toFixed(0)}%</div>
    </div>
  );
}

export default function XDashboardPage() {
  useEffect(() => {
    ensureXDashboardStyles();
  }, []);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<"narrow" | "compact" | "wide">("wide");

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const update = (width: number) => {
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

  const [data, setData] = useState<NormalizedXDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState<string>("");
  const [activeMode, setActiveMode] = useState<"auto" | "free" | "live_v2">("auto");

  // Explorer state
  const [activeTab, setActiveTab] = useState<"posts" | "mentions" | "connection">("posts");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [postFilter, setPostFilter] = useState<"all" | "originals" | "replies" | "media">("all");
  const [postSort, setPostSort] = useState<"latest" | "impressions" | "likes" | "engagement">(
    "latest",
  );
  const [selectedPostIndex, setSelectedPostIndex] = useState<number>(0);

  // Inline Goal Editing
  const [editingFollowersGoal, setEditingFollowersGoal] = useState<boolean>(false);
  const [followersGoalInput, setFollowersGoalInput] = useState<string>("500");
  const [editingImpressionsGoal, setEditingImpressionsGoal] = useState<boolean>(false);
  const [impressionsGoalInput, setImpressionsGoalInput] = useState<string>("500000");
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [removedHandles, setRemovedHandles] = useState<Set<string>>(new Set());

  const fetchDashboard = useCallback(
    async (opts?: { handle?: string; mode?: "auto" | "free" | "live_v2"; refresh?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await loadDashboardData({
          handle: opts?.handle !== undefined ? opts.handle : handleInput || undefined,
          mode: opts?.mode ?? activeMode,
          refresh: opts?.refresh ?? false,
        });
        setData(result);
        if (!handleInput && result.status.handle) {
          setHandleInput(result.status.handle);
        }
        setFollowersGoalInput(String(result.goals.verified_followers || 500));
        setImpressionsGoalInput(String(result.goals.impressions || 500000));
        setSelectedPostIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [handleInput, activeMode],
  );

  useEffect(() => {
    void fetchDashboard({ refresh: false });
  }, []);

  const handleSwitchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = handleInput.trim().replace(/^@+/, "");
    if (!cleaned) return;
    setHandleInput(cleaned);
    await saveDashboardConfig({ handle: cleaned, mode: activeMode }).catch(() => undefined);
    await fetchDashboard({ handle: cleaned, mode: activeMode, refresh: false });
  };

  const handleSaveGoal = async (kind: "verified_followers" | "impressions", rawVal: string) => {
    const parsed = Math.max(10, parseInt(rawVal.replace(/,/g, ""), 10) || 0);
    if (!data) return;
    const updatedGoals = {
      ...data.goals,
      [kind]: parsed,
    };
    setData({
      ...data,
      goals: updatedGoals,
    });
    if (kind === "verified_followers") {
      setEditingFollowersGoal(false);
      setFollowersGoalInput(String(parsed));
    } else {
      setEditingImpressionsGoal(false);
      setImpressionsGoalInput(String(parsed));
    }
    await saveDashboardConfig({ goals: updatedGoals }).catch(() => undefined);
    setStatusNotice(`Saved ${kind === "verified_followers" ? "Verified Followers" : "Impressions"} target (${parsed.toLocaleString()})`);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleExport = (format: "json" | "csv") => {
    if (!data) return;
    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `x-dashboard-${data.status.handle}-${new Date().toISOString().slice(0, 10)}.json`;
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
        escapeCsvCell(p.text),
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `x-posts-${data.status.handle}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusNotice("Exported posts CSV");
    }
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const account = data?.account;
  const status = data?.status;
  const posts = data?.posts ?? [];
  const mentions = data?.mentions ?? [];
  const analytics = data?.analytics;
  const goals = data?.goals ?? { verified_followers: 500, impressions: 500000 };
  const history = data?.history ?? [];

  const handle = status?.handle || account?.username || "NousResearch";
  const followers = account?.followers_count ?? 0;
  const following = account?.following_count ?? 0;
  const verifiedFollowers = account?.verified_followers_count ?? 0;
  const followRatio = following > 0 ? (followers / following).toFixed(2) : followers > 0 ? "∞" : "0.0";
  const followerDelta =
    history.length >= 2
      ? followers - (history[0]?.followers_count ?? followers)
      : 0;

  const recentImpressions = analytics?.total_impressions ?? 0;
  const avgImpressionsPerPost =
    posts.length > 0 ? Math.round(recentImpressions / posts.length) : 0;
  const avgEngagementRate = analytics?.avg_engagement_rate ?? 0;
  const engagementTier = getEngagementTier(avgEngagementRate);

  const totalInteractions =
    (analytics?.total_likes ?? 0) +
    (analytics?.total_reposts ?? 0) +
    (analytics?.total_replies ?? 0) +
    (analytics?.total_bookmarks ?? 0) +
    (analytics?.total_quotes ?? 0);

  const replyPostsCount = posts.filter(
    (p) => Boolean(p.replying_to) || p.text.trim().startsWith("@"),
  ).length;
  const mediaPostsCount = posts.filter(
    (p) => Array.isArray(p.media) && p.media.length > 0,
  ).length;
  const originalPostsCount = Math.max(0, posts.length - replyPostsCount);
  const replyRatioPct =
    posts.length > 0 ? Math.round((replyPostsCount / posts.length) * 100) : 0;

  // Filtered and sorted posts for Explorer
  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts
      .filter((p) => {
        if (q && !p.text.toLowerCase().includes(q)) return false;
        const isReply = Boolean(p.replying_to) || p.text.trim().startsWith("@");
        const hasMedia = Array.isArray(p.media) && p.media.length > 0;
        if (postFilter === "originals" && isReply) return false;
        if (postFilter === "replies" && !isReply) return false;
        if (postFilter === "media" && !hasMedia) return false;
        return true;
      })
      .sort((a, b) => {
        if (postSort === "impressions") return (b.impressions || 0) - (a.impressions || 0);
        if (postSort === "likes") return (b.likes || 0) - (a.likes || 0);
        if (postSort === "engagement") {
          return computePostEngagementRate(b) - computePostEngagementRate(a);
        }
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
  }, [posts, searchQuery, postFilter, postSort]);

  // Trajectory chart posts (up to 20 chronological)
  const chartPosts = useMemo(() => {
    const slice = posts.slice(0, 20).reverse();
    return slice;
  }, [posts]);

  const activeChartPost: XPost | undefined =
    chartPosts[selectedPostIndex] ?? chartPosts[chartPosts.length - 1] ?? posts[0];

  // Peak posting hour
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
      peakHourLabel: `${String(bestHr).padStart(2, "0")}:00 UTC`,
    };
  }, [analytics]);

  // Auto-Link connection label
  const autoLinkLabel = useMemo(() => {
    if (!status) return `Auto-Linked via Hermes (@${handle})`;
    if (status.auto_linked) {
      const src =
        status.active_source === "xurl"
          ? "xurl OAuth2"
          : status.active_source === "xchat"
            ? "Hermes XChat"
            : status.active_source;
      return `Auto-Linked via Hermes (${src} · @${handle})`;
    }
    return `Public Free Mode (@${handle})`;
  }, [status, handle]);

  const mixItems = [
    { label: "Likes", val: analytics?.total_likes ?? 0, color: "var(--xd-rose)" },
    { label: "Reposts", val: analytics?.total_reposts ?? 0, color: "var(--xd-emerald)" },
    { label: "Replies", val: analytics?.total_replies ?? 0, color: "var(--xd-blue)" },
    { label: "Bookmarks", val: analytics?.total_bookmarks ?? 0, color: "var(--xd-yellow)" },
    { label: "Quotes", val: analytics?.total_quotes ?? 0, color: "var(--xd-purple)" },
  ];

  return (
    <div
      ref={rootRef}
      className="xd-root xd-selectable"
      style={READABLE_TOKENS}
      data-layout={layout}
      data-selectable-text="true"
      data-testid="x-dashboard-root"
    >
      <style>{xDashboardCss}</style>

      <div className="xd-container">
        {/* 1. NATIVE HERMES DESKTOP PAGE HEADER */}
        <header className="xd-page-header" aria-label="X Dashboard Header">
          <div className="xd-page-title-group">
            <div className="xd-page-title-row">
              <svg
                className="xd-page-icon"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12.6 1h2.2L10 6.5 15.7 15h-4.4L7.8 9.9 3.6 15H1.4l5.1-5.9L1.1 1h4.5l3.1 4.6L12.6 1zm-.8 12.6h1.2L5.2 2.3H3.9l7.9 11.3z" />
              </svg>
              <h1 className="xd-page-title">X Dashboard</h1>
              <span
                className={`xd-autolink-pill ${status?.auto_linked ? "is-linked" : ""}`}
                data-testid="xd-autolink-pill"
              >
                <span
                  className={`xd-status-dot ${status?.auto_linked ? "is-linked" : ""}`}
                />
                {autoLinkLabel}
              </span>
              <span
                className="xd-zero-cost-badge"
                title="Default refreshes use zero-cost public syndication and local telemetry cache without burning X API credits."
                data-testid="xd-zero-cost-badge"
              >
                ⚡ $0.00 Free Mode Active
              </span>
            </div>

            <div className="xd-page-subtitle" data-selectable-text="true">
              <span>@{handle}</span>
              <span>·</span>
              <span>Source: {status?.active_source || "public_free"}</span>
              {status?.cache_updated_at ? (
                <>
                  <span>·</span>
                  <span>Synced {formatRelativeTime(status.cache_updated_at)}</span>
                </>
              ) : null}
              {statusNotice ? (
                <>
                  <span>·</span>
                  <span style={{ color: "var(--xd-emerald)", fontWeight: 500 }}>
                    {statusNotice}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="xd-header-toolbar">
            <form className="xd-handle-form" onSubmit={handleSwitchSubmit}>
              <span className="xd-handle-prefix">@</span>
              <input
                type="text"
                className="xd-handle-input"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="switch handle..."
                aria-label="X Handle"
                data-testid="xd-handle-input"
              />
              <button
                type="submit"
                className="xd-btn xd-btn-sm xd-btn-ghost"
                disabled={loading}
                data-testid="xd-switch-handle-btn"
              >
                Switch
              </button>
            </form>

            <button
              type="button"
              className="xd-btn xd-btn-primary"
              disabled={loading}
              onClick={() => {
                setActiveMode("free");
                void fetchDashboard({ mode: "free", refresh: true });
              }}
              data-testid="xd-refresh-free-btn"
            >
              {loading ? "Syncing…" : "↻ Refresh ($0.00)"}
            </button>

            <button
              type="button"
              className="xd-btn xd-btn-live"
              disabled={loading}
              onClick={() => {
                setActiveMode("live_v2");
                void fetchDashboard({ mode: "live_v2", refresh: true });
              }}
              title="Sync verified_followers_count and owned metrics via local Hermes xurl/xchat OAuth2 token"
              data-testid="xd-sync-v2-btn"
            >
              ⚡ Sync Official X API
            </button>

            <button
              type="button"
              className="xd-btn"
              onClick={() => handleExport("json")}
              title="Export full dashboard snapshot as JSON"
            >
              JSON
            </button>
            <button
              type="button"
              className="xd-btn"
              onClick={() => handleExport("csv")}
              title="Export posts metrics as CSV"
            >
              CSV
            </button>
          </div>
        </header>

        {/* 2. FLAT PROFILE SUMMARY STRIP */}
        <section
          className="xd-profile-strip"
          aria-label="X Profile Command Header"
          data-selectable-text="true"
        >
          <div className="xd-profile-row">
            <div className="xd-profile-identity">
              <div className="xd-avatar-wrap">
                {account?.profile_image_url ? (
                  <img
                    src={account.profile_image_url}
                    alt={account.name || handle}
                    className="xd-avatar-img"
                  />
                ) : (
                  <div className="xd-avatar-fallback">
                    {(account?.name || handle).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="xd-verified-badge" title="Verified X Creator">
                  ✓
                </span>
              </div>

              <div className="xd-profile-titles">
                <div className="xd-name-line">
                  <h2 className="xd-display-name">{account?.name || `@${handle}`}</h2>
                  <span className="xd-sub-badge">
                    {account?.subscription_type || "Premium"}
                  </span>
                  {account?.cost_incurred ? (
                    <span className="xd-kpi-pill is-emerald">
                      Cost: {account.cost_incurred}
                    </span>
                  ) : null}
                </div>
                <a
                  href={`https://x.com/${handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="xd-handle-link"
                >
                  @{handle} ↗
                </a>
              </div>
            </div>

            {status?.available_handles && status.available_handles.length > 1 ? (
              <div className="xd-profile-badges">
                <span className="xd-label">Detected:</span>
                {status.available_handles
                  .filter((h) => !removedHandles.has(h))
                  .map((h) => (
                    <span key={h} className="xd-detected-pill">
                      <button
                        type="button"
                        className="xd-btn xd-btn-sm"
                        onClick={() => {
                          setHandleInput(h);
                          void fetchDashboard({ handle: h, refresh: false });
                        }}
                      >
                        @{h}
                      </button>
                      <button
                        type="button"
                        className="xd-detected-pill-remove"
                        aria-label={`Remove @${h}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRemovedHandles((prev) => {
                            const next = new Set(prev);
                            next.add(h);
                            return next;
                          });
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
            ) : null}
          </div>

          {account?.description ? (
            <p className="xd-bio-text" data-selectable-text="true">
              {highlightEntities(account.description)}
            </p>
          ) : (
            <p className="xd-bio-text" data-selectable-text="true">
              Hermes Creator &amp; Autonomous Agent Telemetry for @{handle} — zero-key public analytics + optional local OAuth2 enrichment.
            </p>
          )}

          {account?.location || account?.website || account?.created_at ? (
            <div className="xd-meta-strip">
              {account?.location ? (
                <span className="xd-meta-item">📍 {account.location}</span>
              ) : null}
              {safeExternalUrl(account?.website) ? (
                <span className="xd-meta-item">
                  🔗{" "}
                  <a
                    href={safeExternalUrl(account?.website) || "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {(account?.website || "").replace(/^https?:\/\//, "")}
                  </a>
                </span>
              ) : null}
              {account?.created_at ? (
                <span className="xd-meta-item">
                  Joined {account.created_at.slice(0, 10)}
                </span>
              ) : null}
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="xd-banner-alert" role="alert">
            <span>⚠️ Telemetry Warning: {error}</span>
            <button
              type="button"
              className="xd-btn xd-btn-sm"
              onClick={() => void fetchDashboard({ refresh: false })}
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* 3. EXECUTIVE KPI TELEMETRY STRIP */}
        <section className="xd-section" aria-label="Executive KPIs">
          <div className="xd-section-header">
            <span className="xd-label">Overview Telemetry</span>
            <span className="xd-caption xd-tabular">
              {posts.length} indexed posts · {mentions.length} mentions
            </span>
          </div>

          <div className="xd-kpi-grid">
            {/* KPI 1: Total Followers */}
            <div className="xd-kpi-card" data-testid="kpi-followers">
              <div className="xd-kpi-top">
                <span className="xd-kpi-label">Total Followers</span>
                <span className="xd-kpi-pill">{followRatio}x Ratio</span>
              </div>
              <div className="xd-kpi-value">{followers.toLocaleString()}</div>
              <div className="xd-kpi-sub">
                <span>
                  {followerDelta >= 0 ? `+${followerDelta}` : followerDelta} vs history ·{" "}
                  {following.toLocaleString()} following
                </span>
                <Sparkline
                  values={
                    history.length >= 2
                      ? history.map((h) => h.followers_count)
                      : [
                          Math.max(0, followers - 18),
                          Math.max(0, followers - 12),
                          Math.max(0, followers - 7),
                          followers,
                        ]
                  }
                  color="var(--xd-accent)"
                />
              </div>
            </div>

            {/* KPI 2: Verified Followers */}
            <div className="xd-kpi-card" data-testid="kpi-verified-followers">
              <div className="xd-kpi-top">
                <span className="xd-kpi-label">Verified Followers</span>
                <span className="xd-kpi-pill is-emerald">
                  {account?.verified_followers_cached || verifiedFollowers > 0
                    ? "X API Cached"
                    : "Public Mode"}
                </span>
              </div>
              <div className="xd-kpi-value">{verifiedFollowers.toLocaleString()}</div>
              <div className="xd-kpi-sub">
                <span>
                  {followers > 0
                    ? `${((verifiedFollowers / followers) * 100).toFixed(1)}% of audience`
                    : "Target: 500 verified"}
                </span>
                <span style={{ color: "var(--xd-emerald)", fontWeight: 600 }}>
                  {Math.min(
                    100,
                    Math.round(
                      (verifiedFollowers / Math.max(1, goals.verified_followers)) * 100,
                    ),
                  )}
                  %
                </span>
              </div>
            </div>

            {/* KPI 3: Recent Impressions */}
            <div className="xd-kpi-card" data-testid="kpi-impressions">
              <div className="xd-kpi-top">
                <span className="xd-kpi-label">Recent Impressions</span>
                <span className="xd-kpi-pill">
                  {formatCompactNumber(avgImpressionsPerPost)} / post
                </span>
              </div>
              <div className="xd-kpi-value">{formatCompactNumber(recentImpressions)}</div>
              <div className="xd-kpi-sub">
                <span>Across last {posts.length} posts</span>
                <Sparkline
                  values={
                    chartPosts.length >= 2
                      ? chartPosts.map((p) => p.impressions)
                      : [120, 340, 280, 610, 490]
                  }
                  color="var(--xd-emerald)"
                />
              </div>
            </div>

            {/* KPI 4: Engagement Rate */}
            <div className="xd-kpi-card" data-testid="kpi-engagement">
              <div className="xd-kpi-top">
                <span className="xd-kpi-label">Engagement Rate</span>
                <span className={engagementTier.className}>{engagementTier.label}</span>
              </div>
              <div className="xd-kpi-value">{avgEngagementRate.toFixed(2)}%</div>
              <div className="xd-kpi-sub">
                <span>{totalInteractions.toLocaleString()} total interactions</span>
                <span>{analytics?.total_bookmarks ?? 0} saves</span>
              </div>
            </div>

            {/* KPI 5: Total Posts & Media */}
            <div className="xd-kpi-card" data-testid="kpi-posts">
              <div className="xd-kpi-top">
                <span className="xd-kpi-label">Posts &amp; Media</span>
                <span className="xd-kpi-pill is-violet">
                  {account?.listed_count ?? 0} Listed
                </span>
              </div>
              <div className="xd-kpi-value">
                {(account?.tweet_count ?? posts.length).toLocaleString()}
              </div>
              <div className="xd-kpi-sub">
                <span>{account?.media_count ?? mediaPostsCount} media posts</span>
                <span>
                  {(account?.likes_count ?? analytics?.total_likes ?? 0).toLocaleString()} likes
                </span>
              </div>
            </div>

            {/* KPI 6: Community Pulse */}
            <div className="xd-kpi-card" data-testid="kpi-community">
              <div className="xd-kpi-top">
                <span className="xd-kpi-label">Community Pulse</span>
                <span className="xd-kpi-pill is-emerald">Active Radar</span>
              </div>
              <div className="xd-kpi-value">{mentions.length}</div>
              <div className="xd-kpi-sub">
                <span>Recent @mentions</span>
                <span>{replyRatioPct}% reply cadence</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. MONETIZATION & CREATOR GROWTH GOAL TRACKERS */}
        <section className="xd-section" aria-label="Creator Monetization Goals">
          <div className="xd-section-header">
            <span className="xd-label">Creator Monetization Goals</span>
          </div>

          <div className="xd-goals-grid">
            {/* Goal 1: Verified Followers */}
            <div className="xd-goal-card" data-testid="goal-verified-followers">
              <RadialGauge
                value={verifiedFollowers}
                goal={goals.verified_followers}
                color="var(--xd-accent)"
              />
              <div className="xd-goal-content">
                <div className="xd-goal-header">
                  <div className="xd-goal-title">
                    <span>Verified Followers Eligibility</span>
                  </div>
                  {editingFollowersGoal ? (
                    <div className="xd-goal-edit-inline">
                      <input
                        type="number"
                        className="xd-goal-input"
                        value={followersGoalInput}
                        onChange={(e) => setFollowersGoalInput(e.target.value)}
                        aria-label="Verified Followers Target"
                      />
                      <button
                        type="button"
                        className="xd-btn xd-btn-sm xd-btn-primary"
                        onClick={() =>
                          void handleSaveGoal("verified_followers", followersGoalInput)
                        }
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="xd-goal-target-btn"
                      onClick={() => setEditingFollowersGoal(true)}
                      title="Click to customize Verified Followers target"
                    >
                      Target: {goals.verified_followers.toLocaleString()} ✎
                    </button>
                  )}
                </div>

                <div className="xd-progress-track">
                  <div
                    className="xd-progress-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        (verifiedFollowers / Math.max(1, goals.verified_followers)) * 100,
                      )}%`,
                    }}
                  />
                </div>

                <div className="xd-goal-meta">
                  <span>
                    {verifiedFollowers.toLocaleString()} /{" "}
                    {goals.verified_followers.toLocaleString()} verified
                  </span>
                  <span>
                    {Math.max(
                      0,
                      goals.verified_followers - verifiedFollowers,
                    ).toLocaleString()}{" "}
                    remaining
                  </span>
                </div>
              </div>
            </div>

            {/* Goal 2: Impressions Target */}
            <div className="xd-goal-card" data-testid="goal-impressions">
              <RadialGauge
                value={recentImpressions}
                goal={goals.impressions}
                color="var(--xd-emerald)"
              />
              <div className="xd-goal-content">
                <div className="xd-goal-header">
                  <div className="xd-goal-title">
                    <span>Organic Impressions Target</span>
                  </div>
                  {editingImpressionsGoal ? (
                    <div className="xd-goal-edit-inline">
                      <input
                        type="number"
                        className="xd-goal-input"
                        value={impressionsGoalInput}
                        onChange={(e) => setImpressionsGoalInput(e.target.value)}
                        aria-label="Impressions Target"
                      />
                      <button
                        type="button"
                        className="xd-btn xd-btn-sm"
                        onClick={() => void handleSaveGoal("impressions", "500000")}
                      >
                        500K
                      </button>
                      <button
                        type="button"
                        className="xd-btn xd-btn-sm"
                        onClick={() => void handleSaveGoal("impressions", "5000000")}
                      >
                        5M
                      </button>
                      <button
                        type="button"
                        className="xd-btn xd-btn-sm xd-btn-primary"
                        onClick={() =>
                          void handleSaveGoal("impressions", impressionsGoalInput)
                        }
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="xd-goal-target-btn"
                      onClick={() => setEditingImpressionsGoal(true)}
                      title="Click to customize Impressions target (500K or 5M)"
                    >
                      Target: {formatCompactNumber(goals.impressions)} ✎
                    </button>
                  )}
                </div>

                <div className="xd-progress-track">
                  <div
                    className="xd-progress-fill is-emerald"
                    style={{
                      width: `${Math.min(
                        100,
                        (recentImpressions / Math.max(1, goals.impressions)) * 100,
                      )}%`,
                    }}
                  />
                </div>

                <div className="xd-goal-meta">
                  <span>
                    {recentImpressions.toLocaleString()} /{" "}
                    {goals.impressions.toLocaleString()} impressions
                  </span>
                  <span>
                    {avgImpressionsPerPost > 0
                      ? `~${Math.ceil(
                          Math.max(0, goals.impressions - recentImpressions) /
                            avgImpressionsPerPost,
                        )} posts at current velocity`
                      : `${Math.max(
                          0,
                          goals.impressions - recentImpressions,
                        ).toLocaleString()} remaining`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. INTERACTIVE SVG VISUAL ANALYTICS SUITE */}
        <section className="xd-analytics-grid" aria-label="Visual Analytics Suite">
          {/* Left Panel: Impressions Trajectory SVG Chart + Top Post Spotlight */}
          <div className="xd-panel">
            <div className="xd-panel-header">
              <div>
                <h2 className="xd-panel-title">
                  Impressions Trajectory (Last {chartPosts.length || 20} Posts)
                </h2>
                <p className="xd-panel-subtitle">
                  Click any bar to inspect reach, saves, and engagement rate
                </p>
              </div>
              <span className="xd-kpi-pill">
                Peak:{" "}
                {formatCompactNumber(
                  Math.max(0, ...chartPosts.map((p) => p.impressions || 0)),
                )}{" "}
                imp
              </span>
            </div>

            <div className="xd-chart-stage">
              {chartPosts.length > 0 ? (
                <>
                  <svg
                    className="xd-trajectory-svg"
                    viewBox="0 0 680 185"
                    role="img"
                    aria-label="Impressions and engagement trajectory chart"
                  >
                    {[25, 70, 115, 160].map((y) => (
                      <line
                        key={y}
                        className="xd-chart-grid-line"
                        x1="8"
                        y1={y}
                        x2="672"
                        y2={y}
                        strokeDasharray="3 3"
                      />
                    ))}

                    {(() => {
                      const maxImp = Math.max(
                        1,
                        ...chartPosts.map((p) => p.impressions || 0),
                      );
                      const peakIdx = chartPosts.reduce(
                        (best, p, i) =>
                          (p.impressions || 0) > (chartPosts[best]?.impressions || 0)
                            ? i
                            : best,
                        0,
                      );
                      const count = chartPosts.length;
                      const slotW = 656 / Math.max(1, count);
                      const barW = Math.max(8, Math.min(26, slotW * 0.64));

                      return (
                        <>
                          {chartPosts.map((post, idx) => {
                            const x = 12 + idx * slotW + (slotW - barW) / 2;
                            const centerX = x + barW / 2;
                            const h = Math.max(
                              5,
                              ((post.impressions || 0) / maxImp) * 132,
                            );
                            const y = 160 - h;
                            const isSelected = idx === selectedPostIndex;
                            const isPeak = idx === peakIdx && count > 1;
                            const dateStr = (post.created_at || "").slice(5, 10);
                            const prevDateStr =
                              idx > 0
                                ? (chartPosts[idx - 1]?.created_at || "").slice(5, 10)
                                : "";
                            const showDateLabel =
                              Boolean(dateStr) &&
                              (idx === 0 ||
                                idx === count - 1 ||
                                isSelected ||
                                dateStr !== prevDateStr);

                            return (
                              <g
                                key={post.id}
                                className="xd-bar-group"
                                onMouseEnter={() => setSelectedPostIndex(idx)}
                                onClick={() => setSelectedPostIndex(idx)}
                              >
                                <rect
                                  className="xd-bar-hit"
                                  x={x}
                                  y={20}
                                  width={barW}
                                  height={140}
                                  fill="transparent"
                                />
                                <rect
                                  className="xd-bar-rect"
                                  x={x}
                                  y={y}
                                  width={barW}
                                  height={h}
                                  rx="3"
                                  fill={
                                    isSelected
                                      ? "var(--xd-emerald)"
                                      : "var(--xd-accent)"
                                  }
                                  fillOpacity={isSelected ? 0.95 : 0.72}
                                />
                                {isSelected || isPeak ? (
                                  <text
                                    className={`xd-chart-value-label${
                                      isSelected ? " is-selected" : ""
                                    }`}
                                    x={centerX}
                                    y={Math.max(14, y - 5)}
                                    textAnchor="middle"
                                  >
                                    {formatCompactNumber(post.impressions || 0)}
                                  </text>
                                ) : null}
                                {showDateLabel ? (
                                  <text
                                    className={`xd-chart-axis-text${
                                      isSelected ? " is-selected" : ""
                                    }`}
                                    x={centerX}
                                    y="176"
                                    textAnchor="middle"
                                  >
                                    {dateStr}
                                  </text>
                                ) : (
                                  <line
                                    className="xd-chart-axis-tick"
                                    x1={centerX}
                                    y1="162"
                                    x2={centerX}
                                    y2="166"
                                  />
                                )}
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>

                  {activeChartPost ? (
                    <div
                      className="xd-chart-hud"
                      data-testid="xd-chart-hud"
                      data-selectable-text="true"
                    >
                      <div className="xd-chart-hud-text">
                        <strong>{(activeChartPost.created_at || "").slice(0, 10)}:</strong>{" "}
                        {activeChartPost.text}
                      </div>
                      <div className="xd-chart-hud-metrics">
                        <span>👁 {activeChartPost.impressions.toLocaleString()}</span>
                        <span>♥ {activeChartPost.likes.toLocaleString()}</span>
                        <span>↻ {activeChartPost.reposts.toLocaleString()}</span>
                        <span>💬 {activeChartPost.replies.toLocaleString()}</span>
                        <span>🔖 {(activeChartPost.bookmarks || 0).toLocaleString()}</span>
                        <span>⚡ {computePostEngagementRate(activeChartPost)}%</span>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="xd-chart-hud">
                  <span>No recent posts found for @{handle} yet.</span>
                </div>
              )}
            </div>

            {/* Top Performing Post Spotlight Card */}
            {analytics?.top_post ? (
              <div
                className="xd-spotlight-card"
                data-testid="xd-top-post-spotlight"
                data-selectable-text="true"
              >
                <div className="xd-spotlight-top">
                  <span className="xd-spotlight-badge">
                    #1 Top Performing Post Spotlight
                  </span>
                  <a
                    href={
                      safeExternalUrl(
                        analytics.top_post.url,
                        `https://x.com/${handle}/status/${analytics.top_post.id}`,
                      ) || `https://x.com/${handle}/status/${analytics.top_post.id}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="xd-external-link"
                  >
                    Open on X ↗
                  </a>
                </div>
                <p className="xd-spotlight-text">
                  {highlightEntities(analytics.top_post.text)}
                </p>
                <div className="xd-spotlight-metrics">
                  <span className="xd-metric-chip">
                    👁 {analytics.top_post.impressions.toLocaleString()} imp
                  </span>
                  <span className="xd-metric-chip">
                    ♥ {analytics.top_post.likes.toLocaleString()} likes
                  </span>
                  <span className="xd-metric-chip">
                    ↻ {analytics.top_post.reposts.toLocaleString()} reposts
                  </span>
                  <span className="xd-metric-chip">
                    💬 {analytics.top_post.replies.toLocaleString()} replies
                  </span>
                  <span className="xd-metric-chip">
                    🔖 {(analytics.top_post.bookmarks || 0).toLocaleString()} saves
                  </span>
                  <span className="xd-metric-chip">
                    ⚡ {computePostEngagementRate(analytics.top_post)}% ER
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Panel: Engagement Mix (TokenMix style) & 24-Hour Posting Cadence */}
          <div className="xd-panel">
            <div className="xd-panel-header">
              <div>
                <h2 className="xd-panel-title">Engagement Mix &amp; Cadence Rhythm</h2>
                <p className="xd-panel-subtitle">
                  Interaction breakdown &amp; 24-hour UTC distribution
                </p>
              </div>
              <span className="xd-kpi-pill is-emerald">
                Peak: {peakHourInfo.peakHourLabel}
              </span>
            </div>

            {/* Stacked Horizontal Mix Bar (matches Hermes Activity TokenMix) */}
            <div className="xd-mix-stacked-bar" aria-hidden="true">
              {mixItems.map((item) => {
                const pct =
                  totalInteractions > 0 ? (item.val / totalInteractions) * 100 : 20;
                return (
                  <div
                    key={item.label}
                    style={{
                      width: `${Math.max(2, pct)}%`,
                      background: item.color,
                    }}
                  />
                );
              })}
            </div>

            <div className="xd-mix-list">
              {mixItems.map((item) => {
                const pct =
                  totalInteractions > 0
                    ? Math.round((item.val / totalInteractions) * 100)
                    : 0;
                return (
                  <div key={item.label} className="xd-mix-row">
                    <span className="xd-mix-label">
                      <span
                        className="xd-mix-dot"
                        style={{ background: item.color }}
                      />
                      {item.label}
                    </span>
                    <span className="xd-mix-val">
                      {item.val.toLocaleString()} · {pct}%
                    </span>
                  </div>
                );
              })}
            </div>

            <div>
              <div className="xd-panel-header" style={{ marginBottom: 4 }}>
                <span className="xd-label">24-Hour Posting Activity (UTC)</span>
                <span className="xd-caption">00h → 23h</span>
              </div>

              <div className="xd-cadence-strip" aria-label="24-Hour Posting Activity">
                {peakHourInfo.byHour.map((count, hr) => {
                  const maxCount = Math.max(1, ...peakHourInfo.byHour);
                  const heightPct = Math.max(8, Math.round((count / maxCount) * 100));
                  return (
                    <div
                      key={hr}
                      className="xd-cadence-col"
                      title={`${String(hr).padStart(2, "0")}:00 UTC — ${count} posts (${(
                        peakHourInfo.impByHour[hr] || 0
                      ).toLocaleString()} impressions)`}
                    >
                      <div
                        className="xd-cadence-bar"
                        style={{
                          height: `${heightPct}%`,
                          opacity: count > 0 ? 0.9 : 0.18,
                        }}
                      />
                      {hr % 4 === 0 ? (
                        <span className="xd-cadence-hr">{String(hr).padStart(2, "0")}</span>
                      ) : (
                        <span className="xd-cadence-hr">&nbsp;</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content Format Breakdown Strip */}
            <div className="xd-breakdown-strip">
              <div>
                <div className="xd-label">Originals</div>
                <div className="xd-tabular" style={{ fontWeight: 600, marginTop: 2 }}>
                  {originalPostsCount}
                </div>
              </div>
              <div>
                <div className="xd-label">Replies</div>
                <div className="xd-tabular" style={{ fontWeight: 600, marginTop: 2 }}>
                  {replyPostsCount} ({replyRatioPct}%)
                </div>
              </div>
              <div>
                <div className="xd-label">Media Posts</div>
                <div className="xd-tabular" style={{ fontWeight: 600, marginTop: 2 }}>
                  {mediaPostsCount}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. INTERACTIVE POSTS EXPLORER + MENTIONS FEED + CONNECTION INSPECTOR */}
        <section
          className="xd-panel"
          aria-label="Interactive Posts and Mentions Explorer"
          data-selectable-text="true"
        >
          <div className="xd-tabs-bar">
            <div className="xd-tab-buttons" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "posts"}
                className={`xd-tab-btn ${activeTab === "posts" ? "is-active" : ""}`}
                onClick={() => setActiveTab("posts")}
                data-testid="tab-posts"
              >
                Posts Explorer
                <span className="xd-tab-count">{posts.length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "mentions"}
                className={`xd-tab-btn ${activeTab === "mentions" ? "is-active" : ""}`}
                onClick={() => setActiveTab("mentions")}
                data-testid="tab-mentions"
              >
                Mentions &amp; Community Radar
                <span className="xd-tab-count">{mentions.length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "connection"}
                className={`xd-tab-btn ${activeTab === "connection" ? "is-active" : ""}`}
                onClick={() => setActiveTab("connection")}
                data-testid="tab-connection"
              >
                Hermes Auto-Auth &amp; Zero-Cost Architecture
              </button>
            </div>
          </div>

          {activeTab === "posts" ? (
            <>
              <div className="xd-explorer-toolbar">
                <input
                  type="search"
                  className="xd-search-input"
                  placeholder="Search posts by keyword, #hashtag, or @mention..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search posts"
                  data-testid="xd-posts-search"
                />

                <div className="xd-filter-pills">
                  {(
                    [
                      ["all", "All"],
                      ["originals", "Originals"],
                      ["replies", "Replies"],
                      ["media", "Media"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`xd-filter-pill ${postFilter === id ? "is-active" : ""}`}
                      onClick={() => setPostFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <select
                  className="xd-sort-select"
                  value={postSort}
                  onChange={(e) =>
                    setPostSort(
                      e.target.value as "latest" | "impressions" | "likes" | "engagement",
                    )
                  }
                  aria-label="Sort posts"
                >
                  <option value="latest">Sort: Latest</option>
                  <option value="impressions">Sort: Most Impressions</option>
                  <option value="likes">Sort: Most Likes</option>
                  <option value="engagement">Sort: Highest Engagement %</option>
                </select>
              </div>

              <div className="xd-feed-list" data-testid="xd-posts-list">
                {filteredPosts.length > 0 ? (
                  filteredPosts.map((post) => {
                    const er = computePostEngagementRate(post);
                    const tier = getEngagementTier(er);
                    return (
                      <article
                        key={post.id}
                        className="xd-post-card"
                        data-selectable-text="true"
                      >
                        <div className="xd-post-top">
                          <span>
                            <strong>@{handle}</strong> · {formatRelativeTime(post.created_at)}{" "}
                            <span style={{ opacity: 0.7 }}>
                              ({(post.created_at || "").slice(0, 16).replace("T", " ")})
                            </span>
                          </span>
                          <span className={tier.className}>{er}% ER</span>
                        </div>

                        <p className="xd-post-text">{highlightEntities(post.text)}</p>

                        <div className="xd-post-footer">
                          <div className="xd-post-metrics">
                            <span>
                              👁 <strong>{post.impressions.toLocaleString()}</strong> imp
                            </span>
                            <span>
                              ♥ <strong>{post.likes.toLocaleString()}</strong> likes
                            </span>
                            <span>
                              ↻ <strong>{post.reposts.toLocaleString()}</strong> reposts
                            </span>
                            <span>
                              💬 <strong>{post.replies.toLocaleString()}</strong> replies
                            </span>
                            <span>
                              🔖 <strong>{(post.bookmarks || 0).toLocaleString()}</strong> saves
                            </span>
                          </div>

                          <a
                            href={
                              safeExternalUrl(
                                post.url,
                                `https://x.com/${handle}/status/${post.id}`,
                              ) || `https://x.com/${handle}/status/${post.id}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="xd-external-link"
                          >
                            View on X ↗
                          </a>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="xd-post-card">
                    <p
                      className="xd-post-text"
                      style={{ color: "var(--xd-text-secondary)" }}
                    >
                      No posts match the current filter criteria.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}

          {activeTab === "mentions" ? (
            <div className="xd-feed-list" data-testid="xd-mentions-list">
              {mentions.length > 0 ? (
                mentions.map((m) => (
                  <article
                    key={m.id}
                    className="xd-post-card"
                    data-selectable-text="true"
                  >
                    <div className="xd-post-top">
                      <span>
                        <strong>{m.author_name || `@${m.author_username}`}</strong>{" "}
                        <span className="xd-entity">@{m.author_username}</span> ·{" "}
                        {formatRelativeTime(m.created_at)}
                      </span>
                      {typeof m.author_followers === "number" ? (
                        <span className="xd-kpi-pill">
                          {formatCompactNumber(m.author_followers)} followers
                        </span>
                      ) : null}
                    </div>

                    <p className="xd-post-text">{highlightEntities(m.text)}</p>

                    <div className="xd-post-footer">
                      <div className="xd-post-metrics">
                        <span>
                          👁 <strong>{m.impressions.toLocaleString()}</strong> imp
                        </span>
                        <span>
                          ♥ <strong>{m.likes.toLocaleString()}</strong> likes
                        </span>
                        <span>
                          ↻ <strong>{m.reposts.toLocaleString()}</strong> reposts
                        </span>
                        <span>
                          💬 <strong>{m.replies.toLocaleString()}</strong> replies
                        </span>
                      </div>

                      <a
                        href={
                          safeExternalUrl(
                            m.url,
                            `https://x.com/${m.author_username}/status/${m.id}`,
                          ) || `https://x.com/${m.author_username}/status/${m.id}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="xd-external-link"
                      >
                        Reply on X ↗
                      </a>
                    </div>
                  </article>
                ))
              ) : (
                <div className="xd-post-card">
                  <p
                    className="xd-post-text"
                    style={{ color: "var(--xd-text-secondary)" }}
                  >
                    No recent mentions cached yet. Click Refresh or configure x_search / xurl to populate community mentions.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "connection" ? (
            <div className="xd-feed-list" data-testid="xd-connection-inspector">
              <div className="xd-auth-grid">
                {(status?.auth_sources ?? []).map((src) => (
                  <div
                    key={src.id}
                    className={`xd-auth-card ${src.detected ? "is-detected" : ""}`}
                    data-selectable-text="true"
                  >
                    <div className="xd-kpi-top">
                      <strong className="xd-auth-title">{src.label}</strong>
                      <span
                        className={
                          src.detected ? "xd-kpi-pill is-emerald" : "xd-kpi-pill is-amber"
                        }
                      >
                        {src.detected ? "Detected" : "Optional"}
                      </span>
                    </div>
                    <p className="xd-auth-detail">
                      {src.detail || (src.detected ? "Ready for telemetry" : "Not configured")}
                    </p>
                    {src.handle ? (
                      <span className="xd-auth-handle">
                        Linked Handle: @{src.handle}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="xd-post-card" data-selectable-text="true">
                <div className="xd-post-top">
                  <strong>Zero-Cost Guarantee &amp; Hermes Auto-Link Policy</strong>
                  <span className="xd-zero-cost-badge">Cost Policy: $0.00 Default</span>
                </div>
                <p
                  className="xd-post-text"
                  style={{ color: "var(--xd-text-secondary)" }}
                >
                  {status?.cost_policy ||
                    "X Dashboard resolves your configured handle via Hermes plugin settings, X_DASHBOARD_HANDLE, xurl CLI, or any public @handle, and defaults to 100% Free Mode ($0.00) so routine dashboard refreshes never burn paid X API or xAI credits."}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        {/* Footer */}
        <footer className="xd-footer-bar">
          <span>
            Hermes X Dashboard · Read-only telemetry · Active source:{" "}
            <strong>{status?.active_source || "public_free"}</strong>
          </span>
          <span>
            100% Free Mode ($0.00) by default · Optional X API sync on demand
          </span>
        </footer>
      </div>
    </div>
  );
}
