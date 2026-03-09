import { useRef, useState, useCallback } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { WaveformPlayer } from '../Player/WaveformPlayer';
import { MarkerForm } from '../Markers/MarkerForm';
import { MarkerList } from '../Markers/MarkerList';
import { useSongStore } from '../../stores/useSongStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { PlayerControls } from '../Player/PlayerControls';

export default function AppShell() {
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showMarkerForm, setShowMarkerForm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const activeSong = useSongStore((state) => state.activeSong);
  const addSong = useSongStore((state) => state.addSong);
  const setActiveSong = useSongStore((state) => state.setActiveSong);
  const addMarker = useSongStore((state) => state.addMarker);

  const handleFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // Stable ID based on filename + filesize – survives page reload
    const song = {
      id: `${file.name}-${file.size}`,
      title: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      fileSize: file.size,
      duration: 0,
      createdAt: Date.now(),
    };

    await addSong(song);
    await setActiveSong(song);
  }, [addSong, setActiveSong]);

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
  }, []);

  useKeyboardShortcuts({
  wavesurferRef,
  onPlayPause: handlePlayPause,
  onAddMarker: () => {
    if (!audioUrl) return;
    const ws = wavesurferRef.current;
    const t = ws?.getCurrentTime() ?? currentTime;
    if (ws?.isPlaying()) {
      ws.pause();
      setIsPlaying(false);
    }
    setCurrentTime(t);
    setShowMarkerForm(true);
  },
  isPlaying,
  });

  return (
    <div className='min-h-screen bg-slate-900 text-slate-100 flex flex-col'>
      {/* Header */}
      <header className='px-6 py-4 border-b border-slate-700 flex items-center gap-3'>
        <span className='text-indigo-400 text-xl'>🎸</span>
        <h1 className='text-lg font-mono font-semibold tracking-wide'>SongLab</h1>
      </header>

      <div className='flex flex-1 overflow-hidden'>
        {/* Sidebar – marker list */}
        <aside className='w-64 border-r border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto'>
          <h2 className='text-xs font-mono text-slate-400 uppercase tracking-widest'>
            Sections
          </h2>
          <MarkerList onSeekTo={handleSeekTo} duration={duration} currentTime={currentTime} />
        </aside>

        {/* Main area */}
        <main className='flex-1 flex flex-col gap-4 p-6 overflow-y-auto'>
          {/* Drop zone / file picker */}
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
              <p className='text-slate-400 font-mono text-sm'>
                Drop an audio file here, or
              </p>
              <label className='px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white
                                rounded-lg font-mono text-sm cursor-pointer transition-colors'>
                Browse file
                <input
                  type='file'
                  accept='audio/*'
                  className='hidden'
                  onChange={handleFileInput}
                />
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
                <label className='text-xs text-slate-500 hover:text-slate-300
                                  font-mono cursor-pointer transition-colors'>
                  change file
                  <input
                    type='file'
                    accept='audio/*'
                    className='hidden'
                    onChange={handleFileInput}
                  />
                </label>
              </div>

              <WaveformPlayer
                audioUrl={audioUrl}
                onReady={handleReady}
                onTimeUpdate={handleTimeUpdate}
                wavesurferRef={wavesurferRef}
              />

              <PlayerControls
                wavesurferRef={wavesurferRef}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
              />

              {!showMarkerForm && (
                <button
                  onClick={() => {
                    const ws = wavesurferRef.current;
                    const t = ws?.getCurrentTime() ?? currentTime;
                    if (ws?.isPlaying()) {
                      ws.pause();
                      setIsPlaying(false);
                    }
                    setCurrentTime(t);
                    setShowMarkerForm(true);
                  }}
                  className='self-start px-3 py-1 text-sm font-mono bg-slate-700
                             hover:bg-slate-600 text-slate-300 rounded transition-colors'
                >
                  + Add Marker
                </button>
              )}

              {showMarkerForm && activeSong && (
                <MarkerForm
                  currentTime={currentTime}
                  songId={activeSong.id}
                  onAdd={async (marker) => {
                    await addMarker(marker);
                    // Sync color to all existing markers of the same type
                    const { markers, updateMarker } = useSongStore.getState();
                    const sameType = markers.filter((m) => m.type === marker.type && m.id !== marker.id);
                    for (const m of sameType) {
                      await updateMarker({ ...m, color: marker.color });
                    }
                    setShowMarkerForm(false);
                  }}
                  onCancel={() => setShowMarkerForm(false)}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}