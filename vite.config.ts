import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Force a single React instance — prevents minified error #321
// (Invalid hook call) when a dependency pulls a second copy of React
// into the Capacitor / production bundle.
const reactRoot = path.resolve(__dirname, "node_modules/react");
const reactDomRoot = path.resolve(__dirname, "node_modules/react-dom");

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: reactRoot,
      "react-dom": reactDomRoot,
      "react/jsx-runtime": path.resolve(reactRoot, "jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(reactRoot, "jsx-dev-runtime.js"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
      "react-router",
      "react-router-dom",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "react-helmet-async",
    ],
  },
  build: {
    target: "es2020",
    sourcemap: false,
    minify: "terser",
    commonjsOptions: {
      include: [/node_modules/],
      // Ensure CJS deps that require("react") resolve to the same instance
      transformMixedEsModules: true,
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
  },
});
