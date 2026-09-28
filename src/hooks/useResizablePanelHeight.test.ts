// Tests for loading and persisting the resizable panel height.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useResizablePanelHeight } from './useResizablePanelHeight';
import { getConfig, setConfig } from '../services/db';

// Each test uses its own keys, the IndexedDB persists between tests
describe('useResizablePanelHeight', () => {
  it('starts with the default height when nothing is stored', async () => {
    const { result } = renderHook(() =>
      useResizablePanelHeight({ configKey: 'empty', fallbackConfigKey: 'emptyFallback', defaultHeight: 400 }));
    await waitFor(() => expect(result.current.height).toBe(400));
  });

  it('uses the fallback key until an own height is stored', async () => {
    await setConfig('fallbackOnly', 520);
    const { result } = renderHook(() =>
      useResizablePanelHeight({ configKey: 'ownUnset', fallbackConfigKey: 'fallbackOnly', defaultHeight: 400 }));
    await waitFor(() => expect(result.current.height).toBe(520));
  });

  it('prefers the own stored height over the fallback', async () => {
    await setConfig('fallbackShared', 520);
    await setConfig('ownSet', 300);
    const { result } = renderHook(() =>
      useResizablePanelHeight({ configKey: 'ownSet', fallbackConfigKey: 'fallbackShared', defaultHeight: 400 }));
    await waitFor(() => expect(result.current.height).toBe(300));
  });

  it('saves changes under the own key only', async () => {
    await setConfig('fallbackKept', 520);
    const { result } = renderHook(() =>
      useResizablePanelHeight({ configKey: 'ownSaved', fallbackConfigKey: 'fallbackKept', defaultHeight: 400 }));
    await waitFor(() => expect(result.current.height).toBe(520));

    act(() => result.current.adjustHeight(24));
    await waitFor(async () => expect(await getConfig<number>('ownSaved')).toBe(544));
    expect(await getConfig<number>('fallbackKept')).toBe(520);
  });
});