import { useEffect } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useLoopStore } from '../stores/useLoopStore';

interface KeyboardShortcutsOptions {
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
  onPlayPause: () => void;
  onAddMarker: () => void;
  isPlaying: boolean;
}

export function useKeyboardShortcuts({
  wavesurferRef,
  onPlayPause,
  onAddMarker,
  isPlaying,
}: KeyboardShortcutsOptions) {
  const toggleLoop = useLoopStore((state) => state.toggleLoop);
  const loop = useLoopStore((state) => state.loop);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
          wavesurferRef.current?.setTime(
            Math.max(0, (wavesurferRef.current?.getCurrentTime() ?? 0) - 1),
          );
          break;
        case 'ArrowRight':
          e.preventDefault();
          wavesurferRef.current?.setTime(
            Math.min(
              wavesurferRef.current?.getDuration() ?? 0,
              (wavesurferRef.current?.getCurrentTime() ?? 0) + 1,
            ),
          );
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPlayPause, onAddMarker, wavesurferRef, isPlaying, toggleLoop, loop]);
}