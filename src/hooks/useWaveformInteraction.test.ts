// Tests for the shared waveform pointer interaction (A/B loop, dragging).
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWaveformInteraction } from './useWaveformInteraction';
import { useLoopStore } from '../stores/useLoopStore';
import { useSongStore } from '../stores/useSongStore';
import type { SectionMarker } from '../types';

const MARKER: SectionMarker = {
  id: 'm1',
  songId: 's1',
  type: 'verse',
  label: 'Verse 1',
  startTime: 10,
  color: '#123456',
};

/** Container spanning 0..100px, so clientX maps directly to a percentage. */
function makeContainerRef() {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;
  return { current: el };
}

/** React mouse event stub for the click handler (reads nativeEvent). */
function clickEvent(clientX: number) {
  return { nativeEvent: { clientX } } as unknown as React.MouseEvent;
}

/** React mouse event stub for mousedown handlers (reads clientX directly). */
function mouseDownEvent(clientX: number) {
  return {
    clientX,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as React.MouseEvent;
}

function dispatchWindowMouse(type: 'mousemove' | 'mouseup', clientX: number) {
  window.dispatchEvent(new MouseEvent(type, { clientX }));
}

type UpdateMarker = (marker: SectionMarker) => Promise<void>;

describe('useWaveformInteraction', () => {
  let updateMarker: Mock<UpdateMarker>;

  beforeEach(() => {
    useLoopStore.getState().clearLoop();
    updateMarker = vi.fn<UpdateMarker>(async () => {});
    useSongStore.setState({ updateMarker });
  });

  function setup(onSeek?: (time: number) => void) {
    const containerRef = makeContainerRef();
    const view = renderHook(() =>
      useWaveformInteraction({ containerRef, duration: 200, markers: [MARKER], onSeek }),
    );
    return view;
  }

  it('seeks on a plain click when A/B mode is off', () => {
    const onSeek = vi.fn();
    const { result } = setup(onSeek);

    act(() => result.current.handleClick(clickEvent(25)));
    expect(onSeek).toHaveBeenCalledWith(50);
  });

  it('leaves plain clicks alone when no seek handler is given', () => {
    const { result } = setup();
    act(() => result.current.handleClick(clickEvent(25)));
    expect(useLoopStore.getState().loop).toBeNull();
  });

  it('sets the A point on the first click in A/B mode', () => {
    const onSeek = vi.fn();
    const { result } = setup(onSeek);
    act(() => useLoopStore.getState().toggleAbMode());

    act(() => result.current.handleClick(clickEvent(10)));

    expect(onSeek).not.toHaveBeenCalled();
    expect(useLoopStore.getState().abStart).toBe(20);
    expect(useLoopStore.getState().loop).toBeNull();
  });

  it('creates the loop on the second click and leaves A/B mode', () => {
    const { result } = setup();
    act(() => useLoopStore.getState().toggleAbMode());

    act(() => result.current.handleClick(clickEvent(40)));
    act(() => result.current.handleClick(clickEvent(10)));

    expect(useLoopStore.getState().loop).toEqual({ start: 20, end: 80, label: 'A/B' });
    expect(useLoopStore.getState().abStart).toBeNull();
    expect(useLoopStore.getState().abMode).toBe(false);
  });

  it('drags the loop start handle to a new position', () => {
    const { result } = setup();
    act(() => useLoopStore.getState().setLoop({ start: 20, end: 80 }));

    act(() => result.current.handleLoopHandleMouseDown(mouseDownEvent(10), 'loopStart'));
    act(() => dispatchWindowMouse('mouseup', 15));

    expect(useLoopStore.getState().loop?.start).toBe(30);
    expect(useLoopStore.getState().loop?.end).toBe(80);
  });

  it('keeps a minimum length when a handle is dragged past the other', () => {
    const { result } = setup();
    act(() => useLoopStore.getState().setLoop({ start: 20, end: 80 }));

    act(() => result.current.handleLoopHandleMouseDown(mouseDownEvent(10), 'loopStart'));
    act(() => dispatchWindowMouse('mouseup', 95));

    expect(useLoopStore.getState().loop?.start).toBe(79.5);
  });

  it('tracks the drag preview while the pointer moves', () => {
    const { result } = setup();
    act(() => useLoopStore.getState().setLoop({ start: 20, end: 80 }));

    act(() => result.current.handleLoopHandleMouseDown(mouseDownEvent(10), 'loopEnd'));
    act(() => dispatchWindowMouse('mousemove', 60));

    expect(result.current.drag?.type).toBe('loopEnd');
    expect(result.current.drag?.previewPercent).toBeCloseTo(0.6);
  });

  it('moves a marker on drag', () => {
    const { result } = setup();

    act(() => result.current.handleMarkerMouseDown(mouseDownEvent(5), 'm1'));
    act(() => dispatchWindowMouse('mouseup', 25));

    expect(updateMarker).toHaveBeenCalledWith({ ...MARKER, startTime: 50 });
  });

  it('ignores marker drags while in A/B mode', () => {
    const { result } = setup();
    act(() => useLoopStore.getState().toggleAbMode());

    act(() => result.current.handleMarkerMouseDown(mouseDownEvent(5), 'm1'));
    expect(result.current.drag).toBeNull();
  });

  it('suppresses the click that ends a drag', () => {
    const onSeek = vi.fn();
    const { result } = setup(onSeek);
    act(() => useLoopStore.getState().setLoop({ start: 20, end: 80 }));

    act(() => result.current.handleLoopHandleMouseDown(mouseDownEvent(10), 'loopStart'));
    act(() => dispatchWindowMouse('mouseup', 15));
    act(() => result.current.handleClick(clickEvent(15)));

    expect(onSeek).not.toHaveBeenCalled();

    // The next click works normally again
    act(() => result.current.handleClick(clickEvent(15)));
    expect(onSeek).toHaveBeenCalledWith(30);
  });

  it('pauses and resumes playback around a drag', () => {
    const containerRef = makeContainerRef();
    const onDragPause = vi.fn(() => true);
    const onDragResume = vi.fn();
    const { result } = renderHook(() =>
      useWaveformInteraction({
        containerRef,
        duration: 200,
        markers: [MARKER],
        onDragPause,
        onDragResume,
      }),
    );
    act(() => useLoopStore.getState().setLoop({ start: 20, end: 80 }));

    act(() => result.current.handleLoopHandleMouseDown(mouseDownEvent(10), 'loopStart'));
    expect(onDragPause).toHaveBeenCalled();

    act(() => dispatchWindowMouse('mouseup', 15));
    expect(onDragResume).toHaveBeenCalled();
  });
});