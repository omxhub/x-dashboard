import { defineConfig } from "vite";
import path from "path";

// Builds X Dashboard as a single IIFE bundle that the Hermes Web Dashboard host
// loads at runtime. React (and the JSX runtime) are NOT bundled — they are
// aliased to thin shims that read window.__HERMES_PLUGIN_SDK__.React (with a
// fallback to window.React), so the plugin shares the host's single React
// instance.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(__dirname, "src/shims/jsx-runtime.js") },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(__dirname, "src/shims/jsx-runtime.js") },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, "src/shims/react.js") },
      { find: /^react$/, replacement: path.resolve(__dirname, "src/shims/react.js") },
    ],
  },
  build: {
    outDir: "dashboard/dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.tsx"),
      formats: ["iife"],
      name: "HermesXDashboardPlugin",
      fileName: () => "index.js",
    },
    rollupOptions: {
      output: { assetFileNames: "style.css" },
    },
  },
});
