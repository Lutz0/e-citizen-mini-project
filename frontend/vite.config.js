import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The SPA talks to the Django API through a same-origin "/api" path. In
// development (and `vite preview`) Vite proxies it to the backend, which means:
//   * no CORS configuration is needed, and
//   * the session + CSRF cookies are first-party, so they work without
//     weakening any cookie settings.
// `changeOrigin` is deliberately left off so the browser's Host header is kept;
// Django's CSRF origin check compares Origin with Host.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_DEV_API_TARGET || "http://127.0.0.1:8000";
  const proxy = { "/api": { target } };

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.js",
      css: false,
    },
  };
});
