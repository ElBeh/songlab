// Guards the build-time version injection: the constant must exist in every
// environment that compiles the app (Vite build and Vitest) and must stay in
// sync with package.json, which is the single source of truth.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// jsdom exposes import.meta.url as an http URL, so resolve from the project
// root instead; Vitest runs with the repository root as its working directory.
const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'),
) as { version: string };

describe('__APP_VERSION__', () => {
  it('is injected as a non-empty string', () => {
    expect(typeof __APP_VERSION__).toBe('string');
    expect(__APP_VERSION__.length).toBeGreaterThan(0);
  });

  it('matches the version in package.json', () => {
    expect(__APP_VERSION__).toBe(packageJson.version);
  });

  it('follows the major.minor.patch format', () => {
    expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+/);
  });
});