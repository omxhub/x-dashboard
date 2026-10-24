import {
  host,
  type HermesPlugin,
  type PluginContext,
} from "@hermes/plugin-sdk";

import XDashboardPage from "../XDashboardPage";
import xDashboardCss from "../x-dashboard.css?inline";
import { configureXDashboardHost } from "../sdk";
import { createXDashboardContributions } from "./contract";
import { createDesktopXDashboardHost } from "./host";

function DesktopXDashboardPage() {
  return (
    <>
      <style>{xDashboardCss}</style>
      <XDashboardPage />
    </>
  );
}

const plugin: HermesPlugin = {
  id: "x-dashboard",
  name: "X Dashboard",
  defaultEnabled: true,
  register(ctx: PluginContext) {
    configureXDashboardHost(createDesktopXDashboardHost(ctx, host));
    ctx.registerMany(
      createXDashboardContributions(
        () => <DesktopXDashboardPage />,
        (path) => host.navigate(path),
      ),
    );
  },
};

export default plugin;
