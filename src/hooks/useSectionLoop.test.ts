// Tests for the shared section loop enforcement.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSectionLoop } from './useSectionLoop';
import { useLoopStore } from '../stores/useLoopStore';

function resetLoopStore() {
  useLoopStore.getState().clearLoop();
  useLoopStore.getState().resetLoopCount();
}

describe('useSectionLoop', () => {
  beforeEach(() => {
    resetLoopStore();
  });

  it('does nothing without an active loop', () => {
    const onSeek = vi.fn();
    renderHook(() => useSectionLoop({ isPlaying: true, currentTime: 30, onSeek }));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('does nothing while the position is inside the loop', () => {
    useLoopStore.getState().setLoop({ start: 10, end: 20 });
    const onSeek = vi.fn();
    renderHook(() => useSectionLoop({ isPlaying: true, currentTime: 15, onSeek }));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('jumps back to the loop start when the end is reached', () => {
    useLoopStore.getState().setLoop({ start: 10, end: 20 });
    const onSeek = vi.fn();
    renderHook(() => useSectionLoop({ isPlaying: true, currentTime: 20.1, onSeek }));
    expect(onSeek).toHaveBeenCalledWith(10);
    expect(useLoopStore.getState().loopCount).toBe(1);
  });

  it('stays put while playback is paused', () => {
    useLoopStore.getState().setLoop({ start: 10, end: 20 });
    const onSeek = vi.fn();
    renderHook(() => useSectionLoop({ isPlaying: false, currentTime: 25, onSeek }));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('stays put when disabled', () => {
    useLoopStore.getState().setLoop({ start: 10, end: 20 });
    const onSeek = vi.fn();
    renderHook(() =>
      useSectionLoop({ isPlaying: true, currentTime: 25, onSeek, enabled: false }),
    );
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('does not act when the loop is toggled off but still set', () => {
    useLoopStore.getState().setLoop({ start: 10, end: 20 });
    useLoopStore.getState().toggleLoop();
    const onSeek = vi.fn();
    renderHook(() => useSectionLoop({ isPlaying: true, currentTime: 25, onSeek }));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('disables the loop once the target count is reached', () => {
    useLoopStore.getState().setLoop({ start: 10, end: 20 });
    useLoopStore.getState().setLoopTarget(1);
    const onSeek = vi.fn();
    renderHook(() => useSectionLoop({ isPlaying: true, currentTime: 20, onSeek }));

    expect(onSeek).not.toHaveBeenCalled();
    expect(useLoopStore.getState().loopEnabled).toBe(false);
    expect(useLoopStore.getState().loopCount).toBe(0);
  });

  it('re-evaluates when playback resumes past the loop end', () => {
    useLoopStore.getState().setLoop({ start: 10, end: 20 });
    const onSeek = vi.fn();
    const { rerender } = renderHook(
      ({ isPlaying }) => useSectionLoop({ isPlaying, currentTime: 25, onSeek }),
      { initialProps: { isPlaying: false } },
    );
    expect(onSeek).not.toHaveBeenCalled();

    rerender({ isPlaying: true });
    expect(onSeek).toHaveBeenCalledWith(10);
  });
});