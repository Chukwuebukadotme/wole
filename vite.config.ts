import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // three.js alone is ~600 kB minified; one bundle per game is expected.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      // Two pages: West Road Life (London) at the root, and Wole Wole (Lagos) at /lagos/.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        lagos: resolve(import.meta.dirname, 'lagos/index.html'),
      },
    },
  },
});
