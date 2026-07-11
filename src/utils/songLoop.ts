// Shared decision logic for the "song loop reached the end" case.
// Used by usePlayback (wavesurfer), useDummyPlayback (simulated clock),
// and useAlphaSynthPlayback (alphaSynth MIDI) — the playback backends
// differ, but the counter/target handling is identical.

import { useLoopStore } from '../stores/useLoopStore';

export type SongLoopFinishAction = 'stop' | 'restart';

/**
 * Increment the loop counter and decide how to proceed:
 * - 'stop': the loop target was reached; the counter has been reset and the
 *   caller should disable its song loop, stop playback, and fire onFinish.
 * - 'restart': the caller should rewind to the start and either resume
 *   playback or hand off to onLoopRestart (e.g. for a count-in).
 */
export function resolveSongLoopFinish(): SongLoopFinishAction {
  const { incrementLoopCount, loopTarget } = useLoopStore.getState();
  incrementLoopCount();
  // Read the actual count after the (possibly debounced) increment
  const newCount = useLoopStore.getState().loopCount;

  if (loopTarget !== null && newCount >= loopTarget) {
    useLoopStore.getState().resetLoopCount();
    return 'stop';
  }
  return 'restart';
}
