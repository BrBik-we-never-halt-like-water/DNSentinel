import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Builds into ../public/next/ — served by the existing Express static middleware at
 * /next/, so server.js needs ZERO changes AND the live single-file app at / keeps
 * working while panes are still being ported.
 *
 * Building directly into ../public would overwrite public/index.html, replacing the
 * complete production frontend with a partially-migrated one. The swap to / is a
 * two-line change here (outDir: '../public', base: '/') once every pane and overlay
 * reaches parity.
 *
 * public/ also holds files a build must never delete:
 *   - shared/health-score.js  (server.js requires this at runtime)
 *   - docs.html               (server.js serves this at GET /docs)
 *   - sw.js, manifest.webmanifest, icon.svg, logo.png, robots.txt, sitemap.xml
 */
export default defineConfig(({ command }) => ({
  // Only the production build is served from the /next/ preview path. The dev server
  // stays at / so `npm run dev` behaves like a normal Vite app.
  base: '/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: '../public',
    emptyOutDir: false,   // public/ holds files the build must never delete
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split vendor libs out so app changes don't bust the whole cache.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 127.0.0.1 rather than `localhost`: on Windows `localhost` can resolve to ::1
      // only, and the proxy then fails to reach an IPv4-bound Express process.
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/shared': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
}));
