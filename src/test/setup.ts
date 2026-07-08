// Vitest global test setup.
// Registers jest-dom matchers on Vitest's expect and clears the
// rendered DOM after every test to keep cases isolated.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
