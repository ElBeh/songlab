// Tests for loading, clamping and persisting the zoom level.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePersistedScale } from './usePersistedScale';
import { getConfig, setConfig } from '../services/db';

const RANGE = { min: 0.7, max: 2 };

// Each test uses its own key, the IndexedDB persists between tests
describe('usePersistedScale', () => {
  it('starts with the default scale when nothing is stored', async () => {
    const { result } = renderHook(() =>
      usePersistedScale({ configKey: 'scaleEmpty', defaultScale: 1, ...RANGE }));
    await waitFor(() => expect(result.current.scale).toBe(1));
  });

  it('loads the stored scale', async () => {
    await setConfig('scaleStored', 1.4);
    const { result } = renderHook(() =>
      usePersistedScale({ configKey: 'scaleStored', defaultScale: 1, ...RANGE }));
    await waitFor(() => expect(result.current.scale).toBe(1.4));
  });

  it('clamps a stored value outside the range', async () => {
    await setConfig('scaleTooLarge', 5);
    const { result } = renderHook(() =>
      usePersistedScale({ configKey: 'scaleTooLarge', defaultScale: 1, ...RANGE }));
    await waitFor(() => expect(result.current.scale).toBe(2));
  });

  it('steps without float drift, stops at the limits and saves each change', async () => {
    await setConfig('scaleSteps', 1.8);
    const { result } = renderHook(() =>
      usePersistedScale({ configKey: 'scaleSteps', defaultScale: 1, ...RANGE }));
    await waitFor(() => expect(result.current.scale).toBe(1.8));

    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    expect(result.current.scale).toBe(2);

    act(() => result.current.zoomOut());
    expect(result.current.scale).toBe(1.9);
    await waitFor(async () => expect(await getConfig<number>('scaleSteps')).toBe(1.9));
  });
});