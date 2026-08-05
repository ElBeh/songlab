import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useLoopStore } from '../stores/useLoopStore';
import { useSongStore } from '../stores/useSongStore';
import type { SectionMarker } from '../types';

/** Minimum loop length in seconds kept while dragging a loop handle */
const MIN_LOOP_LENGTH = 0.5;

export interface WaveformDragState {
  type: 'marker' | 'loopStart' | 'loopEnd';
  markerId?: string;
  /** Whether playback was running when the drag started */
  wasPlaying: boolean;
  /** Live pointer position as a fraction of the container width */
  previewPercent: number;
}

interface UseWaveformInteractionOptions {
  /** Element the pointer coordinates are measured against */
  containerRef: RefObject<HTMLElement | null>;
  /** Song duration in seconds */
  duration: number;
  /** Markers of the active song, used to resolve a marker drag */
  markers: SectionMarker[];
  /** Click target outside A/B mode; omit to leave plain clicks to the player */
  onSeek?: (time: number) => void;
  /** Pause playback before a drag; returns whether it was running */
  onDragPause?: () => boolean;
  /** Resume playback after a drag that had paused it */
  onDragResume?: () => void;
}

/**
 * Pointer interaction shared by the audio waveform and the dummy waveform:
 * setting A/B loop points by clicking, dragging section markers, and dragging
 * the loop handles. The hook is player agnostic and only needs a container to
 * measure against plus optional pause/resume callbacks.
 */
export function useWaveformInteraction({
  containerRef,
  duration,
  markers,
  onSeek,
  onDragPause,
  onDragResume,
}: UseWaveformInteractionOptions) {
  const [drag, setDrag] = useState<WaveformDragState | null>(null);
  // A drag ends with a click event on the container; that click must not seek
  const suppressClickRef = useRef(false);

  const updateMarker = useSongStore((state) => state.updateMarker);
  const setLoop = useLoopStore((state) => state.setLoop);
  const setAbStart = useLoopStore((state) => state.setAbStart);
  const toggleAbMode = useLoopStore((state) => state.toggleAbMode);

  const getPercentFromEvent = useCallback(
    (e: MouseEvent): number => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    },
    [containerRef],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (!duration) return;

      const time = getPercentFromEvent(e.nativeEvent) * duration;
      const { abMode, abStart } = useLoopStore.getState();

      if (!abMode) {
        onSeek?.(time);
        return;
      }

      if (abStart === null) {
        setAbStart(time);
        return;
      }

      setLoop({
        start: Math.min(abStart, time),
        end: Math.max(abStart, time),
        label: 'A/B',
      });
      setAbStart(null);
      toggleAbMode();
    },
    [duration, getPercentFromEvent, onSeek, setAbStart, setLoop, toggleAbMode],
  );

  const startDrag = useCallback(
    (e: React.MouseEvent, type: WaveformDragState['type'], markerId?: string) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;

      const wasPlaying = onDragPause?.() ?? false;
      setDrag({
        type,
        markerId,
        wasPlaying,
        previewPercent: (e.clientX - rect.left) / rect.width,
      });
    },
    [containerRef, onDragPause],
  );

  const handleMarkerMouseDown = useCallback(
    (e: React.MouseEvent, markerId: string) => {
      if (useLoopStore.getState().abMode) return;
      startDrag(e, 'marker', markerId);
    },
    [startDrag],
  );

  const handleLoopHandleMouseDown = useCallback(
    (e: React.MouseEvent, type: 'loopStart' | 'loopEnd') => {
      startDrag(e, type);
    },
    [startDrag],
  );

  useEffect(() => {
    if (!drag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const percent = getPercentFromEvent(e);
      setDrag((prev) => (prev ? { ...prev, previewPercent: percent } : null));
    };

    const handleMouseUp = (e: MouseEvent) => {
      const newTime = getPercentFromEvent(e) * duration;

      if (drag.type === 'marker' && drag.markerId) {
        const marker = markers.find((m) => m.id === drag.markerId);
        if (marker) updateMarker({ ...marker, startTime: newTime });
      } else {
        const { loop } = useLoopStore.getState();
        if (loop) {
          const updated = drag.type === 'loopStart'
            ? { ...loop, start: Math.min(newTime, loop.end - MIN_LOOP_LENGTH) }
            : { ...loop, end: Math.max(newTime, loop.start + MIN_LOOP_LENGTH) };
          setLoop(updated);
        }
      }

      suppressClickRef.current = true;
      if (drag.wasPlaying) onDragResume?.();
      setDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drag, duration, markers, updateMarker, setLoop, getPercentFromEvent, onDragResume]);

  return { drag, handleClick, handleMarkerMouseDown, handleLoopHandleMouseDown };
}