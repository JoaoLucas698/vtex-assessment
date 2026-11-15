import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// `globals: false` no Vitest: o cleanup automático do Testing Library não se registra sozinho.
afterEach(() => {
  cleanup();
});