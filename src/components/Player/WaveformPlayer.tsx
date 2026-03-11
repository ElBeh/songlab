import { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useSongStore } from '../../stores/useSongStore';
import { useLoopStore } from '../../stores/useLoopStore';
import { WaveformTimeline } from './WaveformTimeline';
import { SECTION_COLORS } from '../../utils/sectionColors';
import { useTempoStore } from '../../stores/useTempoStore';

interface WaveformPlayerProps {
  audioUrl: string;
  onReady: (duration: number) => void;
  onTimeUpdate: (currentTime: number) => void;
  onFinish: () => void;
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
}

interface DragState {
  type: 'marker' | 'loopStart' | 'loopEnd';
  markerId?: string;
  wasPlaying: boolean;
  previewPercent: number;
}

export function WaveformPlayer({
  audioUrl,
  onReady,
  onTimeUpdate,
  onFinish,
  wavesurferRef,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const markers = useSongStore((state) => state.markers);
  const updateMarker = useSongStore((state) => state.updateMarker);
  const loop = useLoopStore((state) => state.loop);
  const loopEnabled = useLoopStore((state) => state.loopEnabled);
  const abMode = useLoopStore((state) => state.abMode);
  const abStart = useLoopStore((state) => state.abStart);
  const setAbStart = useLoopStore((state) => state.setAbStart);
  const setLoop = useLoopStore((state) => state.setLoop);
  const toggleAbMode = useLoopStore((state) => state.toggleAbMode);
  const playbackRate = useTempoStore((state) => state.playbackRate);
  const preservePitch = useTempoStore((state) => state.preservePitch);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);

  const onReadyRef = useRef(onReady);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onFinishRef = useRef(onFinish);

  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  useEffect(() => {
  const ws = wavesurferRef.current;
  if (!ws) return;
  ws.setPlaybackRate(playbackRate, preservePitch);
  }, [playbackRate, preservePitch, wavesurferRef]);

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

      // Loop logic
      const { loop: l, loopEnabled: le } = useLoopStore.getState();
      if (le && l && t >= l.end) {
        ws.setTime(l.start);
      }
    });

    ws.on('finish', () => {
      onFinishRef.current();
    });

    ws.on('error', (err) => {
      console.error('WaveSurfer error:', err);
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl, wavesurferRef]);

  const getPercentFromEvent = useCallback((e: MouseEvent): number => {
    const rect = waveContainerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handleWaveformClick = useCallback((e: React.MouseEvent) => {
    const { abMode: am, abStart: as_ } = useLoopStore.getState();
    if (!am) return;

    const rect = waveContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = percent * duration;

    if (as_ === null) {
      setAbStart(t);
    } else {
      const start = Math.min(as_, t);
      const end = Math.max(as_, t);
      setLoop({ start, end, label: 'A/B' });
      setAbStart(null);
      toggleAbMode();
    }
  }, [duration, setAbStart, setLoop, toggleAbMode]);

  const handleMarkerMouseDown = useCallback(
    (e: React.MouseEvent, markerId: string) => {
      if (useLoopStore.getState().abMode) return;
      e.preventDefault();
      e.stopPropagation();
      const ws = wavesurferRef.current;
      const wasPlaying = ws?.isPlaying() ?? false;
      if (wasPlaying) ws?.pause();
      const rect = waveContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const previewPercent = (e.clientX - rect.left) / rect.width;
      setDrag({ type: 'marker', markerId, wasPlaying, previewPercent });
    },
    [wavesurferRef],
  );

  const handleLoopHandleMouseDown = useCallback(
    (e: React.MouseEvent, type: 'loopStart' | 'loopEnd') => {
      e.preventDefault();
      e.stopPropagation();
      const ws = wavesurferRef.current;
      const wasPlaying = ws?.isPlaying() ?? false;
      if (wasPlaying) ws?.pause();
      const rect = waveContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const previewPercent = (e.clientX - rect.left) / rect.width;
      setDrag({ type, wasPlaying, previewPercent });
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

      if (drag.type === 'marker' && drag.markerId) {
        const marker = markers.find((m) => m.id === drag.markerId);
        if (marker) updateMarker({ ...marker, startTime: newTime });
      } else if (drag.type === 'loopStart' || drag.type === 'loopEnd') {
        const { loop: l } = useLoopStore.getState();
        if (l) {
          const updated = drag.type === 'loopStart'
            ? { ...l, start: Math.min(newTime, l.end - 0.5) }
            : { ...l, end: Math.max(newTime, l.start + 0.5) };
          setLoop(updated);
        }
      }

      if (drag.wasPlaying) wavesurferRef.current?.play();
      setDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drag, duration, markers, updateMarker, wavesurferRef, getPercentFromEvent, setLoop]);

  const loopOverlay = (() => {
    if (!loop || !duration) return null;
    const startDragging = drag?.type === 'loopStart';
    const endDragging = drag?.type === 'loopEnd';
    const startPercent = startDragging
      ? drag.previewPercent * 100
      : (loop.start / duration) * 100;
    const endPercent = endDragging
      ? drag.previewPercent * 100
      : (loop.end / duration) * 100;

    return (
      <>
        {/* Loop region */}
        <div
          className='absolute top-0 h-full pointer-events-none'
          style={{
            left: `${startPercent}%`,
            width: `${endPercent - startPercent}%`,
            backgroundColor: '#6366f1',
            opacity: loopEnabled ? 0.25 : 0.1,
            border: `1px solid ${loopEnabled ? '#6366f1' : '#475569'}`,
          }}
        />
        {/* A handle */}
        <div
          className='absolute top-0 h-full'
          style={{
            left: `${startPercent}%`,
            width: '8px',
            transform: 'translateX(-4px)',
            cursor: 'ew-resize',
            zIndex: 4,
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => handleLoopHandleMouseDown(e, 'loopStart')}
        >
          <div
            className='absolute top-0 h-full w-px'
            style={{ left: '4px', backgroundColor: '#fbbf24' }}
          />
          <span
            className='absolute bottom-1 left-1 text-xs font-mono px-1 rounded'
            style={{ backgroundColor: '#fbbf24', color: '#000' }}
          >
            A
          </span>
        </div>
        {/* B handle */}
        <div
          className='absolute top-0 h-full'
          style={{
            left: `${endPercent}%`,
            width: '8px',
            transform: 'translateX(-4px)',
            cursor: 'ew-resize',
            zIndex: 4,
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => handleLoopHandleMouseDown(e, 'loopEnd')}
        >
          <div
            className='absolute top-0 h-full w-px'
            style={{ left: '4px', backgroundColor: '#f87171' }}
          />
          <span
            className='absolute bottom-1 left-1 text-xs font-mono px-1 rounded'
            style={{ backgroundColor: '#f87171', color: '#000' }}
          >
            B
          </span>
        </div>
      </>
    );
  })();

  const abPreview = abStart !== null && duration > 0 ? (
    <div
      className='absolute top-0 h-full w-px pointer-events-none'
      style={{
        left: `${(abStart / duration) * 100}%`,
        backgroundColor: '#fbbf24',
        zIndex: 4,
      }}
    >
      <span
        className='absolute bottom-1 left-1 text-xs font-mono px-1 rounded'
        style={{ backgroundColor: '#fbbf24', color: '#000' }}
      >
        A
      </span>
    </div>
  ) : null;

  const markerOverlays = duration > 0
    ? markers.map((marker, i) => {
        const isDragging = drag?.type === 'marker' && drag.markerId === marker.id;
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
            <div
              className='absolute top-0 h-full pointer-events-none'
              style={{
                left: `${leftPercent}%`,
                width: `${Math.max(0, widthPercent)}%`,
                backgroundColor: marker.color,
                opacity: 0.25,
              }}
            />
            <div
              className='absolute top-0 h-full'
              style={{
                left: `${leftPercent}%`,
                width: '8px',
                transform: 'translateX(-4px)',
                cursor: abMode ? 'crosshair' : 'ew-resize',
                zIndex: 3,
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
            >
              <div
                className='absolute top-0 h-full w-px'
                style={{ left: '4px', backgroundColor: marker.color, pointerEvents: 'none' }}
              />
              <span
                className='absolute top-1 left-2 text-xs font-mono whitespace-nowrap
                           px-1.5 py-0.5 rounded pointer-events-none'
                style={{ backgroundColor: SECTION_COLORS[marker.type], color: '#fff' }}
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
      <div
        className='relative w-full'
        ref={waveContainerRef}
        style={{ cursor: abMode ? 'crosshair' : 'default' }}
        onClick={handleWaveformClick}
      >
        <div
          ref={containerRef}
          className='w-full'
          style={{ position: 'relative', zIndex: 0 }}
        />
        <div
          className='absolute top-0 left-0 w-full'
          style={{ height: '96px', zIndex: 1, pointerEvents: 'none' }}
        >
          <div className='relative w-full h-full' style={{ pointerEvents: 'none' }}>
            {loopOverlay}
            {abPreview}
            {markerOverlays}
          </div>
        </div>
      </div>
      <WaveformTimeline duration={duration} currentTime={currentTime} />
    </div>
  );
}