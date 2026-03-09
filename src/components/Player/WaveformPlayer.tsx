import { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useSongStore } from '../../stores/useSongStore';
import { WaveformTimeline } from './WaveformTimeline';


interface WaveformPlayerProps {
  audioUrl: string;
  onReady: (duration: number) => void;
  onTimeUpdate: (currentTime: number) => void;
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
}

interface DragState {
  markerId: string;
  wasPlaying: boolean;
  previewPercent: number;
}

export function WaveformPlayer({
  audioUrl,
  onReady,
  onTimeUpdate,
  wavesurferRef,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const markers = useSongStore((state) => state.markers);
  const updateMarker = useSongStore((state) => state.updateMarker);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);

  const onReadyRef = useRef(onReady);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => {
    onReadyRef.current = onReady;
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onReady, onTimeUpdate]);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#475569',
      progressColor: '#94a3b8',
      cursorColor: '#ffffff',
      height: 96,
      normalize: true,
    });

    wavesurferRef.current = ws;
    ws.load(audioUrl);

    ws.on('ready', () => {
      const d = ws.getDuration();
      setDuration(d);
      onReadyRef.current(d);
    });

    ws.on('timeupdate', (t) => {
      setCurrentTime(t);
      onTimeUpdateRef.current(t);
    });

    ws.on('error', (err) => {
      console.error('WaveSurfer error:', err);
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl, wavesurferRef]);

  // Calculate percentage from mouse event relative to waveform container
  const getPercentFromEvent = useCallback((e: MouseEvent): number => {
    const rect = waveContainerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const raw = (e.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, raw));
  }, []);

  const handleMarkerMouseDown = useCallback(
    (e: React.MouseEvent, markerId: string) => {
      e.preventDefault();
      e.stopPropagation();

      const ws = wavesurferRef.current;
      const wasPlaying = ws?.isPlaying() ?? false;
      if (wasPlaying) ws?.pause();

      const rect = waveContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const previewPercent = (e.clientX - rect.left) / rect.width;

      setDrag({ markerId, wasPlaying, previewPercent });
    },
    [wavesurferRef],
  );

  useEffect(() => {
    if (!drag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const percent = getPercentFromEvent(e);
      setDrag((prev) => prev ? { ...prev, previewPercent: percent } : null);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const percent = getPercentFromEvent(e);
      const newTime = percent * duration;

      const marker = markers.find((m) => m.id === drag.markerId);
      if (marker) {
        updateMarker({ ...marker, startTime: newTime });
      }

      if (drag.wasPlaying) {
        wavesurferRef.current?.play();
      }

      setDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drag, duration, markers, updateMarker, wavesurferRef, getPercentFromEvent]);

  const markerOverlays = duration > 0
    ? markers.map((marker, i) => {
        const isDragging = drag?.markerId === marker.id;
        const leftPercent = isDragging
          ? drag.previewPercent * 100
          : (marker.startTime / duration) * 100;

        const nextMarker = markers[i + 1];
        const nextStart = isDragging
          ? drag.previewPercent * duration
          : nextMarker?.startTime ?? duration;
        const effectiveStart = isDragging ? drag.previewPercent * duration : marker.startTime;
        const widthPercent = ((nextStart - effectiveStart) / duration) * 100;

        return (
          <div key={marker.id}>
            {/* Colored region – no pointer events */}
            <div
              className='absolute top-0 h-full'
              style={{
                left: `${leftPercent}%`,
                width: `${Math.max(0, widthPercent)}%`,
                backgroundColor: marker.color,
                opacity: 0.25,
                pointerEvents: 'none',
              }}
            />
            {/* Vertical line – receives mouse events for drag */}
            <div
              className='absolute top-0 h-full'
              style={{
                left: `${leftPercent}%`,
                width: '8px',
                transform: 'translateX(-4px)',
                cursor: 'ew-resize',
                zIndex: 3,
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
            >
              <div
                className='absolute top-0 h-full w-px mx-auto'
                style={{
                  left: '4px',
                  backgroundColor: marker.color,
                  pointerEvents: 'none',
                }}
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
      })
    : null;

  return (
    <div className='w-full bg-slate-800 rounded-lg p-4'>
      <div className='relative w-full' ref={waveContainerRef}>
        <div
          ref={containerRef}
          className='w-full'
          style={{ position: 'relative', zIndex: 0 }}
        />
{/* pointer-events-none on container, but auto on individual drag handles */}
        <div
          className='absolute top-0 left-0 w-full'
          style={{ height: '96px', zIndex: 1, pointerEvents: 'none' }}
        >
          {markerOverlays}
        </div>
      </div>
      <WaveformTimeline duration={duration} currentTime={currentTime} />
    </div>
  );
}