import { useRef, useState, useCallback } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { WaveformPlayer } from '../Player/WaveformPlayer';
import { TransportControls } from '../Player/TransportControls';
import { TempoControls } from '../Player/TempoControls';
import { MarkerForm } from '../Markers/MarkerForm';
import { TabEditor } from '../Tabs/TabEditor';
import { TabViewer } from '../Tabs/TabViewer';
import { SongTabs } from './SongTabs';
import { Sidebar } from './Sidebar';
import { useSongStore } from '../../stores/useSongStore';
import { useTabStore } from '../../stores/useTabStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { analyzeRmsGain } from '../../services/audioAnalysis';
import { VolumeControl } from '../Player/VolumeControl';


export default function AppShell() {
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showMarkerForm, setShowMarkerForm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [songLoop, setSongLoop] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const activeSongId = useSongStore((state) => state.activeSongId);
  const getActiveSong = useSongStore((state) => state.getActiveSong);
  const addSong = useSongStore((state) => state.addSong);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const addMarker = useSongStore((state) => state.addMarker);
  const getActiveMarkers = useSongStore((state) => state.getActiveMarkers);

  const loadTabsForSong = useTabStore((state) => state.loadTabsForSong);
  const setActiveMarker = useTabStore((state) => state.setActiveMarker);
  const activeMarkerId = useTabStore((state) => state.activeMarkerId);

  const activeSong = getActiveSong();
  const markers = getActiveMarkers();
  const audioUrl = activeSongId ? audioUrls[activeSongId] ?? null : null;

  // Find active marker based on currentTime
  const sortedMarkers = [...markers].sort((a, b) => a.startTime - b.startTime);
  const activeMarker = [...sortedMarkers].reverse().find((m) => m.startTime <= currentTime + 0.1) ?? null;
  const selectedMarker = activeMarkerId
    ? markers.find((m) => m.id === activeMarkerId) ?? activeMarker
    : activeMarker;
  const selectedMarkerEnd = selectedMarker
    ? (sortedMarkers.find((m) => m.startTime > selectedMarker.startTime)?.startTime ?? duration)
    : duration;

  const handleFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // Analyze loudness
    const normalizationGain = await analyzeRmsGain(file);

    const song = {
      id: `${file.name}-${file.size}`,
      title: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      fileSize: file.size,
      duration: 0,
      createdAt: Date.now(),
      volume: 1.0,
      normalizationGain,
      normalizationEnabled: normalizationGain !== 1.0,
    };

  await addSong(song);
  await setActiveSongId(song.id);
  await loadTabsForSong(song.id);
  await useTabStore.getState().loadSheetsForSong(song.id);
  setAudioUrls((prev) => ({ ...prev, [song.id]: url }));
}, [addSong, setActiveSongId, loadTabsForSong]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handlePlayPause = () => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.playPause();
    setIsPlaying(ws.isPlaying());
  };

  const handleSeekTo = (time: number) => {
    wavesurferRef.current?.setTime(time);
  };

  const handleReady = useCallback((d: number) => {
    setDuration(d);
  }, []);

  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t);
    setIsPlaying(wavesurferRef.current?.isPlaying() ?? false);

    // Auto-update active marker during playback
    const sorted = [...useSongStore.getState().getActiveMarkers()].sort(
      (a, b) => a.startTime - b.startTime
    );
    const active = [...sorted].reverse().find((m) => m.startTime <= t + 0.1);
    if (active) setActiveMarker(active.id);
  }, [setActiveMarker]);

  const handleFinish = useCallback(() => {
    if (songLoop) {
      wavesurferRef.current?.setTime(0);
      wavesurferRef.current?.play();
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [songLoop, wavesurferRef]);

  const handleReset = () => {
    wavesurferRef.current?.setTime(0);
    setCurrentTime(0);
  };

  const handleAddMarker = useCallback(() => {
    if (!audioUrl) return;
    const ws = wavesurferRef.current;
    const t = ws?.getCurrentTime() ?? currentTime;
    if (ws?.isPlaying()) {
      ws.pause();
      setIsPlaying(false);
    }
    setCurrentTime(t);
    setShowMarkerForm(true);
  }, [audioUrl, currentTime, wavesurferRef]);

  useKeyboardShortcuts({
    wavesurferRef,
    onPlayPause: handlePlayPause,
    onAddMarker: handleAddMarker,
    isPlaying,
  });

  return (
    <div className='min-h-screen bg-slate-900 text-slate-100 flex flex-col'>
      {/* Header */}
      <header className='px-6 py-3 border-b border-slate-700 flex items-center gap-3'>
        <span className='text-indigo-400 text-xl'>🎸</span>
        <h1 className='text-lg font-mono font-semibold tracking-wide'>SongLab</h1>

        {/* Song tabs */}
        <div className='flex-1 overflow-x-auto'>
          <SongTabs onAddSong={() => document.getElementById('file-input')?.click()} />
        </div>

        {/* Hidden file input for adding songs */}
        <input
          id='file-input'
          type='file'
          accept='audio/*'
          className='hidden'
          onChange={handleFileInput}
        />
      </header>

      <div className='flex flex-1 overflow-hidden'>
        {/* Sidebar */}
        <Sidebar
          onSeekTo={handleSeekTo}
          duration={duration}
          currentTime={currentTime}
        />

        {/* Main area */}
        <main className='flex-1 flex flex-col gap-4 p-6 overflow-y-auto'>
          {/* Drop zone */}
          {!audioUrl && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`flex flex-col items-center justify-center border-2 border-dashed
                          rounded-xl py-16 gap-4 transition-colors cursor-pointer
                          ${isDragging
                            ? 'border-indigo-400 bg-indigo-950'
                            : 'border-slate-600 hover:border-slate-400'}`}
            >
              <span className='text-4xl'>🎵</span>
              <p className='text-slate-400 font-mono text-sm'>Drop an audio file here, or</p>
              <label className='px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white
                                rounded-lg font-mono text-sm cursor-pointer transition-colors'>
                Browse file
                <input type='file' accept='audio/*' className='hidden' onChange={handleFileInput} />
              </label>
            </div>
          )}

          {/* Player */}
          {audioUrl && (
            <>
              <div className='flex items-center justify-between'>
                <h2 className='font-mono text-slate-300 truncate'>
                  {activeSong?.title ?? 'Unknown'}
                </h2>
                <div className='flex items-center gap-4'>
                  <VolumeControl />
                  <label className='text-xs text-slate-500 hover:text-slate-300
                                    font-mono cursor-pointer transition-colors'>
                    change file
                    <input type='file' accept='audio/*' className='hidden' onChange={handleFileInput} />
                  </label>
                </div>
              </div>

              <WaveformPlayer
                audioUrl={audioUrl}
                onReady={handleReady}
                onTimeUpdate={handleTimeUpdate}
                onFinish={handleFinish}
                wavesurferRef={wavesurferRef}
              />

              {/* Controls */}
              <div className='flex items-stretch gap-3 flex-wrap'>
                <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center'>
                  <TransportControls
                    wavesurferRef={wavesurferRef}
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    songLoop={songLoop}
                    onSongLoopToggle={() => setSongLoop((v) => !v)}
                    onReset={handleReset}
                  />
                </div>

                {!showMarkerForm && (
                  <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center'>
                    <button
                      onClick={handleAddMarker}
                      className='text-sm font-mono text-slate-300 hover:text-white transition-colors'
                    >
                      + Add Marker
                    </button>
                  </div>
                )}

                <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center'>
                  <TempoControls />
                </div>
              </div>

              {/* MarkerForm */}
              {showMarkerForm && activeSong && (
                <MarkerForm
                  currentTime={currentTime}
                  songId={activeSong.id}
                  onAdd={async (marker) => {
                    await addMarker(marker);
                    const { getActiveMarkers, updateMarker } = useSongStore.getState();
                    const sameType = getActiveMarkers().filter(
                      (x) => x.type === marker.type && x.id !== marker.id
                    );
                    for (const x of sameType) {
                      await updateMarker({ ...x, color: marker.color });
                    }
                    setShowMarkerForm(false);
                  }}
                  onCancel={() => setShowMarkerForm(false)}
                />
              )}

              {/* Keyboard shortcut hints */}
              <p className='text-xs text-slate-600 font-mono'>
                Space: play/pause · M: add marker · ←/→: seek 5s · L: loop toggle
              </p>

              {/* Tab section */}
              {selectedMarker && activeSong && (
                <div className='flex flex-col gap-2 flex-1 min-h-64'>
                  <div className='border-t border-slate-700 pt-4 flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <h3 className='text-xs font-mono text-slate-400 uppercase tracking-widest'>
                        Tab
                      </h3>
                      <button
                        onClick={() => setEditMode((v) => !v)}
                        className='self-start px-3 py-1 text-sm font-mono rounded transition-colors'
                        style={{
                          backgroundColor: editMode ? '#6366f1' : '#475569',
                          color: editMode ? '#fff' : '#cbd5e1',
                        }}
                      >
                        {editMode ? '👁 View Tab' : '✎ Edit Tab'}
                      </button>
                    </div>
                  </div>

                  {editMode ? (
                    <TabEditor marker={selectedMarker} songId={activeSong.id} />
                  ) : (
                    <TabViewer
                      marker={selectedMarker}
                      currentTime={currentTime}
                      isPlaying={isPlaying}
                      sectionEnd={selectedMarkerEnd}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}