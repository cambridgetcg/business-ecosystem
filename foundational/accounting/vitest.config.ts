import { defineConfig } from 'vitest/config';

// tests/ also holds the package's Python suite, which pytest runs in
// offline-evidence.yml; vitest runs the TypeScript tests in tests/ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/ts/**/*.test.ts'],
  },
});
