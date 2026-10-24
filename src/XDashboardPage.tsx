import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import xDashboardCss from "./x-dashboard.css?inline";
import { loadDashboardData, saveDashboardConfig } from "./sdk";
import {
  computePostEngagementRate,
  type NormalizedXDashboardData,
  type XPost,
} from "./types";

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

function Sparkline({ values, color = "#38bdf8" }: { values: number[]; color?: string }) {
  const pts = values.length >= 2 ? values : [10, 12, 11, 14, 15, 18];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1, max - min);
  const width = 68;
  const height = 22;
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
        strokeWidth="2"
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
  color = "#1d9bf0",
}: {
  value: number;
  goal: number;
  color?: string;
}) {
  const safeGoal = Math.max(1, goal);
  const pct = Math.min(100, Math.max(0, (value / safeGoal) * 100));
  const r = 31;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="xd-goal-radial">
      <svg viewBox="0 0 78 78">
        <circle
          cx="39"
          cy="39"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="7"
        />
        <circle
          cx="39"
          cy="39"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
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
        `"${(p.text || "").replace(/"/g, '""').replace(/\n/g, " ")}"`,
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

  const handle = status?.handle || account?.username || "omx0r";
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
    if (!status) return `● Auto-Linked via Hermes (@${handle})`;
    if (status.auto_linked) {
      const src =
        status.active_source === "xurl"
          ? "xurl OAuth2"
          : status.active_source === "xchat"
            ? "Hermes XChat"
            : status.active_source;
      return `● Auto-Linked via Hermes (${src} · @${handle})`;
    }
    return `● Public Free Mode (@${handle})`;
  }, [status, handle]);

  return (
    <div className="xd-root" data-testid="x-dashboard-root">
      <style>{xDashboardCss}</style>

      <div className="xd-container">
        {/* 1. HERO PROFILE & AUTO-LINK COMMAND HEADER */}
        <section className="xd-hero" aria-label="X Profile Command Header">
          <div
            className="xd-hero-banner"
            style={
              account?.banner_url
                ? {
                    backgroundImage: `url(${account.banner_url})`,
                  }
                : undefined
            }
          >
            <div className="xd-hero-top-pills">
              <div className="xd-pill-group">
                <span
                  className={`xd-autolink-pill ${status?.auto_linked ? "is-linked" : ""}`}
                  data-testid="xd-autolink-pill"
                >
                  <span className="xd-pulse-dot" />
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

              <div className="xd-pill-group">
                {status?.cache_updated_at ? (
                  <span className="xd-autolink-pill" style={{ fontSize: 11 }}>
                    Synced {formatRelativeTime(status.cache_updated_at)}
                  </span>
                ) : null}
                {statusNotice ? (
                  <span className="xd-zero-cost-badge">{statusNotice}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="xd-hero-body">
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
                    <h1 className="xd-display-name">{account?.name || `@${handle}`}</h1>
                    <span className="xd-sub-badge">
                      {account?.subscription_type || "Premium"}
                    </span>
                    {account?.cost_incurred ? (
                      <span className="xd-kpi-pill is-emerald">
                        Run Cost: {account.cost_incurred}
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

              {/* Quick Handle Switcher & Action Bar */}
              <div className="xd-command-controls">
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
                    className="xd-btn xd-btn-sm"
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
                  {loading ? "Syncing…" : "↻ Refresh (Free · $0.00)"}
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
                  Export JSON
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
            </div>

            <div className="xd-bio-row">
              {account?.description ? (
                <p className="xd-bio-text">{highlightEntities(account.description)}</p>
              ) : (
                <p className="xd-bio-text" style={{ color: "var(--xd-text-muted)" }}>
                  Hermes Creator &amp; Autonomous Agent Telemetry for @{handle} — zero-key public analytics + optional local OAuth2 enrichment.
                </p>
              )}

              <div className="xd-meta-strip">
                {account?.location ? (
                  <span className="xd-meta-item">📍 {account.location}</span>
                ) : null}
                {account?.website ? (
                  <span className="xd-meta-item">
                    🔗{" "}
                    <a href={account.website} target="_blank" rel="noreferrer">
                      {account.website.replace(/^https?:\/\//, "")}
                    </a>
                  </span>
                ) : null}
                {account?.created_at ? (
                  <span className="xd-meta-item">
                    📅 Joined {account.created_at.slice(0, 10)}
                  </span>
                ) : null}
                {status?.available_handles && status.available_handles.length > 1 ? (
                  <span className="xd-meta-item">
                    Detected Handles:{" "}
                    {status.available_handles.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className="xd-btn xd-btn-sm"
                        style={{ marginLeft: 4 }}
                        onClick={() => {
                          setHandleInput(h);
                          void fetchDashboard({ handle: h, refresh: false });
                        }}
                      >
                        @{h}
                      </button>
                    ))}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
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

        {/* 2. EXECUTIVE KPI BENTO GRID (6 CARDS) */}
        <section className="xd-kpi-grid" aria-label="Executive KPIs">
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
                color="#38bdf8"
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
              <span style={{ color: "#34d399", fontWeight: 700 }}>
                {Math.min(100, Math.round((verifiedFollowers / Math.max(1, goals.verified_followers)) * 100))}%
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
                color="#10b981"
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
              <span style={{ color: "var(--xd-accent-cyan)", fontWeight: 700 }}>
                {analytics?.total_bookmarks ?? 0} saves
              </span>
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
              <span>{account?.media_count ?? 0} media posts</span>
              <span>{(account?.likes_count ?? analytics?.total_likes ?? 0).toLocaleString()} likes</span>
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
        </section>

        {/* 3. MONETIZATION & CREATOR GROWTH GOAL TRACKERS */}
        <section className="xd-goals-grid" aria-label="Creator Monetization Goals">
          {/* Goal 1: Verified Followers */}
          <div className="xd-goal-card" data-testid="goal-verified-followers">
            <RadialGauge
              value={verifiedFollowers}
              goal={goals.verified_followers}
              color="#1d9bf0"
            />
            <div className="xd-goal-content">
              <div className="xd-goal-header">
                <div className="xd-goal-title">
                  <span>🎯 Creator Monetization Goal 1 · Verified Followers</span>
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
                      onClick={() => void handleSaveGoal("verified_followers", followersGoalInput)}
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
                    width: `${Math.min(100, (verifiedFollowers / Math.max(1, goals.verified_followers)) * 100)}%`,
                  }}
                />
              </div>

              <div className="xd-goal-meta">
                <span>
                  {verifiedFollowers.toLocaleString()} /{" "}
                  {goals.verified_followers.toLocaleString()} verified
                </span>
                <span>
                  {Math.max(0, goals.verified_followers - verifiedFollowers).toLocaleString()}{" "}
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
              color="#10b981"
            />
            <div className="xd-goal-content">
              <div className="xd-goal-header">
                <div className="xd-goal-title">
                  <span>🚀 Creator Monetization Goal 2 · Organic Impressions</span>
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
                      onClick={() => void handleSaveGoal("impressions", impressionsGoalInput)}
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
                  className="xd-progress-fill"
                  style={{
                    width: `${Math.min(100, (recentImpressions / Math.max(1, goals.impressions)) * 100)}%`,
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
                    ? `~${Math.ceil(Math.max(0, goals.impressions - recentImpressions) / avgImpressionsPerPost)} posts at current velocity`
                    : `${Math.max(0, goals.impressions - recentImpressions).toLocaleString()} remaining`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. INTERACTIVE SVG VISUAL ANALYTICS SUITE */}
        <section className="xd-analytics-grid" aria-label="Visual Analytics Suite">
          {/* Left Panel: Impressions & Engagement Trajectory SVG Chart + Top Post Spotlight */}
          <div className="xd-panel">
            <div className="xd-panel-header">
              <div>
                <h2 className="xd-panel-title">
                  Impressions &amp; Engagement Trajectory (Last {chartPosts.length || 20} Posts)
                </h2>
                <p className="xd-panel-subtitle">
                  Hover or click any bar to inspect post reach, saves, and engagement velocity
                </p>
              </div>
              <span className="xd-kpi-pill">
                Peak Post:{" "}
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
                    viewBox="0 0 680 200"
                    role="img"
                    aria-label="Impressions and engagement trajectory chart"
                  >
                    <defs>
                      <linearGradient id="xdBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#1d9bf0" stopOpacity="0.28" />
                      </linearGradient>
                      <linearGradient id="xdBarActiveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.45" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal reference lines */}
                    {[30, 80, 130, 175].map((y) => (
                      <line
                        key={y}
                        x1="10"
                        y1={y}
                        x2="670"
                        y2={y}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="3 3"
                      />
                    ))}

                    {(() => {
                      const maxImp = Math.max(
                        1,
                        ...chartPosts.map((p) => p.impressions || 0),
                      );
                      const maxEng = Math.max(
                        1,
                        ...chartPosts.map((p) => computePostEngagementRate(p)),
                      );
                      const count = chartPosts.length;
                      const slotW = 650 / Math.max(1, count);
                      const barW = Math.max(8, Math.min(28, slotW * 0.66));

                      const linePoints = chartPosts
                        .map((p, idx) => {
                          const x = 15 + idx * slotW + slotW / 2;
                          const rate = computePostEngagementRate(p);
                          const y = 172 - (rate / maxEng) * 135;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(" ");

                      return (
                        <>
                          {chartPosts.map((post, idx) => {
                            const x = 15 + idx * slotW + (slotW - barW) / 2;
                            const h = Math.max(
                              6,
                              ((post.impressions || 0) / maxImp) * 145,
                            );
                            const y = 175 - h;
                            const isSelected = idx === selectedPostIndex;

                            return (
                              <g
                                key={post.id}
                                className="xd-bar-group"
                                onMouseEnter={() => setSelectedPostIndex(idx)}
                                onClick={() => setSelectedPostIndex(idx)}
                              >
                                <rect
                                  className="xd-bar-rect"
                                  x={x}
                                  y={y}
                                  width={barW}
                                  height={h}
                                  rx="4"
                                  fill={
                                    isSelected
                                      ? "url(#xdBarActiveGrad)"
                                      : "url(#xdBarGrad)"
                                  }
                                />
                                <text
                                  x={x + barW / 2}
                                  y="192"
                                  textAnchor="middle"
                                  fill="rgba(148,163,184,0.75)"
                                  fontSize="9"
                                  fontFamily="monospace"
                                >
                                  {(post.created_at || "").slice(5, 10)}
                                </text>
                              </g>
                            );
                          })}

                          {/* Overlay Engagement Rate Polyline */}
                          {chartPosts.length > 1 ? (
                            <polyline
                              fill="none"
                              stroke="#fbbf24"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={linePoints}
                            />
                          ) : null}
                        </>
                      );
                    })()}
                  </svg>

                  {activeChartPost ? (
                    <div className="xd-chart-hud" data-testid="xd-chart-hud">
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
              <div className="xd-spotlight-card" data-testid="xd-top-post-spotlight">
                <div className="xd-spotlight-top">
                  <span className="xd-spotlight-badge">
                    👑 #1 Top Performing Post Spotlight
                  </span>
                  <a
                    href={
                      analytics.top_post.url ||
                      `https://x.com/${handle}/status/${analytics.top_post.id}`
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
                    👁 {analytics.top_post.impressions.toLocaleString()} impressions
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
                    🔖 {(analytics.top_post.bookmarks || 0).toLocaleString()} bookmarks
                  </span>
                  <span className="xd-metric-chip" style={{ color: "#34d399" }}>
                    ⚡ {computePostEngagementRate(analytics.top_post)}% ER
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Panel: Engagement Mix & 24-Hour Posting Cadence Heatmap */}
          <div className="xd-panel">
            <div className="xd-panel-header">
              <div>
                <h2 className="xd-panel-title">Engagement Mix &amp; Cadence Rhythm</h2>
                <p className="xd-panel-subtitle">
                  Interaction breakdown &amp; 24-hour UTC reach distribution
                </p>
              </div>
              <span className="xd-kpi-pill is-emerald">
                Peak Window: {peakHourInfo.peakHourLabel}
              </span>
            </div>

            <div className="xd-mix-list">
              {[
                {
                  label: "Likes",
                  val: analytics?.total_likes ?? 0,
                  color: "#f43f5e",
                },
                {
                  label: "Reposts",
                  val: analytics?.total_reposts ?? 0,
                  color: "#10b981",
                },
                {
                  label: "Replies",
                  val: analytics?.total_replies ?? 0,
                  color: "#38bdf8",
                },
                {
                  label: "Bookmarks",
                  val: analytics?.total_bookmarks ?? 0,
                  color: "#f59e0b",
                },
                {
                  label: "Quotes",
                  val: analytics?.total_quotes ?? 0,
                  color: "#8b5cf6",
                },
              ].map((item) => {
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
                    <div className="xd-mix-bar-bg">
                      <div
                        className="xd-mix-bar-fill"
                        style={{
                          width: `${Math.max(3, pct)}%`,
                          background: item.color,
                        }}
                      />
                    </div>
                    <span className="xd-mix-val">
                      {item.val.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 8 }}>
              <div className="xd-panel-header" style={{ marginBottom: 4 }}>
                <span className="xd-kpi-label">24-Hour Posting Activity Heatmap (UTC)</span>
                <span style={{ fontSize: 11, color: "var(--xd-text-muted)" }}>
                  00h → 23h
                </span>
              </div>

              <div className="xd-cadence-strip" aria-label="24-Hour Posting Activity">
                {peakHourInfo.byHour.map((count, hr) => {
                  const maxCount = Math.max(1, ...peakHourInfo.byHour);
                  const heightPct = Math.max(8, Math.round((count / maxCount) * 100));
                  return (
                    <div
                      key={hr}
                      className="xd-cadence-col"
                      title={`${String(hr).padStart(2, "0")}:00 UTC — ${count} posts (${(peakHourInfo.impByHour[hr] || 0).toLocaleString()} impressions)`}
                    >
                      <div
                        className="xd-cadence-bar"
                        style={{
                          height: `${heightPct}%`,
                          opacity: count > 0 ? 0.95 : 0.22,
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
          </div>
        </section>

        {/* 5. INTERACTIVE POSTS EXPLORER + MENTIONS FEED + CONNECTION INSPECTOR */}
        <section className="xd-panel" aria-label="Interactive Posts and Mentions Explorer">
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
                      <article key={post.id} className="xd-post-card">
                        <div className="xd-post-top">
                          <span>
                            <strong>@{handle}</strong> · {formatRelativeTime(post.created_at)}{" "}
                            <span style={{ opacity: 0.6 }}>
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
                            href={post.url || `https://x.com/${handle}/status/${post.id}`}
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
                    <p className="xd-post-text" style={{ color: "var(--xd-text-muted)" }}>
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
                  <article key={m.id} className="xd-post-card">
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
                          m.url || `https://x.com/${m.author_username}/status/${m.id}`
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
                  <p className="xd-post-text" style={{ color: "var(--xd-text-muted)" }}>
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
                  >
                    <div className="xd-kpi-top">
                      <strong style={{ fontSize: 13 }}>{src.label}</strong>
                      <span
                        className={
                          src.detected ? "xd-kpi-pill is-emerald" : "xd-kpi-pill is-amber"
                        }
                      >
                        {src.detected ? "Detected" : "Optional"}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: "4px 0",
                        fontSize: 12,
                        color: "var(--xd-text-muted)",
                      }}
                    >
                      {src.detail || (src.detected ? "Ready for telemetry" : "Not configured")}
                    </p>
                    {src.handle ? (
                      <span
                        style={{
                          fontFamily: "var(--xd-font-mono)",
                          fontSize: 11.5,
                          color: "var(--xd-accent-cyan)",
                        }}
                      >
                        Linked Handle: @{src.handle}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="xd-post-card">
                <div className="xd-post-top">
                  <strong>Zero-Cost Guarantee &amp; Hermes Auto-Link Policy</strong>
                  <span className="xd-zero-cost-badge">Cost Policy: $0.00 Default</span>
                </div>
                <p className="xd-post-text" style={{ color: "var(--xd-text-muted)" }}>
                  {status?.cost_policy ||
                    "X Dashboard automatically links your existing Hermes X credentials (~/.xurl, XCHAT_ACCESS_TOKEN, or public handle) and defaults to 100% Free Mode so routine dashboard refreshes never burn paid X API credits."}
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
