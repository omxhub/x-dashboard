import { build } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "test", ".build", "x-dashboard-page.mjs");

await build({
  root,
  logLevel: "warn",
  resolve: {
    alias: [
      {
        find: /^react\/jsx-runtime$/,
        replacement: path.resolve(root, "src/shims/jsx-runtime.js"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: path.resolve(root, "src/shims/jsx-runtime.js"),
      },
      { find: /^react-dom$/, replacement: path.resolve(root, "src/shims/react.js") },
      { find: /^react$/, replacement: path.resolve(root, "src/shims/react.js") },
    ],
  },
  build: {
    outDir: path.join(root, "test", ".build"),
    emptyOutDir: true,
    minify: false,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(root, "test/x-dashboard-entry.ts"),
      formats: ["es"],
      fileName: () => "x-dashboard-page.mjs",
    },
    rollupOptions: { external: ["react", "react-dom", "react/jsx-runtime"] },
  },
});

console.log(`built ${out}`);
