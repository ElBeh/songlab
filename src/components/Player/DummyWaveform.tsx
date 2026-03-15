import { useRef, useCallback, useMemo } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { WaveformTimeline } from './WaveformTimeline';

interface DummyWaveformProps {
  duration: number;
  currentTime: number;
  height?: number;
  onSeek?: (time: number) => void;
}

/**
 * Static waveform placeholder for dummy songs (no audio file).
 * Displays marker overlays, a clickable seek area, and a playhead cursor.
 */
export function DummyWaveform({ duration, currentTime, height = 96, onSeek }: DummyWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersBySong = useSongStore((state) => state.markersBySong);
  const activeSongId = useSongStore((state) => state.activeSongId);

  const markers = useMemo(
    () => (activeSongId ? (markersBySong[activeSongId] ?? []) : []),
    [markersBySong, activeSongId],
  );

  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.startTime - b.startTime),
    [markers],
  );

  const handleClick = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el || !duration || !onSeek) return;
    const rect = el.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(percent * duration);
  }, [duration, onSeek]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Marker overlays (simplified version of WaveformPlayer's rendering)
  const markerOverlays = sortedMarkers.map((marker, idx) => {
    const leftPercent = (marker.startTime / duration) * 100;
    const nextStart = sortedMarkers[idx + 1]?.startTime ?? duration;
    const widthPercent = ((nextStart - marker.startTime) / duration) * 100;

    return (
      <div key={marker.id}>
        {/* Section background fill */}
        <div
          className='absolute top-0 h-full pointer-events-none'
          style={{
            left: `${leftPercent}%`,
            width: `${Math.max(0, widthPercent)}%`,
            backgroundColor: marker.color,
            opacity: 0.25,
          }}
        />
        {/* Marker line + label */}
        <div
          className='absolute top-0 h-full pointer-events-none'
          style={{ left: `${leftPercent}%` }}
        >
          <div
            className='absolute top-0 h-full w-px'
            style={{ backgroundColor: marker.color }}
          />
          <span
            className='absolute top-1 left-2 text-xs font-mono whitespace-nowrap
                       px-1.5 py-0.5 rounded'
            style={{ backgroundColor: marker.color, color: '#fff' }}
          >
            {marker.label}
          </span>
        </div>
      </div>
    );
  });

  return (
    <div className='w-full bg-slate-800 rounded-lg p-4'>
      <div
        ref={containerRef}
        className='relative w-full cursor-pointer'
        style={{ height: `${height}px` }}
        onClick={handleClick}
      >
        {/* Static placeholder bars */}
        <div className='absolute inset-0 flex items-center justify-center gap-px opacity-30'>
          {Array.from({ length: 120 }).map((_, i) => {
            // Deterministic pseudo-random heights for visual variety
            const h = 20 + ((i * 7 + 13) % 60);
            return (
              <div
                key={i}
                className='flex-1 bg-slate-500 rounded-sm'
                style={{ height: `${h}%`, minWidth: '2px' }}
              />
            );
          })}
        </div>

        {/* "No audio" indicator */}
        <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
          <span className='text-xs font-mono text-slate-500 bg-slate-800/80 px-3 py-1 rounded'>
            No audio file
          </span>
        </div>

        {/* Playhead cursor */}
        <div
          className='absolute top-0 h-full w-px bg-white pointer-events-none'
          style={{ left: `${progressPercent}%`, zIndex: 4 }}
        />

        {/* Marker overlays */}
        <div
          className='absolute top-0 left-0 w-full h-full pointer-events-none'
          style={{ zIndex: 1 }}
        >
          {markerOverlays}
        </div>
      </div>

      <WaveformTimeline duration={duration} currentTime={currentTime} />
    </div>
  );
}