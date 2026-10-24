import {
  normalizeSummaryPayload,
  type NormalizedXDashboardData,
  type XAccount,
  type XConfigUpdate,
  type XMention,
  type XPost,
  type XStatus,
  type XSummaryPayload,
} from "./types";

export const PLUGIN_API_PREFIX = "/api/plugins/x-dashboard";

export interface XDashboardHost {
  fetchJSON: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  navigateTo: (routePath: string) => void;
}

declare global {
  interface Window {
    __HERMES_PLUGIN_SDK__?: {
      React?: unknown;
      fetchJSON?: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
      [key: string]: unknown;
    };
    __HERMES_PLUGINS__?: {
      register?: (name: string, component: unknown) => void;
      [key: string]: unknown;
    };
    React?: unknown;
  }
}

let configuredHost: XDashboardHost | null = null;

export function configureXDashboardHost(host: XDashboardHost | null): void {
  configuredHost = host;
}

function getDefaultHost(): XDashboardHost {
  const sdk = typeof window !== "undefined" ? window.__HERMES_PLUGIN_SDK__ : undefined;
  const sdkFetch = sdk && typeof sdk.fetchJSON === "function" ? sdk.fetchJSON.bind(sdk) : null;

  return {
    fetchJSON: async <T = unknown>(url: string, init?: RequestInit): Promise<T> => {
      if (sdkFetch) {
        return sdkFetch<T>(url, init);
      }
      const res = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return (await res.json()) as T;
    },
    navigateTo: (routePath: string) => {
      if (typeof window !== "undefined" && window.location) {
        window.location.assign(routePath);
      }
    },
  };
}

export function getHost(): XDashboardHost {
  return configuredHost ?? getDefaultHost();
}

export function fetchJSON<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  return getHost().fetchJSON<T>(url, init);
}

export function navigateTo(routePath: string): void {
  getHost().navigateTo(routePath);
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export async function loadDashboardData(options?: {
  handle?: string;
  mode?: "free" | "auto" | "live_v2" | string;
  refresh?: boolean;
}): Promise<NormalizedXDashboardData> {
  const qs = buildQuery({
    handle: options?.handle,
    mode: options?.mode ?? "auto",
    refresh: options?.refresh ? "true" : "false",
  });

  const summaryRes = await fetchJSON<XSummaryPayload>(`${PLUGIN_API_PREFIX}/summary${qs}`);

  // Check if summaryRes already includes unified v2 slices (account + posts)
  const hasUnifiedAccount =
    summaryRes &&
    typeof summaryRes === "object" &&
    summaryRes.account &&
    typeof summaryRes.account === "object" &&
    ("username" in summaryRes.account || "followers_count" in summaryRes.account);

  const hasUnifiedPosts =
    summaryRes &&
    typeof summaryRes === "object" &&
    summaryRes.posts &&
    Array.isArray(summaryRes.posts.items);

  if (hasUnifiedAccount && hasUnifiedPosts) {
    return normalizeSummaryPayload(summaryRes);
  }

  // Resilient fallback for legacy backend where /summary only returned recent_posts_impressions
  const sliceQs = buildQuery({
    handle: options?.handle,
    mode: options?.mode,
    refresh: options?.refresh ? "true" : undefined,
  });

  const [accountRes, postsRes, mentionsRes, statusRes] = await Promise.all([
    hasUnifiedAccount
      ? Promise.resolve(summaryRes.account as XAccount)
      : fetchJSON<XAccount>(`${PLUGIN_API_PREFIX}/account${sliceQs}`).catch(
          (err): XAccount => ({ ok: false, error: String(err) }),
        ),
    hasUnifiedPosts
      ? Promise.resolve(summaryRes.posts!)
      : fetchJSON<{ ok?: boolean; count?: number; items?: XPost[] }>(
          `${PLUGIN_API_PREFIX}/posts${buildQuery({
            handle: options?.handle,
            limit: 20,
            refresh: options?.refresh ? "true" : undefined,
          })}`,
        ).catch(() => ({ ok: false, items: [] })),
    summaryRes?.mentions && Array.isArray(summaryRes.mentions.items)
      ? Promise.resolve(summaryRes.mentions)
      : fetchJSON<{ ok?: boolean; count?: number; items?: XMention[] }>(
          `${PLUGIN_API_PREFIX}/mentions${buildQuery({
            handle: options?.handle,
            limit: 15,
            refresh: options?.refresh ? "true" : undefined,
          })}`,
        ).catch(() => ({ ok: false, items: [] })),
    summaryRes?.status
      ? Promise.resolve(summaryRes.status)
      : fetchJSON<Partial<XStatus>>(`${PLUGIN_API_PREFIX}/status${sliceQs}`).catch(() => ({})),
  ]);

  return normalizeSummaryPayload({
    ...summaryRes,
    account: accountRes,
    posts: postsRes,
    mentions: mentionsRes,
    status: statusRes,
  });
}

export async function saveDashboardConfig(
  update: XConfigUpdate,
): Promise<{ ok: boolean; config?: unknown }> {
  return fetchJSON<{ ok: boolean; config?: unknown }>(`${PLUGIN_API_PREFIX}/config`, {
    method: "POST",
    body: JSON.stringify(update),
  });
}
