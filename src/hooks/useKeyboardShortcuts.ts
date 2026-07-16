import { useEffect, useRef } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useLoopStore } from '../stores/useLoopStore';

interface KeyboardShortcutsOptions {
  wavesurferRef: React.RefObject<WaveSurfer | null>;
  onPlayPause: () => void;
  onAddMarker: () => void;
  onSeek?: (time: number) => void;
  currentTime?: number;
  duration?: number;
  disabled?: boolean;
}

export function useKeyboardShortcuts({
  wavesurferRef,
  onPlayPause,
  onAddMarker,
  onSeek,
  currentTime = 0,
  duration = 0,
  disabled = false,
}: KeyboardShortcutsOptions) {
  const toggleLoop = useLoopStore((state) => state.toggleLoop);
  const loop = useLoopStore((state) => state.loop);

  // Keep fast-changing values and callbacks in a ref so the keydown listener
  // is registered exactly once instead of being detached and re-attached on
  // every playback tick (currentTime updates several times per second).
  const latest = useRef({ onPlayPause, onAddMarker, onSeek, currentTime, duration, disabled, loop, toggleLoop });
  useEffect(() => {
    latest.current = { onPlayPause, onAddMarker, onSeek, currentTime, duration, disabled, loop, toggleLoop };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { onPlayPause, onAddMarker, onSeek, currentTime, duration, disabled, loop, toggleLoop } =
        latest.current;
      if (disabled) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          onPlayPause();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          onAddMarker();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          if (loop) toggleLoop();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (wavesurferRef.current) {
            wavesurferRef.current.setTime(
              Math.max(0, (wavesurferRef.current.getCurrentTime() ?? 0) - 1),
            );
          } else {
            onSeek?.(Math.max(0, currentTime - 1));
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (wavesurferRef.current) {
            wavesurferRef.current.setTime(
              Math.min(
                wavesurferRef.current.getDuration() ?? 0,
                (wavesurferRef.current.getCurrentTime() ?? 0) + 1,
              ),
            );
          } else {
            onSeek?.(Math.min(duration, currentTime + 1));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wavesurferRef]);
}
