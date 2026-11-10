import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['games/*/tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
