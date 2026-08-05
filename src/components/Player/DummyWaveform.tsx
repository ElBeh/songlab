import { useRef, useMemo } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useLoopStore } from '../../stores/useLoopStore';
import { WaveformTimeline } from './WaveformTimeline';
import { LoopOverlay } from './LoopOverlay';
import { MarkerOverlay } from './MarkerOverlay';
import { useWaveformInteraction } from '../../hooks/useWaveformInteraction';

const PLACEHOLDER_BAR_COUNT = 120;

/** Deterministic pseudo-random bar height for visual variety */
function placeholderBarHeight(index: number): number {
  return 20 + ((index * 7 + 13) % 60);
}

interface DummyWaveformProps {
  duration: number;
  currentTime: number;
  height?: number;
  onSeek?: (time: number) => void;
}

/**
 * Static waveform placeholder for dummy songs (no audio file).
 * Displays marker overlays, the loop region, a clickable seek area and a
 * playhead cursor. Pointer interaction is shared with WaveformPlayer.
 */
export function DummyWaveform({ duration, currentTime, height = 96, onSeek }: DummyWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersBySong = useSongStore((state) => state.markersBySong);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const loop = useLoopStore((state) => state.loop);
  const loopEnabled = useLoopStore((state) => state.loopEnabled);
  const abMode = useLoopStore((state) => state.abMode);
  const abStart = useLoopStore((state) => state.abStart);

  const markers = useMemo(
    () => (activeSongId ? (markersBySong[activeSongId] ?? []) : []),
    [markersBySong, activeSongId],
  );

  const { drag, handleClick, handleMarkerMouseDown, handleLoopHandleMouseDown } =
    useWaveformInteraction({
      containerRef,
      duration,
      markers,
      onSeek,
    });

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className='w-full bg-slate-800 rounded-lg p-4'>
      <div
        ref={containerRef}
        className='relative w-full'
        style={{ height: `${height}px`, cursor: abMode ? 'crosshair' : 'pointer' }}
        onClick={handleClick}
      >
        {/* Static placeholder bars (unplayed = dim) */}
        <div className='absolute inset-0 flex items-center justify-center gap-px opacity-30'>
          {Array.from({ length: PLACEHOLDER_BAR_COUNT }).map((_, i) => (
            <div
              key={i}
              className='flex-1 bg-slate-500 rounded-sm'
              style={{ height: `${placeholderBarHeight(i)}%`, minWidth: '2px' }}
            />
          ))}
        </div>

        {/* Progress overlay (played = bright, clipped to playhead position) */}
        <div
          className='absolute inset-0 flex items-center justify-center gap-px opacity-60
                     pointer-events-none'
          style={{ clipPath: `inset(0 ${100 - progressPercent}% 0 0)` }}
        >
          {Array.from({ length: PLACEHOLDER_BAR_COUNT }).map((_, i) => (
            <div
              key={i}
              className='flex-1 bg-slate-300 rounded-sm'
              style={{ height: `${placeholderBarHeight(i)}%`, minWidth: '2px' }}
            />
          ))}
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
          style={{ left: `${progressPercent}%`, zIndex: 5 }}
        />

        {/* Loop region and marker overlays */}
        <div
          className='absolute top-0 left-0 w-full h-full pointer-events-none'
          style={{ zIndex: 1 }}
        >
          <LoopOverlay
            loop={loop}
            loopEnabled={loopEnabled}
            abStart={abStart}
            duration={duration}
            drag={drag}
            onHandleMouseDown={handleLoopHandleMouseDown}
          />
          <MarkerOverlay
            markers={markers}
            duration={duration}
            drag={drag}
            abMode={abMode}
            onMarkerMouseDown={handleMarkerMouseDown}
          />
        </div>
      </div>

      <WaveformTimeline duration={duration} currentTime={currentTime} />
    </div>
  );
}