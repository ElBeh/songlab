import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useSongStore } from '../../stores/useSongStore';
import { useLoopStore } from '../../stores/useLoopStore';
import { WaveformTimeline } from './WaveformTimeline';
import { LoopOverlay } from './LoopOverlay';
import { MarkerOverlay } from './MarkerOverlay';
import { useTempoStore } from '../../stores/useTempoStore';
import { useWaveformInteraction } from '../../hooks/useWaveformInteraction';

interface WaveformPlayerProps {
  audioUrl: string;
  height?: number;
  onReady: (duration: number) => void;
  onTimeUpdate: (currentTime: number) => void;
  onFinish: () => void;
  wavesurferRef: React.RefObject<WaveSurfer | null>;
}

export function WaveformPlayer({
  audioUrl,
  height = 96,
  onReady,
  onTimeUpdate,
  onFinish,
  wavesurferRef,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const markersBySong = useSongStore((state) => state.markersBySong);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const markers = useMemo(
    () => activeSongId ? (markersBySong[activeSongId] ?? []) : [],
    [markersBySong, activeSongId]
  );
  const loop = useLoopStore((state) => state.loop);
  const loopEnabled = useLoopStore((state) => state.loopEnabled);
  const abMode = useLoopStore((state) => state.abMode);
  const abStart = useLoopStore((state) => state.abStart);
  const playbackRate = useTempoStore((state) => state.playbackRate);
  const preservePitch = useTempoStore((state) => state.preservePitch);

  const songs = useSongStore((state) => state.songs);
  const activeSong = songs.find((s) => s.id === activeSongId) ?? null;
  const volume = activeSong?.volume ?? 1;
  const normalizationGain = (activeSong?.normalizationEnabled ?? true)
    ? (activeSong?.normalizationGain ?? 1)
    : 1;

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

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

  // Apply volume changes while player is active
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const effectiveVolume = volume * normalizationGain;
    ws.setVolume(Math.min(1, effectiveVolume));
  }, [volume, normalizationGain, wavesurferRef]);

  // Apply height changes dynamically
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.setOptions({ height });
  }, [height, wavesurferRef]);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#475569',
      progressColor: '#94a3b8',
      cursorColor: '#ffffff',
      height: height,
      normalize: true,
    });

    wavesurferRef.current = ws;
    ws.load(audioUrl);

  ws.on('ready', () => {
    const d = ws.getDuration();
    setDuration(d);

    // Apply volume on ready using latest store values
    const { songs, activeSongId: id } = useSongStore.getState();
    const song = songs.find((s) => s.id === id) ?? null;
    const v = song?.volume ?? 1;
    const g = (song?.normalizationEnabled ?? true) ? (song?.normalizationGain ?? 1) : 1;
    ws.setVolume(Math.min(1, v * g));

    onReadyRef.current(d);
  });

    // Section loop enforcement lives in useSectionLoop (wired in AppShell),
    // so every playback backend behaves identically.
    ws.on('timeupdate', (t) => {
      setCurrentTime(t);
      onTimeUpdateRef.current(t);
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
  }, [audioUrl, wavesurferRef]);  // eslint-disable-line react-hooks/exhaustive-deps
                                  // height intentionally excluded – handled dynamically via setOptions in a separate effect

  // Pointer interaction (A/B clicks, marker and loop handle dragging) is shared
  // with DummyWaveform so both waveforms behave identically.
  const handleDragPause = useCallback(() => {
    const ws = wavesurferRef.current;
    const wasPlaying = ws?.isPlaying() ?? false;
    if (wasPlaying) ws?.pause();
    return wasPlaying;
  }, [wavesurferRef]);

  const handleDragResume = useCallback(() => {
    wavesurferRef.current?.play();
  }, [wavesurferRef]);

  const { drag, handleClick, handleMarkerMouseDown, handleLoopHandleMouseDown } =
    useWaveformInteraction({
      containerRef: waveContainerRef,
      duration,
      markers,
      onDragPause: handleDragPause,
      onDragResume: handleDragResume,
    });

  return (
    <div className='w-full bg-slate-800 rounded-lg p-4'>
      <div
        className='relative w-full'
        ref={waveContainerRef}
        style={{ cursor: abMode ? 'crosshair' : 'default' }}
        onClick={handleClick}
      >
        <div
          ref={containerRef}
          className='w-full'
          style={{ position: 'relative', zIndex: 0 }}
        />
        <div
          className='absolute top-0 left-0 w-full'
          style={{ height: `${height}px`, zIndex: 1, pointerEvents: 'none' }}
        >
          <div className='relative w-full h-full' style={{ pointerEvents: 'none' }}>
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
      </div>
      <WaveformTimeline duration={duration} currentTime={currentTime} />
    </div>
  );
}