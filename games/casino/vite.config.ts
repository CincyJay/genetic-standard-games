import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Relative paths so the same build works on web hosts and inside the Capacitor app.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    // the prototype build also carries the slot station close-up (VA-0075); production does not
    rollupOptions: mode === 'proto' ? { input: { main: 'index.html', station: 'station.html' } } : undefined,
  },
}));
