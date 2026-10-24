import { defineConfig } from "vite";
import path from "path";

// Hermes Desktop loads one plain ESM file from
// ~/.hermes/desktop-plugins/x-dashboard/plugin.js. React and the Desktop
// plugin SDK stay external so the runtime loader binds them to the
// application's live singletons.
export default defineConfig({
  build: {
    outDir: "desktop",
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "src/desktop/index.tsx"),
      formats: ["es"],
      fileName: () => "plugin.js",
    },
    rollupOptions: {
      external: ["@hermes/plugin-sdk", "react", "react/jsx-runtime"],
    },
  },
});
