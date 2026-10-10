import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // three.js alone is ~600 kB minified; one game bundle is expected.
    chunkSizeWarningLimit: 1600,
  },
});
