import { useEffect, useRef } from 'react';
import { useLoopStore } from '../stores/useLoopStore';
import { resolveSongLoopFinish } from '../utils/songLoop';

interface UseSectionLoopOptions {
  /** Whether playback is currently running */
  isPlaying: boolean;
  /** Current playback position in seconds */
  currentTime: number;
  /** Seek callback used to jump back to the loop start */
  onSeek: (time: number) => void;
  /** Disable enforcement, e.g. for viewers whose position comes from the host */
  enabled?: boolean;
}

/**
 * Enforce the active section loop for every playback backend.
 *
 * The three backends (wavesurfer, alphaSynth, simulated dummy clock) all report
 * their position through the same unified values in AppShell, so the loop is
 * enforced once here instead of inside a single player component. The
 * counter and target handling is shared with the song-loop paths via
 * resolveSongLoopFinish().
 */
export function useSectionLoop({
  isPlaying,
  currentTime,
  onSeek,
  enabled = true,
}: UseSectionLoopOptions) {
  const onSeekRef = useRef(onSeek);
  useEffect(() => { onSeekRef.current = onSeek; }, [onSeek]);

  useEffect(() => {
    if (!enabled || !isPlaying) return;

    const { loop, loopEnabled } = useLoopStore.getState();
    if (!loopEnabled || !loop) return;
    if (currentTime < loop.end) return;

    if (resolveSongLoopFinish() === 'stop') {
      useLoopStore.getState().toggleLoop();
      return;
    }
    onSeekRef.current(loop.start);
  }, [enabled, isPlaying, currentTime]);
}