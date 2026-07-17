import { useCallback, useEffect, useRef, useState } from 'react';
import { getConfig, setConfig } from '../services/db';

interface UseResizablePanelHeightOptions {
  /** Config store key for persistence (use distinct keys per layout mode) */
  configKey: string;
  /** Height in px used when nothing is persisted yet */
  defaultHeight: number;
  minHeight?: number;
  maxHeight?: number;
}

interface UseResizablePanelHeightResult {
  /** Current panel height in px */
  height: number;
  /** True while the user is dragging the resize handle */
  isResizing: boolean;
  /** Attach to the resize handle's onPointerDown */
  startResize: (e: React.PointerEvent) => void;
  /** Adjust height by a delta in px (e.g. for keyboard support), clamped and persisted */
  adjustHeight: (delta: number) => void;
}

/**
 * Drag-resizable panel height with IndexedDB persistence.
 * The persisted value is loaded whenever configKey changes, so callers can
 * keep separate heights per mode by switching the key.
 */
export function useResizablePanelHeight({
  configKey,
  defaultHeight,
  minHeight = 120,
  maxHeight = 1200,
}: UseResizablePanelHeightOptions): UseResizablePanelHeightResult {
  const [height, setHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);

  const heightRef = useRef(height);
  useEffect(() => {
    heightRef.current = height;
  }, [height]);

  const clamp = useCallback(
    (value: number) => Math.min(maxHeight, Math.max(minHeight, Math.round(value))),
    [minHeight, maxHeight],
  );

  // Load persisted height when the config key changes (e.g. layout mode switch)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getConfig<number>(configKey);
        if (cancelled) return;
        setHeight(typeof stored === 'number' ? clamp(stored) : defaultHeight);
      } catch (error) {
        console.error('Failed to load panel height:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configKey, defaultHeight, clamp]);

  const persist = useCallback(
    (value: number) => {
      setConfig(configKey, value).catch((error) => {
        console.error('Failed to save panel height:', error);
      });
    },
    [configKey],
  );

  // Track active drag listeners so they can be removed on unmount mid-drag
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = heightRef.current;
      setIsResizing(true);

      const handleMove = (ev: PointerEvent) => {
        setHeight(clamp(startHeight + (ev.clientY - startY)));
      };
      const handleUp = () => {
        cleanupRef.current?.();
        persist(heightRef.current);
      };
      const cleanup = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        cleanupRef.current = null;
        setIsResizing(false);
      };
      cleanupRef.current = cleanup;

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [clamp, persist],
  );

  const adjustHeight = useCallback(
    (delta: number) => {
      const next = clamp(heightRef.current + delta);
      setHeight(next);
      persist(next);
    },
    [clamp, persist],
  );

  return { height, isResizing, startResize, adjustHeight };
}