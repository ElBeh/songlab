import { useState, useCallback } from 'react';
import { WaveformPlayer } from '../Player/WaveformPlayer';
import { TransportControls } from '../Player/TransportControls';
import { TempoControls } from '../Player/TempoControls';
import { MarkerForm } from '../Markers/MarkerForm';
import { TabEditor } from '../Tabs/TabEditor';
import { TabViewer } from '../Tabs/TabViewer';
import { SongTabs } from './SongTabs';
import { Sidebar } from './Sidebar';
import { VolumeControl } from '../Player/VolumeControl';
import { useSongStore } from '../../stores/useSongStore';
import { useTabStore } from '../../stores/useTabStore';
import { usePlayback } from '../../hooks/usePlayback';
import { useAudioFile } from '../../hooks/useAudioFile';
import { useActiveMarkerTracker } from '../../hooks/useActiveMarkerTracker';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { ToastContainer } from './Toast';

export default function AppShell() {
  const [showMarkerForm, setShowMarkerForm] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const activeSong = useSongStore((state) => state.getActiveSong)();
  const addMarker = useSongStore((state) => state.addMarker);
  const setActiveMarker = useTabStore((state) => state.setActiveMarker);

  // --- Hooks ---

  const onTimeUpdate = useCallback((t: number) => {
    const sorted = [...useSongStore.getState().getActiveMarkers()].sort(
      (a, b) => a.startTime - b.startTime,
    );
    const active = [...sorted].reverse().find((m) => m.startTime <= t + 0.1);
    if (active) setActiveMarker(active.id);
  }, [setActiveMarker]);

  const playback = usePlayback({ onTimeUpdate });

  const audioFile = useAudioFile({
    onFileLoaded: () => {
      playback.setIsPlaying(false);
      playback.setCurrentTime(0);
    },
  });

  const { selectedMarker, selectedMarkerEnd } = useActiveMarkerTracker(
    playback.currentTime,
    playback.duration,
  );

  const handleAddMarker = useCallback(() => {
    if (!audioFile.audioUrl) return;
    const ws = playback.wavesurferRef.current;
    const t = ws?.getCurrentTime() ?? playback.currentTime;
    if (ws?.isPlaying()) {
      ws.pause();
      playback.setIsPlaying(false);
    }
    playback.setCurrentTime(t);
    setShowMarkerForm(true);
  }, [audioFile.audioUrl, playback]);

  useKeyboardShortcuts({
    wavesurferRef: playback.wavesurferRef,
    onPlayPause: playback.handlePlayPause,
    onAddMarker: handleAddMarker,
    isPlaying: playback.isPlaying,
  });

  // --- Render ---

  return (
    <div className='min-h-screen bg-slate-900 text-slate-100 flex flex-col'>
      {/* Header */}
      <header className='px-6 py-3 border-b border-slate-700 flex items-center gap-3'>
        <span className='text-indigo-400 text-xl'>🎸</span>
        <h1 className='text-lg font-mono font-semibold tracking-wide'>SongLab</h1>

        <div className='flex-1 overflow-x-auto'>
          <SongTabs onAddSong={() => document.getElementById('file-input')?.click()} />
        </div>

        <input
          id='file-input'
          type='file'
          accept='audio/*'
          className='hidden'
          onChange={audioFile.handleFileInput}
        />
      </header>

      <div className='flex flex-1 overflow-hidden'>
        <Sidebar
          onSeekTo={playback.handleSeekTo}
          duration={playback.duration}
          currentTime={playback.currentTime}
        />

        <main className='flex-1 flex flex-col gap-4 p-6 overflow-y-auto'>
          {/* Drop zone */}
          {!audioFile.audioUrl && (
            <div
              onDrop={audioFile.handleDrop}
              onDragOver={audioFile.handleDragOver}
              onDragLeave={audioFile.handleDragLeave}
              className={`flex flex-col items-center justify-center border-2 border-dashed
                          rounded-xl py-16 gap-4 transition-colors cursor-pointer
                          ${audioFile.isDragging
                            ? 'border-indigo-400 bg-indigo-950'
                            : 'border-slate-600 hover:border-slate-400'}`}
            >
              <span className='text-4xl'>🎵</span>
              <p className='text-slate-400 font-mono text-sm'>Drop an audio file here, or</p>
              <label className='px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white
                                rounded-lg font-mono text-sm cursor-pointer transition-colors'>
                Browse file
                <input
                  type='file'
                  accept='audio/*'
                  className='hidden'
                  onChange={audioFile.handleFileInput}
                />
              </label>
            </div>
          )}

          {/* Player */}
          {audioFile.audioUrl && (
            <>
              <div className='flex items-center justify-between'>
                <h2 className='font-mono text-slate-300 truncate'>
                  {activeSong?.title ?? 'Unknown'}
                </h2>
                <div className='flex items-center gap-3'>
                  <div className='bg-slate-800 rounded-lg px-4 py-2 flex items-center'>
                    <VolumeControl />
                  </div>
                  <label className='bg-slate-800 rounded-lg px-4 py-2 text-xs text-slate-500
                                    hover:text-slate-300 font-mono cursor-pointer
                                    transition-colors'>
                    change file
                    <input
                      type='file'
                      accept='audio/*'
                      className='hidden'
                      onChange={audioFile.handleFileInput}
                    />
                  </label>
                </div>
              </div>

              <WaveformPlayer
                audioUrl={audioFile.audioUrl}
                onReady={playback.handleReady}
                onTimeUpdate={playback.handleTimeUpdate}
                onFinish={playback.handleFinish}
                wavesurferRef={playback.wavesurferRef}
              />

              {/* Controls */}
              <div className='flex items-stretch gap-3 flex-wrap'>
                <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center'>
                  <TransportControls
                    wavesurferRef={playback.wavesurferRef}
                    currentTime={playback.currentTime}
                    duration={playback.duration}
                    isPlaying={playback.isPlaying}
                    onPlayPause={playback.handlePlayPause}
                    songLoop={playback.songLoop}
                    onSongLoopToggle={playback.toggleSongLoop}
                    onReset={playback.handleReset}
                  />
                </div>

                {!showMarkerForm && (
                  <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center'>
                    <button
                      onClick={handleAddMarker}
                      className='text-sm font-mono text-slate-300 hover:text-white
                                 transition-colors'
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
                  currentTime={playback.currentTime}
                  songId={activeSong.id}
                  onAdd={async (marker) => {
                    await addMarker(marker);
                    const { getActiveMarkers, updateMarker } = useSongStore.getState();
                    const sameType = getActiveMarkers().filter(
                      (x) => x.type === marker.type && x.id !== marker.id,
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
                  <div className='border-t border-slate-700 pt-4 flex items-center
                                  justify-between'>
                    <div className='flex items-center gap-3'>
                      <h3 className='text-xs font-mono text-slate-400 uppercase tracking-widest'>
                        Tab
                      </h3>
                      <button
                        onClick={() => setEditMode((v) => !v)}
                        className='self-start px-3 py-1 text-sm font-mono rounded
                                   transition-colors'
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
                      currentTime={playback.currentTime}
                      isPlaying={playback.isPlaying}
                      sectionEnd={selectedMarkerEnd}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}