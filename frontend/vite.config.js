import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Use explicit IPv4 loopback, not "localhost": on Windows "localhost"
      // can resolve to IPv6 (::1) and get hijacked by any other server on
      // :8000, so proxy straight to the uvicorn backend on 127.0.0.1.
      "/api": "http://127.0.0.1:8000",
    },
  },
});
