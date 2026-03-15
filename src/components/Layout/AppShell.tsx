import { useState, useCallback } from 'react';
import { WaveformPlayer } from '../Player/WaveformPlayer';
import { DummyWaveform } from '../Player/DummyWaveform';
import { TransportControls } from '../Player/TransportControls';
import { TempoControls } from '../Player/TempoControls';
import { MarkerForm } from '../Markers/MarkerForm';
import { TabEditor } from '../Tabs/TabEditor';
import { TabViewer } from '../Tabs/TabViewer';
import { SongTabs } from './SongTabs';
import { Sidebar } from './Sidebar';
import { ToastContainer } from './Toast';
import { CreateDummySongDialog } from './CreateDummySongDialog';
import { VolumeControl } from '../Player/VolumeControl';
import { useSongStore } from '../../stores/useSongStore';
import { useTabStore } from '../../stores/useTabStore';
import { useToastStore } from '../../stores/useToastStore';
import { usePlayback } from '../../hooks/usePlayback';
import { useDummyPlayback } from '../../hooks/useDummyPlayback';
import { useAudioFile } from '../../hooks/useAudioFile';
import { useActiveMarkerTracker } from '../../hooks/useActiveMarkerTracker';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

export default function AppShell() {
  const [showMarkerForm, setShowMarkerForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showDummyDialog, setShowDummyDialog] = useState(false);

  const activeSong = useSongStore((state) => state.getActiveSong)();
  const addMarker = useSongStore((state) => state.addMarker);
  const setActiveMarker = useTabStore((state) => state.setActiveMarker);
  const addToast = useToastStore((state) => state.addToast);

  const isDummy = activeSong?.isDummy ?? false;

  // --- Marker auto-tracking callback ---
  const onMarkerTimeUpdate = useCallback((t: number) => {
    const sorted = [...useSongStore.getState().getActiveMarkers()].sort(
      (a, b) => a.startTime - b.startTime,
    );
    const active = [...sorted].reverse().find((m) => m.startTime <= t + 0.1);
    if (active) setActiveMarker(active.id);
  }, [setActiveMarker]);

  // --- Playback hooks (both always called, React rules) ---
  const playback = usePlayback({
    onTimeUpdate: isDummy ? undefined : onMarkerTimeUpdate,
  });
  const dummyPlayback = useDummyPlayback({
    duration: activeSong?.duration ?? 0,
    onTimeUpdate: isDummy ? onMarkerTimeUpdate : undefined,
  });

  // Unified playback values
  const isPlaying = isDummy ? dummyPlayback.isPlaying : playback.isPlaying;
  const currentTime = isDummy ? dummyPlayback.currentTime : playback.currentTime;
  const duration = isDummy ? dummyPlayback.duration : playback.duration;
  const songLoop = isDummy ? dummyPlayback.songLoop : playback.songLoop;
  const handlePlayPause = isDummy ? dummyPlayback.handlePlayPause : playback.handlePlayPause;
  const handleSeekTo = isDummy ? dummyPlayback.handleSeekTo : playback.handleSeekTo;
  const handleReset = isDummy ? dummyPlayback.handleReset : playback.handleReset;
  const toggleSongLoop = isDummy ? dummyPlayback.toggleSongLoop : playback.toggleSongLoop;

  // --- Audio file handling ---
  const audioFile = useAudioFile({
    onFileLoaded: () => {
      playback.setIsPlaying(false);
      playback.setCurrentTime(0);
    },
    onUpgraded: () => {
      dummyPlayback.setIsPlaying(false);
      dummyPlayback.setCurrentTime(0);
    },
  });

  // --- Marker tracking ---
  const { selectedMarker, selectedMarkerEnd } = useActiveMarkerTracker(currentTime, duration);

  // --- Ready handler with marker-beyond-duration check ---
  const baseHandleReady = playback.handleReady;
  const handleReady = useCallback((d: number) => {
    baseHandleReady(d);

    const song = useSongStore.getState().getActiveSong();
    if (!song) return;

    // Check markers beyond real audio duration (upgrade case)
    if (song.duration > d) {
      const markers = useSongStore.getState().getActiveMarkers();
      const beyondCount = markers.filter((m) => m.startTime > d).length;
      if (beyondCount > 0) {
        addToast(`${beyondCount} marker(s) beyond audio duration`, 'error', 5000);
      }
    }

    // Update song duration to match actual audio
    if (song.duration !== d) {
      useSongStore.getState().updateSong({ ...song, duration: d });
    }
  }, [baseHandleReady, addToast]);

  // --- Add marker handler ---
  const handleAddMarker = useCallback(() => {
    if (!audioFile.audioUrl && !isDummy) return;

    if (isDummy) {
      dummyPlayback.setIsPlaying(false);
    } else {
      const ws = playback.wavesurferRef.current;
      if (ws?.isPlaying()) {
        ws.pause();
        playback.setIsPlaying(false);
      }
    }
    setShowMarkerForm(true);
  }, [audioFile.audioUrl, isDummy, dummyPlayback, playback]);

  // --- Upgrade dummy → real audio ---
  const handleUpgradeFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeSong) {
      audioFile.upgradeDummySong(file, activeSong.id);
    }
  }, [activeSong, audioFile]);

  // --- Keyboard shortcuts ---
  useKeyboardShortcuts({
    wavesurferRef: playback.wavesurferRef,
    onPlayPause: handlePlayPause,
    onAddMarker: handleAddMarker,
    isPlaying,
    onSeek: isDummy ? handleSeekTo : undefined,
    currentTime: isDummy ? currentTime : undefined,
    duration: isDummy ? duration : undefined,
  });

  // --- Render ---

  return (
    <div className='min-h-screen bg-slate-900 text-slate-100 flex flex-col'>
      {/* Header */}
      <header className='px-6 py-3 border-b border-slate-700 flex items-center gap-3'>
        <span className='text-indigo-400 text-xl'>🎸</span>
        <h1 className='text-lg font-mono font-semibold tracking-wide'>SongLab</h1>

        <div className='flex-1 overflow-x-auto'>
          <SongTabs
            onAddSong={() => document.getElementById('file-input')?.click()}
            onCreateDummy={() => setShowDummyDialog(true)}
          />
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
          onSeekTo={handleSeekTo}
          duration={duration}
          currentTime={currentTime}
        />

        <main className='flex-1 flex flex-col gap-4 p-6 overflow-y-auto'>
          {/* Drop zone (only when no active song or real song without audio) */}
          {!isDummy && !audioFile.audioUrl && (
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
              <button
                onClick={() => setShowDummyDialog(true)}
                className='text-xs font-mono text-indigo-400 hover:text-indigo-300
                           transition-colors'
              >
                or create without audio
              </button>
            </div>
          )}

          {/* Player (dummy or real) */}
          {(isDummy || audioFile.audioUrl) && activeSong && (
            <>
              {/* Title bar */}
              <div className='flex items-center justify-between'>
                <h2 className='font-mono text-slate-300 truncate'>
                  {activeSong.title}
                  {isDummy && (
                    <span className='ml-2 text-xs text-slate-500'>(no audio)</span>
                  )}
                </h2>
                <div className='flex items-center gap-3'>
                  {!isDummy && (
                    <div className='bg-slate-800 rounded-lg px-4 py-2 flex items-center'>
                      <VolumeControl />
                    </div>
                  )}
                  {isDummy ? (
                    <label className='bg-slate-800 rounded-lg px-4 py-2 text-xs text-indigo-400
                                      hover:text-indigo-300 font-mono cursor-pointer
                                      transition-colors'>
                      attach audio file
                      <input
                        type='file'
                        accept='audio/*'
                        className='hidden'
                        onChange={handleUpgradeFile}
                      />
                    </label>
                  ) : (
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
                  )}
                </div>
              </div>

              {/* Waveform */}
              {isDummy ? (
                <DummyWaveform
                  duration={duration}
                  currentTime={currentTime}
                  onSeek={handleSeekTo}
                />
              ) : (
                <WaveformPlayer
                  audioUrl={audioFile.audioUrl!}
                  onReady={handleReady}
                  onTimeUpdate={playback.handleTimeUpdate}
                  onFinish={playback.handleFinish}
                  wavesurferRef={playback.wavesurferRef}
                />
              )}

              {/* Controls */}
              <div className='flex items-stretch gap-3 flex-wrap'>
                <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center'>
                  <TransportControls
                    wavesurferRef={playback.wavesurferRef}
                    onSeek={isDummy ? handleSeekTo : undefined}
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    songLoop={songLoop}
                    onSongLoopToggle={toggleSongLoop}
                    onReset={handleReset}
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

                {!isDummy && (
                  <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center'>
                    <TempoControls />
                  </div>
                )}
              </div>

              {/* MarkerForm */}
              {showMarkerForm && (
                <MarkerForm
                  currentTime={currentTime}
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
                Space: play/pause · M: add marker · ←/→: seek 1s · L: loop toggle
              </p>

              {/* Tab section */}
              {selectedMarker && (
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

      <ToastContainer />

      {showDummyDialog && (
        <CreateDummySongDialog onClose={() => setShowDummyDialog(false)} />
      )}
    </div>
  );
}