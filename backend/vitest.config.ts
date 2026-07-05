import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/server.ts',
        'src/config/database.ts',
      ],
    },
    // Run each test file in its own worker to isolate module mocks
    isolate: true,
    // Silence the Morgan request logs during tests
    silent: false,
  },
});
