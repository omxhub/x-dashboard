import type { ReactNode } from "react";

export const X_DASHBOARD_DESKTOP_PATH = "/x-dashboard";

export interface XDashboardContribution {
  id: string;
  area: string;
  title?: string;
  order: number;
  data: Record<string, unknown>;
  render?: () => ReactNode;
}

export function createXDashboardContributions(
  render: () => ReactNode,
  navigate: (path: string) => void = () => undefined,
): XDashboardContribution[] {
  return [
    {
      id: "page",
      area: "routes",
      title: "X Dashboard",
      order: 90,
      data: { path: X_DASHBOARD_DESKTOP_PATH },
      render,
    },
    {
      id: "nav",
      area: "sidebar.nav",
      order: 90,
      data: {
        path: X_DASHBOARD_DESKTOP_PATH,
        label: "X Dashboard",
        codicon: "graph",
      },
    },
    {
      id: "open",
      area: "palette",
      order: 90,
      data: {
        id: "x-dashboard.open",
        label: "Open X Dashboard",
        keywords: ["x", "twitter", "analytics", "dashboard"],
        run: () => navigate(X_DASHBOARD_DESKTOP_PATH),
      },
    },
  ];
}
