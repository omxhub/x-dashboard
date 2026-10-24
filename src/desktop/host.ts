import { PLUGIN_API_PREFIX, type XDashboardHost } from "../sdk";

export interface DesktopPluginContext {
  rest<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T>;
}

export interface DesktopSdkHost {
  navigate(path: string): void;
}

export function createDesktopXDashboardHost(
  ctx: DesktopPluginContext,
  desktop: DesktopSdkHost,
): XDashboardHost {
  return {
    async fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
      let path = url;
      if (url === PLUGIN_API_PREFIX || url.startsWith(`${PLUGIN_API_PREFIX}/`) || url.startsWith(`${PLUGIN_API_PREFIX}?`)) {
        path = url.slice(PLUGIN_API_PREFIX.length) || "/";
      } else if (!url.startsWith("/")) {
        throw new Error(`Desktop X Dashboard cannot access external path: ${url}`);
      }

      const options: { method?: string; body?: unknown } = {};
      if (init?.method) {
        options.method = init.method;
      }
      if (init?.body !== undefined && init?.body !== null) {
        options.body =
          typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      }
      return ctx.rest<T>(path, options);
    },
    navigateTo: (path: string) => desktop.navigate(path),
  };
}
