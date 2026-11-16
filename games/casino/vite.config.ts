import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the same build works on web hosts and inside the Capacitor app.
  base: './',
  // art modules outside this package may import 'three' themselves (art/src/grandConcourse.mjs):
  // resolve them to this package's copy, so one scene never mixes two three.js versions
  resolve: { dedupe: ['three'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
});
