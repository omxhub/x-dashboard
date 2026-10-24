import XDashboardPage, { ensureXDashboardStyles } from "./XDashboardPage";
import "./x-dashboard.css";

ensureXDashboardStyles();

if (typeof window !== "undefined") {
  const registry = (window as unknown as {
    __HERMES_PLUGINS__?: {
      register?: (name: string, component: unknown) => void;
      [key: string]: unknown;
    };
  }).__HERMES_PLUGINS__ || ((window as unknown as Record<string, unknown>).__HERMES_PLUGINS__ = {});

  if (typeof registry.register === "function") {
    registry.register("x-dashboard", XDashboardPage);
  }
  registry["x-dashboard"] = XDashboardPage;
}

export default XDashboardPage;
