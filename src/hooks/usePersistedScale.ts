import { useCallback, useEffect, useRef, useState } from 'react';
import { getConfig, setConfig } from '../services/db';

interface UsePersistedScaleOptions {
  /** Config store key for persistence (device-local, not part of the JSON export) */
  configKey: string;
  /** Scale used when nothing is persisted yet, e.g. 1 for 100% */
  defaultScale: number;
  min: number;
  max: number;
  /** Change per zoom step, e.g. 0.1 for 10% */
  step?: number;
}

interface UsePersistedScaleResult {
  scale: number;
  zoomIn: () => void;
  zoomOut: () => void;
}

/** Round to one decimal so repeated steps do not accumulate float errors */
function roundScale(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Zoom factor with IndexedDB persistence, loaded once per config key */
export function usePersistedScale({
  configKey,
  defaultScale,
  min,
  max,
  step = 0.1,
}: UsePersistedScaleOptions): UsePersistedScaleResult {
  const [scale, setScale] = useState(defaultScale);

  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const clamp = useCallback(
    (value: number) => Math.min(max, Math.max(min, roundScale(value))),
    [min, max],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getConfig<number>(configKey);
        if (cancelled) return;
        setScale(typeof stored === 'number' ? clamp(stored) : defaultScale);
      } catch (error) {
        console.error('Failed to load zoom level:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configKey, defaultScale, clamp]);

  const change = useCallback(
    (delta: number) => {
      const next = clamp(scaleRef.current + delta);
      scaleRef.current = next;
      setScale(next);
      setConfig(configKey, next).catch((error) => {
        console.error('Failed to save zoom level:', error);
      });
    },
    [configKey, clamp],
  );

  const zoomIn = useCallback(() => change(step), [change, step]);
  const zoomOut = useCallback(() => change(-step), [change, step]);

  return { scale, zoomIn, zoomOut };
}