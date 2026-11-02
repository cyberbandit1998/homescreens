import { defineConfig } from 'vitest/config';

// Mirrors vite.config.ts: the host provides React as a global, so JSX is
// compiled to React.createElement and tests install the same global.
export default defineConfig({
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
  },
});
