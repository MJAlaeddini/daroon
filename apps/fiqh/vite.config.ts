import { defineConfig } from 'vite';

// served under /fiqh/ next to Daroon; change `base` when it moves to its own site
export default defineConfig({
  base: '/fiqh/',
  build: { target: 'es2022' },
});
