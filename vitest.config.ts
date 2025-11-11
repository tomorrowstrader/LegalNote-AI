import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/**/*.test.ts', 'server/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/client/**', '**/.cache/**'],
  },
});
