import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global test setup
    setupFiles: ['./test/setup.ts'],

    // Include patterns
    include: [
      'test/**/*.test.ts',
      'test/**/*.spec.ts',
    ],

    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      'infrastructure',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },

    // Globals
    globals: true,

    // Timeout (increased for integration tests with testcontainers)
    testTimeout: 30000,
    hookTimeout: 120000,

    // Reporter
    reporters: ['verbose'],

    // Type checking
    typecheck: {
      enabled: true,
    },

    // Pool options for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': '/src',
      '@test': '/test',
    },
  },
});
