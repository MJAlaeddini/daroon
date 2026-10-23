import { defineConfig } from 'vite';

const api = { '/api': { target: process.env.API_URL ?? 'http://localhost:8787', changeOrigin: false } };

export default defineConfig({
  server: { port: 5173, proxy: api },
  preview: { port: 4173, proxy: api },
  build: { target: 'es2022', sourcemap: true },
});
