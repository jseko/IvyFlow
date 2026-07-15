import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    testTimeout: 30000,
    coverage: {
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli/**',
        'src/commands/**',
        'src/core/openspec.ts',
        'src/core/command-error.ts',
        'src/**/*.test.ts',
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
});
