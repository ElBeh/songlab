// Tests for the simulated playback clock of dummy songs.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDummyPlayback } from './useDummyPlayback';

const FRAME_MS = 16;
// Real rAF timestamps are never zero; the hook treats zero as "no frame yet"
const START_MS = 1000;

let frameQueue = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

/** Run all pending rAF callbacks with the given timestamp. */
function runFrame(timestamp: number) {
  const callbacks = [...frameQueue.values()];
  frameQueue = new Map();
  act(() => {
    for (const cb of callbacks) cb(timestamp);
  });
}

describe('useDummyPlayback', () => {
  beforeEach(() => {
    frameQueue = new Map();
    nextFrameId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextFrameId++;
      frameQueue.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frameQueue.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('advances in real time when callbacks change identity on every render', () => {
    // Inline callbacks get a new identity on each render, as in AppShell
    const { result } = renderHook(() =>
      useDummyPlayback({ duration: 60, onTimeUpdate: () => {}, onFinish: () => {} }),
    );

    act(() => result.current.handlePlayPause());

    // First frame only initializes the clock
    runFrame(START_MS);
    for (let i = 1; i <= 60; i++) runFrame(START_MS + i * FRAME_MS);

    expect(result.current.currentTime).toBeCloseTo((60 * FRAME_MS) / 1000, 5);
  });

  it('calls the latest onFinish when the end is reached', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { result, rerender } = renderHook(
      ({ onFinish }) => useDummyPlayback({ duration: 0.1, onFinish }),
      { initialProps: { onFinish: first } },
    );

    act(() => result.current.handlePlayPause());
    runFrame(START_MS);
    rerender({ onFinish: latest });
    runFrame(START_MS + 200);

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);
  });
});