import XDashboardPage, {
  formatCompactNumber,
  formatRelativeTime,
} from "../src/XDashboardPage";
import {
  configureXDashboardHost,
  loadDashboardData,
  saveDashboardConfig,
} from "../src/sdk";
import {
  computeAnalyticsFromPosts,
  computePostEngagementRate,
  normalizeSummaryPayload,
} from "../src/types";
import {
  X_DASHBOARD_DESKTOP_PATH,
  createXDashboardContributions,
} from "../src/desktop/contract";
import { createDesktopXDashboardHost } from "../src/desktop/host";

export {
  configureXDashboardHost,
  loadDashboardData,
  saveDashboardConfig,
  computeAnalyticsFromPosts,
  computePostEngagementRate,
  normalizeSummaryPayload,
  formatCompactNumber,
  formatRelativeTime,
  X_DASHBOARD_DESKTOP_PATH,
  createXDashboardContributions,
  createDesktopXDashboardHost,
};

export default XDashboardPage;
