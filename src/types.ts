export interface XAuthSource {
  id: string;
  label: string;
  detected: boolean;
  handle?: string;
  detail?: string;
}

export interface XStatus {
  connected: boolean;
  auto_linked: boolean;
  active_source: string;
  auth_sources: XAuthSource[];
  handle: string;
  available_handles: string[];
  x_search_available: boolean;
  xurl_available: boolean;
  xchat_configured: boolean;
  mode: "free" | "auto" | "live_v2";
  cost_policy: string;
  cache_updated_at?: string;
}

export interface XAccount {
  ok: boolean;
  id?: string;
  username?: string;
  name?: string;
  description?: string;
  profile_image_url?: string;
  banner_url?: string;
  location?: string;
  website?: string;
  created_at?: string;
  subscription_type?: string;
  verified?: boolean;
  verified_type?: string;
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
  listed_count?: number;
  media_count?: number;
  likes_count?: number;
  verified_followers_count?: number;
  verified_followers_cached?: boolean;
  source_mode?: string;
  cost_incurred?: string;
  auto_linked?: boolean;
  fetched_at?: string;
  error?: string;
}

export interface XPostMedia {
  type?: string;
  url?: string;
}

export interface XPost {
  id: string;
  text: string;
  created_at: string;
  created_timestamp?: number;
  lang?: string;
  impressions: number;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  engagement_rate?: number;
  url?: string;
  replying_to?: string;
  media?: XPostMedia[];
}

export interface XMention {
  id: string;
  text: string;
  created_at: string;
  author_username: string;
  author_name?: string;
  author_avatar?: string;
  author_followers?: number;
  impressions: number;
  likes: number;
  reposts: number;
  replies: number;
  url?: string;
}

export interface XAnalytics {
  total_impressions: number;
  total_likes: number;
  total_reposts: number;
  total_replies: number;
  total_bookmarks: number;
  total_quotes: number;
  avg_engagement_rate: number;
  top_post?: XPost | null;
  posting_by_hour: number[];
  impressions_by_hour: number[];
  posting_by_day: Record<string, number>;
}

export interface XHistoryPoint {
  timestamp: string;
  followers_count: number;
  verified_followers_count?: number;
  tweet_count: number;
  following_count: number;
  recent_impressions: number;
}

export interface XGoals {
  verified_followers: number;
  impressions: number;
}

export interface XSummaryPayload {
  ok?: boolean;
  status?: Partial<XStatus>;
  account?: Partial<XAccount>;
  posts?: { ok?: boolean; count?: number; items?: XPost[] };
  mentions?: { ok?: boolean; count?: number; items?: XMention[] };
  analytics?: Partial<XAnalytics>;
  history?: XHistoryPoint[];
  goals?: Partial<XGoals>;
  recent_posts_impressions?: number;
  error?: string;
}

export interface XConfigUpdate {
  handle?: string;
  mode?: "free" | "auto" | "live_v2" | string;
  goals?: Partial<XGoals>;
}

export interface NormalizedXDashboardData {
  status: XStatus;
  account: XAccount;
  posts: XPost[];
  mentions: XMention[];
  analytics: XAnalytics;
  history: XHistoryPoint[];
  goals: XGoals;
}

export function computePostEngagementRate(post: Partial<XPost>): number {
  if (typeof post.engagement_rate === "number" && !Number.isNaN(post.engagement_rate)) {
    return post.engagement_rate;
  }
  const impressions = Math.max(0, post.impressions ?? 0);
  const interactions =
    (post.likes ?? 0) +
    (post.reposts ?? 0) +
    (post.replies ?? 0) +
    (post.quotes ?? 0) +
    (post.bookmarks ?? 0);
  if (impressions <= 0) {
    return interactions > 0 ? Math.min(100, Number((interactions * 0.45).toFixed(2))) : 0;
  }
  return Number(((interactions / impressions) * 100).toFixed(2));
}

export function computeAnalyticsFromPosts(
  posts: XPost[],
  partial?: Partial<XAnalytics>,
  fallbackImpressions?: number,
): XAnalytics {
  let totalImpressions = 0;
  let totalLikes = 0;
  let totalReposts = 0;
  let totalReplies = 0;
  let totalBookmarks = 0;
  let totalQuotes = 0;
  const postingByHour = Array.from({ length: 24 }, () => 0);
  const impressionsByHour = Array.from({ length: 24 }, () => 0);
  const postingByDay: Record<string, number> = {};

  let bestPost: XPost | null = null;
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

  const finalImpressions =
    partial?.total_impressions ?? (totalImpressions || fallbackImpressions || 0);
  const finalLikes = partial?.total_likes ?? totalLikes;
  const finalReposts = partial?.total_reposts ?? totalReposts;
  const finalReplies = partial?.total_replies ?? totalReplies;
  const finalBookmarks = partial?.total_bookmarks ?? totalBookmarks;
  const finalQuotes = partial?.total_quotes ?? totalQuotes;

  const totalEngagements =
    finalLikes + finalReposts + finalReplies + finalBookmarks + finalQuotes;

  const computedAvgRate =
    finalImpressions > 0
      ? Number(((totalEngagements / finalImpressions) * 100).toFixed(2))
      : posts.length > 0
        ? Number(
            (
              posts.reduce((acc, item) => acc + computePostEngagementRate(item), 0) /
              posts.length
            ).toFixed(2),
          )
        : 0;

  const normalizedHourCounts =
    Array.isArray(partial?.posting_by_hour) && partial.posting_by_hour.length === 24
      ? partial.posting_by_hour
      : postingByHour;

  return {
    total_impressions: finalImpressions,
    total_likes: finalLikes,
    total_reposts: finalReposts,
    total_replies: finalReplies,
    total_bookmarks: finalBookmarks,
    total_quotes: finalQuotes,
    avg_engagement_rate:
      typeof partial?.avg_engagement_rate === "number"
        ? Number(partial.avg_engagement_rate.toFixed(2))
        : computedAvgRate,
    top_post: (partial?.top_post as XPost | undefined) ?? bestPost,
    posting_by_hour: normalizedHourCounts,
    impressions_by_hour: impressionsByHour,
    posting_by_day: partial?.posting_by_day ?? postingByDay,
  };
}

export function normalizeSummaryPayload(raw: XSummaryPayload): NormalizedXDashboardData {
  const rawAccount = raw.account ?? {};
  const rawStatus = raw.status ?? {};
  const handle =
    rawStatus.handle ||
    rawAccount.username ||
    "NousResearch";

  const rawPosts = Array.isArray(raw.posts?.items) ? raw.posts!.items! : [];
  const posts: XPost[] = rawPosts.map((p, idx) => ({
    id: String(p.id || `post-${idx}`),
    text: p.text || "",
    created_at: p.created_at || new Date().toISOString(),
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
    media: Array.isArray(p.media) ? p.media : [],
  }));

  const rawMentions = Array.isArray(raw.mentions?.items) ? raw.mentions!.items! : [];
  const mentions: XMention[] = rawMentions.map((m, idx) => ({
    id: String(m.id || `mention-${idx}`),
    text: m.text || "",
    created_at: m.created_at || new Date().toISOString(),
    author_username: m.author_username || "unknown",
    author_name: m.author_name || m.author_username || "X User",
    author_avatar: m.author_avatar,
    author_followers: m.author_followers,
    impressions: Number(m.impressions || 0),
    likes: Number(m.likes || 0),
    reposts: Number(m.reposts || 0),
    replies: Number(m.replies || 0),
    url: m.url || `https://x.com/${m.author_username || "i"}/status/${m.id || idx}`,
  }));

  const defaultAuthSources: XAuthSource[] = [
    {
      id: "xurl",
      label: "Hermes xurl OAuth2 (~/.xurl)",
      detected: Boolean(rawStatus.xurl_available),
      handle: rawStatus.xurl_available ? handle : undefined,
      detail: rawStatus.xurl_available ? "Local OAuth2 token linked" : "Not detected on host",
    },
    {
      id: "xchat",
      label: "Hermes XChat Bridge",
      detected: Boolean(rawStatus.xchat_configured),
      handle: rawStatus.xchat_configured ? handle : undefined,
      detail: rawStatus.xchat_configured ? "XCHAT_ACCESS_TOKEN active" : "No XChat session configured",
    },
    {
      id: "public_free",
      label: "Zero-Cost Public Syndication & Cache",
      detected: true,
      handle,
      detail: "100% Free ($0.00) · Zero API keys required",
    },
  ];

  const status: XStatus = {
    connected: rawStatus.connected ?? Boolean(rawAccount.ok ?? true),
    auto_linked:
      rawStatus.auto_linked ??
      rawAccount.auto_linked ??
      Boolean(rawStatus.xurl_available || rawStatus.xchat_configured),
    active_source:
      rawStatus.active_source ||
      rawAccount.source_mode ||
      (rawStatus.xurl_available
        ? "xurl"
        : rawStatus.xchat_configured
          ? "xchat"
          : "public_free"),
    auth_sources:
      Array.isArray(rawStatus.auth_sources) && rawStatus.auth_sources.length > 0
        ? rawStatus.auth_sources
        : defaultAuthSources,
    handle,
    available_handles:
      Array.isArray(rawStatus.available_handles) && rawStatus.available_handles.length > 0
        ? rawStatus.available_handles
        : [handle],
    x_search_available: Boolean(rawStatus.x_search_available),
    xurl_available: Boolean(rawStatus.xurl_available),
    xchat_configured: Boolean(rawStatus.xchat_configured),
    mode:
      rawStatus.mode === "free" || rawStatus.mode === "live_v2" || rawStatus.mode === "auto"
        ? rawStatus.mode
        : "auto",
    cost_policy:
      rawStatus.cost_policy ||
      "$0.00 Free Mode by default — uses public syndication & local cache without burning X API credits",
    cache_updated_at: rawStatus.cache_updated_at || rawAccount.fetched_at,
  };

  const account: XAccount = {
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
    error: rawAccount.error,
  };

  const analytics = computeAnalyticsFromPosts(
    posts,
    raw.analytics,
    raw.recent_posts_impressions,
  );

  const history: XHistoryPoint[] = Array.isArray(raw.history) ? raw.history : [];

  const goals: XGoals = {
    verified_followers: Number(raw.goals?.verified_followers || 500),
    impressions: Number(raw.goals?.impressions || 500000),
  };

  return {
    status,
    account,
    posts,
    mentions,
    analytics,
    history,
    goals,
  };
}
