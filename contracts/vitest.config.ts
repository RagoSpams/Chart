import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // The generated contract module lives under managed/, produced by
    // `compact compile` (see package.json's `test` script) — not checked in.
  },
});
