import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the same build works on web hosts and inside the Capacitor app.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
});
