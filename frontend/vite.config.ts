import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromSrc = (path: string): string => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

// Aliases idênticos aos de tsconfig.app.json. O Vitest usa esta mesma configuração.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@api': fromSrc('api'),
      '@features': fromSrc('features'),
      '@components': fromSrc('components'),
      '@': fromSrc(''),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});