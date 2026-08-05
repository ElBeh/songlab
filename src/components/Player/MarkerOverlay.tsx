import { useMemo } from 'react';
import type { WaveformDragState } from '../../hooks/useWaveformInteraction';
import type { SectionMarker } from '../../types';

interface MarkerOverlayProps {
  /** Markers of the active song; sorted internally by start time */
  markers: SectionMarker[];
  /** Song duration in seconds */
  duration: number;
  /** Current drag state from useWaveformInteraction */
  drag: WaveformDragState | null;
  /** A/B mode changes the cursor and disables marker dragging */
  abMode: boolean;
  onMarkerMouseDown: (e: React.MouseEvent, markerId: string) => void;
}

/**
 * Section markers with their colored region fill, drawn on top of a waveform.
 * Shared by WaveformPlayer (audio) and DummyWaveform (no audio file).
 */
export function MarkerOverlay({
  markers,
  duration,
  drag,
  abMode,
  onMarkerMouseDown,
}: MarkerOverlayProps) {
  const sorted = useMemo(
    () => [...markers].sort((a, b) => a.startTime - b.startTime),
    [markers],
  );

  if (duration <= 0) return null;

  return (
    <>
      {sorted.map((marker, index) => {
        const isDragging = drag?.type === 'marker' && drag.markerId === marker.id;
        const start = isDragging ? drag.previewPercent * duration : marker.startTime;
        const nextStart = isDragging
          ? start
          : sorted[index + 1]?.startTime ?? duration;
        const leftPercent = (start / duration) * 100;
        const widthPercent = ((nextStart - start) / duration) * 100;

        return (
          <div key={marker.id}>
            {/* Section region fill */}
            <div
              className='absolute top-0 h-full pointer-events-none'
              style={{
                left: `${leftPercent}%`,
                width: `${Math.max(0, widthPercent)}%`,
                backgroundColor: marker.color,
                opacity: 0.25,
              }}
            />
            {/* Marker line and label */}
            <div
              role='slider'
              tabIndex={-1}
              aria-label={`Marker ${marker.label}`}
              aria-valuenow={Math.round(leftPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              className='absolute top-0 h-full'
              style={{
                left: `${leftPercent}%`,
                width: '8px',
                transform: 'translateX(-4px)',
                cursor: abMode ? 'crosshair' : 'ew-resize',
                zIndex: 3,
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => onMarkerMouseDown(e, marker.id)}
            >
              <div
                className='absolute top-0 h-full w-px'
                style={{ left: '4px', backgroundColor: marker.color, pointerEvents: 'none' }}
              />
              <span
                className='absolute top-1 left-2 text-xs font-mono whitespace-nowrap
                           px-1.5 py-0.5 rounded pointer-events-none'
                style={{ backgroundColor: marker.color, color: '#fff' }}
              >
                {marker.label}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}