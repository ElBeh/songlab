import { useCallback, useRef, useEffect } from 'react';
import { useCountInStore } from '../stores/useCountInStore';
import { scheduleBar, type ScheduledBar } from '../services/clickSoundGenerator';

interface UseCountInOptions {
  /** Song BPM (null = count-in not available) */
  bpm: number | null;
  /** Time signature, defaults to [4, 4] */
  timeSignature: [number, number] | null;
  /** Called after the last beat has elapsed */
  onComplete: () => void;
  /** Whether to play audible clicks (false for viewers) */
  audible?: boolean;
}

export function useCountIn({ bpm, timeSignature, onComplete, audible = true }: UseCountInOptions) {
  const scheduledRef = useRef<ScheduledBar | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const enabled = useCountInStore((s) => s.enabled);
  const isCountingIn = useCountInStore((s) => s.isCountingIn);

  /** Whether count-in can be triggered (enabled + song has BPM) */
  const canCountIn = enabled && bpm !== null && bpm > 0;

  const startCountIn = useCallback(() => {
    if (!bpm || bpm <= 0) return;

    const beats = timeSignature ? timeSignature[0] : 4;
    const { start, setBeat, finish } = useCountInStore.getState();

    // Cancel any running count-in
    scheduledRef.current?.cancel();

    start(beats);

    scheduledRef.current = scheduleBar(
      bpm,
      beats,
      (beat) => setBeat(beat),
      () => {
        finish();
        scheduledRef.current = null;
        onCompleteRef.current();
      },
      audible,
    );
  }, [bpm, timeSignature, audible]);

  const cancelCountIn = useCallback(() => {
    scheduledRef.current?.cancel();
    scheduledRef.current = null;
    useCountInStore.getState().cancel();
  }, []);

  return {
    canCountIn,
    isCountingIn,
    startCountIn,
    cancelCountIn,
  };
}