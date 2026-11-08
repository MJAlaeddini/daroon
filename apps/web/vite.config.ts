import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/* which build this is: "<short hash> <commit date>", from deploy/update.sh (the server builds without .git) or git */
function buildId(): string {
  if (process.env.BUILD_ID) return process.env.BUILD_ID;
  try {
    return execSync("git log -1 --format='%h %cs'", { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

const api = { '/api': { target: process.env.API_URL ?? 'http://localhost:8787', changeOrigin: false } };

export default defineConfig({
  define: { __BUILD__: JSON.stringify(buildId()) },
  server: { port: 5173, proxy: api },
  preview: { port: 4173, proxy: api },
  build: {
    target: 'es2022',
    sourcemap: true,
    // stone.html is the emotion stone's workbench (src/stone/demo.ts), served at /stone.html
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), stone: resolve(import.meta.dirname, 'stone.html') },
    },
  },
  plugins: [
    VitePWA({
      // the app asks before reloading, so an update never interrupts someone mid-entry
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'درون',
        short_name: 'درون',
        description: 'دفترچه‌ی شخصی احساس‌ها',
        lang: 'fa',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#110e18',
        theme_color: '#f8f6f4',
        categories: ['health', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webp}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/fiqh(\/|$)/, /^\/stone/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
