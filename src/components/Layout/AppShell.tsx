import { useState, useCallback, useRef, useEffect } from 'react';
import { WaveformPlayer } from '../Player/WaveformPlayer';
import { DummyWaveform } from '../Player/DummyWaveform';
import { TransportControls } from '../Player/TransportControls';
import { TempoControls } from '../Player/TempoControls';
import { LoopControls } from '../Player/LoopControls';
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
import { useModeStore } from '../../stores/useModeStore';
import { usePlayback } from '../../hooks/usePlayback';
import { useDummyPlayback } from '../../hooks/useDummyPlayback';
import { useAlphaSynthPlayback } from '../../hooks/useAlphaSynthPlayback';
import { useAudioFile } from '../../hooks/useAudioFile';
import { useActiveMarkerTracker } from '../../hooks/useActiveMarkerTracker';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useSetlistAdvance } from '../../hooks/useSetlistAdvance';
import { useSyncSession } from '../../hooks/useSyncSession';
import { useSyncBroadcast } from '../../hooks/useSyncBroadcast';
import { useSyncStore } from '../../stores/useSyncStore';
import { emitSongData, emitSetlistSync } from '../../services/syncEmitter';
import { SyncStatus } from './SyncStatus';
import { NotationPanel } from '../Tabs/NotationPanel';
import { GpMarkerImportDialog } from '../Tabs/GpMarkerImportDialog';
import { useGpFile } from '../../hooks/useGpFile';
import { extractGpMarkers, gpMarksToSectionMarkers } from '../../utils/gpMarkerImport';
import type { GpRehearsalMark } from '../../utils/gpMarkerImport';
import type * as alphaTab from '@coderline/alphatab';
import { useControlCommandHandler } from '../../hooks/useControlCommandHandler';
import type { ControlCommand } from '../../../shared/syncProtocol';
import { RemoteControlView } from '../Controller/RemoteControlView';

export default function AppShell() {
  const [showMarkerForm, setShowMarkerForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showDummyDialog, setShowDummyDialog] = useState(false);
  const [tabMode, setTabMode] = useState<'ascii' | 'notation'>('notation');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showRemoteControl, setShowRemoteControl] = useState(false);

  const activeSong = useSongStore((state) => state.getActiveSong)();
  const addMarker = useSongStore((state) => state.addMarker);
  const setActiveMarker = useTabStore((state) => state.setActiveMarker);
  const addToast = useToastStore((state) => state.addToast);

  const mode = useModeStore((state) => state.mode);
  const autoAdvance = useModeStore((state) => state.autoAdvance);
  const isBand = mode === 'band';

  const isDummy = activeSong?.isDummy ?? false;

  // --- Band Sync ---
  const syncRole = useSyncStore((s) => s.role);
  const syncStatus = useSyncStore((s) => s.status);
  const isViewer = syncStatus === 'connected' && syncRole === 'viewer';

  // Viewer: always force band mode
  useEffect(() => {
    if (isViewer) {
      useModeStore.getState().setMode('band');
    }
  }, [isViewer]);

const controlCommandRef = useRef<((cmd: ControlCommand) => void) | null>(null);

  const syncSession = useSyncSession({
    onSongSelect: useCallback(async (songId: string) => {
      await useSongStore.getState().setActiveSongId(songId);
      await useTabStore.getState().loadTabsForSong(songId);
      await useTabStore.getState().loadSheetsForSong(songId);
    }, []),
    onPlaybackSync: useCallback(() => {
      // Playback sync handled via syncedTime/syncedIsPlaying in useSyncStore
    }, []),
    onControlCommand: useCallback((cmd: ControlCommand) => {
      controlCommandRef.current?.(cmd);
    }, []),
  });

  // --- Setlist advance (band mode) ---
  const pendingAutoPlayRef = useRef(false);
  const setlistAdvance = useSetlistAdvance({
    onPlay: () => {
      const ws = playback.wavesurferRef.current;
      const nextSong = useSongStore.getState().getActiveSong();
      if (nextSong?.isDummy && nextSong.gpFileName) {
        // alphaSynth song – defer until player is ready
        pendingAutoPlayRef.current = true;
      } else if (nextSong?.isDummy) {
        dummyPlayback.setCurrentTime(0);
        dummyPlayback.setIsPlaying(true);
      } else if (ws) {
        ws.setTime(0);
        ws.play();
        playback.setIsPlaying(true);
      } else {
        // Song not loaded yet (immediate advance, no countdown) — defer to handleReady
        pendingAutoPlayRef.current = true;
      }
    },
  });

  // --- Marker auto-tracking callback ---
  const onMarkerTimeUpdate = useCallback((t: number) => {
    const sorted = [...useSongStore.getState().getActiveMarkers()].sort(
      (a, b) => a.startTime - b.startTime,
    );
    const active = [...sorted].reverse().find((m) => m.startTime <= t + 0.1);
    if (active) setActiveMarker(active.id);
  }, [setActiveMarker]);

  // --- GP file (loaded early for isAlphaSynth routing) ---
  const gpFile = useGpFile();
  const hasGpFile = !!gpFile.activeGpData;
  const isAlphaSynth = isDummy && hasGpFile;
  const isPureDummy = isDummy && !hasGpFile;
  const isAudioGp = !isDummy && hasGpFile;

  // --- Playback hooks (all three always called – React rules of hooks) ---
  const playback = usePlayback({
    onTimeUpdate: !isDummy ? onMarkerTimeUpdate : undefined,
    onFinish: !isDummy ? setlistAdvance.handleSongFinish : undefined,
  });
  const dummyPlayback = useDummyPlayback({
    duration: activeSong?.duration ?? 0,
    onTimeUpdate: isPureDummy ? onMarkerTimeUpdate : undefined,
    onFinish: isPureDummy ? setlistAdvance.handleSongFinish : undefined,
  });
  const alphaSynthPlayback = useAlphaSynthPlayback({
    onTimeUpdate: isAlphaSynth ? onMarkerTimeUpdate : undefined,
    onFinish: isAlphaSynth ? setlistAdvance.handleSongFinish : undefined,
  });

  // --- Notation API callback (forwards to alphaSynth when needed) ---
  // Also stores raw API ref for viewer synth control (play/pause/seek/drift)
  const viewerApiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const handleNotationApiReady = useCallback((api: alphaTab.AlphaTabApi | null) => {
    // Host Dummy+GP: wire synth playback natively
    // Viewer Audio+GP: wire synth so we can track isReady + drive cursor
    if (isAlphaSynth || (isAudioGp && isViewer)) alphaSynthPlayback.setApi(api);
    viewerApiRef.current = api;
  }, [isAlphaSynth, isAudioGp, isViewer, alphaSynthPlayback]);

  // Tick reported by External Media sync (Audio+GP host) – used for broadcast
  const [externalMediaTick, setExternalMediaTick] = useState(0);
  const handleExternalMediaTick = useCallback((tick: number) => {
    setExternalMediaTick(tick);
  }, []);

  const syncOffset = activeSong?.syncOffset ?? null;
  const bpmAdjust = activeSong?.bpmAdjust ?? null;

  const handleSyncOffsetChange = useCallback((offset: number) => {
    const song = useSongStore.getState().getActiveSong();
    if (!song) return;
    useSongStore.getState().updateSong({ ...song, syncOffset: offset });
  }, []);

  const handleBpmAdjustChange = useCallback((adjust: number) => {
    const song = useSongStore.getState().getActiveSong();
    if (!song) return;
    useSongStore.getState().updateSong({ ...song, bpmAdjust: adjust });
  }, []);

  // --- GP Marker Import ---
  const [gpImportMarks, setGpImportMarks] = useState<GpRehearsalMark[] | null>(null);

  const handleGpMarkerImport = useCallback(() => {
    const api = viewerApiRef.current;
    if (!api?.score || !activeSong) return;

    const marks = extractGpMarkers(
      api.score,
      activeSong.syncOffset ?? 0,
      activeSong.bpmAdjust ?? 0,
    );

    if (marks.length === 0) {
      addToast('No rehearsal marks found in GP file', 'info');
      return;
    }

    setGpImportMarks(marks);
  }, [activeSong, addToast]);

  const handleGpImportMerge = useCallback(async () => {
    if (!gpImportMarks || !activeSong) return;
    const markers = gpMarksToSectionMarkers(gpImportMarks, activeSong.id);
    for (const m of markers) await addMarker(m);
    addToast(`Imported ${markers.length} section(s)`, 'success');
    setGpImportMarks(null);
  }, [gpImportMarks, activeSong, addMarker, addToast]);

  const handleGpImportReplace = useCallback(async () => {
    if (!gpImportMarks || !activeSong) return;
    const { removeMarker } = useSongStore.getState();
    const existing = useSongStore.getState().getActiveMarkers();
    for (const m of existing) await removeMarker(m.id);
    const markers = gpMarksToSectionMarkers(gpImportMarks, activeSong.id);
    for (const m of markers) await addMarker(m);
    addToast(`Replaced with ${markers.length} section(s)`, 'success');
    setGpImportMarks(null);
  }, [gpImportMarks, activeSong, addMarker, addToast]);

  // Unified playback values (3-way: wavesurfer / alphaSynth / dummy)
  const _isPlaying = isAlphaSynth ? alphaSynthPlayback.isPlaying
    : isDummy ? dummyPlayback.isPlaying : playback.isPlaying;
  const _currentTime = isAlphaSynth ? alphaSynthPlayback.currentTime
    : isDummy ? dummyPlayback.currentTime : playback.currentTime;
  const _duration = isAlphaSynth ? alphaSynthPlayback.duration
    : isDummy ? dummyPlayback.duration : playback.duration;
  const songLoop = isAlphaSynth ? alphaSynthPlayback.songLoop
    : isDummy ? dummyPlayback.songLoop : playback.songLoop;
  const handlePlayPause = isAlphaSynth ? alphaSynthPlayback.handlePlayPause
    : isDummy ? dummyPlayback.handlePlayPause : playback.handlePlayPause;
  const handleSeekTo = isAlphaSynth ? alphaSynthPlayback.handleSeekTo
    : isDummy ? dummyPlayback.handleSeekTo : playback.handleSeekTo;
  const handleReset = isAlphaSynth ? alphaSynthPlayback.handleReset
    : isDummy ? dummyPlayback.handleReset : playback.handleReset;
  const toggleSongLoop = isAlphaSynth ? alphaSynthPlayback.toggleSongLoop
    : isDummy ? dummyPlayback.toggleSongLoop : playback.toggleSongLoop;

  // Host: handle incoming control commands from remote Controller
  const handleControlCommand = useControlCommandHandler({
    handlePlayPause,
    handleSeekTo,
    isPlaying: _isPlaying,
  });
  controlCommandRef.current = handleControlCommand;

  // Viewer overrides: use synced playback from host
  const syncedTime = useSyncStore((s) => s.syncedTime);
  const syncedIsPlaying = useSyncStore((s) => s.syncedIsPlaying);
  const syncedCountdown = useSyncStore((s) => s.syncedCountdown);
  const syncedAutoAdvance = useSyncStore((s) => s.syncedAutoAdvance);
  const syncedTickPosition = useSyncStore((s) => s.syncedTickPosition);
  const isPlaying = isViewer ? syncedIsPlaying : _isPlaying;
  const currentTime = isViewer ? syncedTime : _currentTime;
  // Viewer has no wavesurfer → duration comes from the song metadata
  const duration = isViewer ? (activeSong?.duration ?? 0) : _duration;

  // Viewer: track active marker from synced time
  useEffect(() => {
    if (!isViewer) return;
    onMarkerTimeUpdate(currentTime);
  }, [isViewer, currentTime, onMarkerTimeUpdate]);

  // Host: broadcast playback state to peers
  useSyncBroadcast({
    isPlaying: _isPlaying,
    currentTime: _currentTime,
    countdownRemaining: setlistAdvance.isCountingDown ? setlistAdvance.countdownRemaining : null,
    tickPosition: isAlphaSynth
      ? alphaSynthPlayback.currentTick
      : isAudioGp ? externalMediaTick : null,
  });

  // --- Viewer + GP file: drive local alphaSynth from host state ---
  // The viewer runs its own alphaSynth (muted) so the cursor moves natively.
  // Host broadcasts play/pause + tickPosition; viewer mirrors and drift-corrects.
  // Works for both Dummy+GP and Audio+GP viewers.

  const viewerSynthReady = isViewer && hasGpFile && alphaSynthPlayback.isReady;

  // Mute MIDI output – viewer doesn't need audio, the band plays live
  useEffect(() => {
    if (!viewerSynthReady) return;
    const api = viewerApiRef.current;
    if (api) api.masterVolume = 0;
  }, [viewerSynthReady]);

  // Mirror host play/pause on local alphaSynth
  const prevSyncedPlayingRef = useRef(false);
  useEffect(() => {
    if (!viewerSynthReady) return;
    const api = viewerApiRef.current;
    if (!api) return;

    const wasPlaying = prevSyncedPlayingRef.current;
    prevSyncedPlayingRef.current = syncedIsPlaying;

    if (syncedIsPlaying && !wasPlaying) {
      // Host started: seek to host tick, then play
      const tick = useSyncStore.getState().syncedTickPosition;
      if (tick !== null) api.tickPosition = tick;
      api.play();
    } else if (!syncedIsPlaying && wasPlaying) {
      api.pause();
    }
  }, [viewerSynthReady, syncedIsPlaying]);

  // Viewer seek: when host seeks while paused, update local cursor
  useEffect(() => {
    if (!viewerSynthReady || syncedIsPlaying) return;
    const api = viewerApiRef.current;
    if (!api) return;

    if (syncedTickPosition !== null) {
      api.tickPosition = syncedTickPosition;
    }
  }, [viewerSynthReady, syncedIsPlaying, syncedTickPosition]);

  // Drift correction: compare host tick with local tick every 1s while playing
  const localTickRef = useRef(0);
  useEffect(() => {
    localTickRef.current = alphaSynthPlayback.currentTick;
  }, [alphaSynthPlayback.currentTick]);

  useEffect(() => {
    if (!viewerSynthReady || !syncedIsPlaying) return;
    const api = viewerApiRef.current;
    if (!api) return;

    const interval = setInterval(() => {
      const hostTick = useSyncStore.getState().syncedTickPosition;
      if (hostTick === null) return;

      const drift = Math.abs(hostTick - localTickRef.current);
      // ~half a bar in 4/4 at 960 ticks/beat = 1920 ticks
      if (drift > 1920) {
        api.tickPosition = hostTick;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [viewerSynthReady, syncedIsPlaying]);

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

    // Auto-play after setlist advance (band mode)
    if (pendingAutoPlayRef.current) {
      pendingAutoPlayRef.current = false;
      // Small delay to let wavesurfer settle
      setTimeout(() => {
        playback.wavesurferRef.current?.play();
        playback.setIsPlaying(true);
      }, 100);
    }
  }, [baseHandleReady, addToast, playback]);

  // Auto-play pure dummy songs after setlist advance (band mode)
  const activeSongId = useSongStore((state) => state.activeSongId);
  useEffect(() => {
    if (pendingAutoPlayRef.current && isPureDummy) {
      pendingAutoPlayRef.current = false;
      dummyPlayback.handlePlayPause();
    }
  }, [activeSongId, isPureDummy, dummyPlayback]);

  // Auto-play alphaSynth songs after setlist advance (band mode)
  const alphaSynthReady = alphaSynthPlayback.isReady;
  useEffect(() => {
    if (pendingAutoPlayRef.current && isAlphaSynth && alphaSynthReady) {
      pendingAutoPlayRef.current = false;
      alphaSynthPlayback.handlePlayPause();
    }
  }, [isAlphaSynth, alphaSynthReady, alphaSynthPlayback]);

  // Load persisted audio from IndexedDB when switching songs
  useEffect(() => {
    if (!activeSongId) return;
    if (!isDummy) {
      if (!audioFile.audioUrl) {
        audioFile.loadPersistedAudio(activeSongId);
      }
    }
    gpFile.loadPersistedGp(activeSongId);
  }, [activeSongId, isDummy, audioFile, gpFile]);

  // Host: push full song data to viewers on song switch
  // Use a small delay to ensure tabs/sheets are loaded first
  const sheets = useTabStore((s) => s.sheets);
  const tabs = useTabStore((s) => s.tabs);
  useEffect(() => {
    if (!activeSongId || !activeSong) return;
    if (syncStatus !== 'connected' || syncRole !== 'host') return;

    // Debounce: wait for tabs/sheets to settle after song switch
    const timer = setTimeout(() => {
      const markers = useSongStore.getState().getActiveMarkers();
      const { tabs: currentTabs, sheets: currentSheets } = useTabStore.getState();
      const songTabs = Object.values(currentTabs).filter((t) => t.songId === activeSongId);

      emitSongData({
        song: activeSong,
        markers,
        tabs: songTabs,
        sheets: currentSheets.filter((s) => s.songId === activeSongId),
        gpData: gpFile.activeGpData ?? null,
        gpFileName: activeSong.gpFileName ?? null,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [activeSongId, activeSong, syncStatus, syncRole, sheets, tabs, gpFile.activeGpData]);

  // Host: push setlist to viewers on connect + when songs/order change
  const songs = useSongStore((s) => s.songs);
  const songOrder = useSongStore((s) => s.songOrder);
  useEffect(() => {
    if (syncStatus !== 'connected' || syncRole !== 'host') return;
    if (songs.length === 0) return;

    emitSetlistSync({ songs, songOrder });
  }, [songs, songOrder, syncStatus, syncRole]);

  // --- Add marker handler ---
  const handleAddMarker = useCallback(() => {
    if (!audioFile.audioUrl && !isDummy) return;

    if (isAlphaSynth) {
      // alphaSynth: pause via API toggle if currently playing
      if (alphaSynthPlayback.isPlaying) alphaSynthPlayback.handlePlayPause();
    } else if (isDummy) {
      dummyPlayback.setIsPlaying(false);
    } else {
      const ws = playback.wavesurferRef.current;
      if (ws?.isPlaying()) {
        ws.pause();
        playback.setIsPlaying(false);
      }
    }
    setShowMarkerForm(true);
  }, [audioFile.audioUrl, isDummy, isAlphaSynth, dummyPlayback, playback, alphaSynthPlayback]);

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

  // Is there an active song with audio (or dummy)?
  // Viewers always show the player when a song is synced (no local audio needed)
  const hasPlayer = isViewer ? !!activeSong : (isDummy || !!audioFile.audioUrl);

  // --- Render ---

  return (
    <div className='min-h-screen bg-slate-900 text-slate-100 flex flex-col'>
      {/* Header */}
      <header className='px-6 py-3 border-b border-slate-700 flex items-center gap-3'>
        <img src={import.meta.env.BASE_URL + 'logo.png'} alt='SongLab' className='h-10 w-10 object-contain' />
        <h1 className='text-lg font-mono font-semibold tracking-wide'>SongLab</h1>

        {/* Mode toggle – segmented control (hidden for viewers) */}
        {!isViewer && (
        <div className='flex bg-slate-800 rounded-lg p-0.5 font-mono text-xs'>
          <button
            onClick={() => useModeStore.getState().setMode('practice')}
            className='px-3 py-1 rounded-md transition-colors'
            style={{
              backgroundColor: !isBand ? '#6366f1' : 'transparent',
              color: !isBand ? '#fff' : '#64748b',
            }}
          >
            Practice
          </button>
          <button
            onClick={() => useModeStore.getState().setMode('band')}
            className='px-3 py-1 rounded-md transition-colors'
            style={{
              backgroundColor: isBand ? '#6366f1' : 'transparent',
              color: isBand ? '#fff' : '#64748b',
            }}
          >
            Band
          </button>
        </div>
        )}

        <div className='flex-1 overflow-x-auto'>
          <SongTabs
            onAddSong={() => document.getElementById('file-input')?.click()}
            onCreateDummy={() => setShowDummyDialog(true)}
            isViewer={isViewer}
          />
        </div>

        <input
          id='file-input'
          type='file'
          accept='audio/*'
          className='hidden'
          onChange={audioFile.handleFileInput}
        />
        
        {/* Remote mode: compact and remote transport controll + choose sections or song*/}
        {isViewer && (
         <button
           onClick={() => setShowRemoteControl(true)}
            className='shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500
                       text-white font-mono text-xs transition-colors'
           >
            Remote
          </button>
        )}

        <SyncStatus
          onConnect={syncSession.connect}
          onDisconnect={syncSession.disconnect}
        />
      </header>

      <div className='flex flex-1 overflow-hidden'>
        <Sidebar
          onSeekTo={handleSeekTo}
          duration={duration}
          currentTime={currentTime}
          isViewer={isViewer}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />

        <main className='flex-1 flex flex-col gap-4 p-6 overflow-y-auto'>
          {/* Drop zone (only in practice mode when no active song) */}
          {!isBand && !hasPlayer && (
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
          {hasPlayer && activeSong && (
            <>
              {/* Title bar */}
                <div className='flex items-center'>
                <h2 className='font-mono text-slate-300 truncate'>
                  {activeSong.title}
                  {isDummy && (
                    <span className='ml-2 text-xs text-slate-500'>(no audio)</span>
                  )}
                </h2>
                <div className='flex-1 flex justify-center'>
                  {isBand && (
                    isViewer ? (
                      <div
                        className='rounded-lg px-6 py-2 font-mono text-sm'
                        style={{
                          backgroundColor: syncedAutoAdvance ? '#166534' : '#334155',
                          color: syncedAutoAdvance ? '#bbf7d0' : '#94a3b8',
                          border: syncedAutoAdvance ? '1px solid #22c55e' : '1px solid #475569',
                          opacity: 0.7,
                        }}
                      >
                        {syncedAutoAdvance ? '▸ Auto-play next song' : '▸ Manual next song'}
                      </div>
                    ) : (
                    <button
                      onClick={() => useModeStore.getState().setAutoAdvance(!autoAdvance)}
                      className='rounded-lg px-6 py-2 font-mono text-sm transition-colors'
                      style={{
                        backgroundColor: autoAdvance ? '#166534' : '#334155',
                        color: autoAdvance ? '#bbf7d0' : '#94a3b8',
                        border: autoAdvance ? '1px solid #22c55e' : '1px solid #475569',
                      }}
                      title='Toggle auto-advance to next song'
                    >
                      {autoAdvance ? '▸ Auto-play next song' : '▸ Manual next song'}
                    </button>
                    )
                  )}
                </div>
                <div className='flex items-center gap-3'>
                  {/* Band mode: compact play/pause + reset (host only) */}
                  {isBand && !isViewer && (
                    <div className='bg-slate-800 rounded-lg px-4 py-2 flex items-center gap-3'>
                      <button
                        onClick={handlePlayPause}
                        className='w-8 h-8 flex items-center justify-center rounded-full
                                   bg-indigo-500 hover:bg-indigo-400 text-white
                                   transition-colors text-sm'
                      >
                        {isPlaying ? '⏸' : '▶'}
                      </button>
                      <button
                        onClick={handleReset}
                        className='text-slate-300 hover:text-white transition-colors'
                        title='Reset to start'
                      >
                        ⏮
                      </button>
                      <div className='w-px h-6 bg-slate-600' />
                      <button
                        onClick={toggleSongLoop}
                        className='px-3 py-1 rounded font-mono text-xs transition-colors'
                        style={{
                          backgroundColor: songLoop ? '#22c55e' : '#334155',
                          color: songLoop ? '#fff' : '#94a3b8',
                        }}
                        title='Loop entire song'
                      >
                        🔁 song
                      </button>
                      <div className='w-px h-6 bg-slate-600' />
                      <LoopControls songLoop={songLoop} />
                    </div>
                  )}

                  {!isDummy && !isViewer && (
                    <div className='bg-slate-800 rounded-lg px-4 py-2 flex items-center'>
                      <VolumeControl />
                    </div>
                  )}

                  {!isBand && (
                    isDummy ? (
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
                    )
                  )}
                </div>
              </div>

              {/* Waveform */}
              {(isDummy || isViewer) ? (
                <DummyWaveform
                  duration={duration}
                  currentTime={currentTime}
                  height={isBand ? 64 : 96}
                  onSeek={isViewer ? undefined : handleSeekTo}
                />
              ) : (
                <WaveformPlayer
                  audioUrl={audioFile.audioUrl!}
                  height={isBand ? 64 : 96}
                  onReady={handleReady}
                  onTimeUpdate={playback.handleTimeUpdate}
                  onFinish={playback.handleFinish}
                  wavesurferRef={playback.wavesurferRef}
                />
              )}

              {/* Countdown overlay (band mode auto-advance) */}
              {setlistAdvance.isCountingDown && !isViewer && (
                <div className='flex items-center gap-3'>
                  <div className='bg-slate-800 rounded-lg px-4 py-2 font-mono text-sm
                                  text-indigo-400'>
                    Next song in {setlistAdvance.countdownRemaining}s
                  </div>
                  <button
                    onClick={setlistAdvance.skipCountdown}
                    className='bg-slate-800 rounded-lg px-4 py-2 font-mono text-xs
                               text-slate-400 hover:text-white transition-colors'
                  >
                    skip →
                  </button>
                </div>
              )}
              {/* Viewer countdown (synced from host) */}
              {isViewer && syncedCountdown !== null && (
                <div className='flex items-center gap-3'>
                  <div className='bg-slate-800 rounded-lg px-4 py-2 font-mono text-sm
                                  text-indigo-400'>
                    Next song in {syncedCountdown}s
                  </div>
                </div>
              )}

              {/* Controls – practice mode only */}
              {!isBand && (
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

                  {(!isDummy || isAlphaSynth) && (
                    <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center'>
                      <TempoControls />
                    </div>
                  )}
                </div>
              )}

              {/* MarkerForm – practice mode only */}
              {!isBand && showMarkerForm && (
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

              {/* Keyboard shortcut hints – practice mode only */}
              {!isBand && (
                <p className='text-xs text-slate-600 font-mono'>
                  Space: play/pause · M: add marker · ←/→: seek 1s · L: loop toggle
                </p>
              )}

              {/* Tab section */}
              {(selectedMarker || hasGpFile || activeSong) && (
                <div className='flex flex-col gap-2 flex-1 min-h-64'>
                  <div className='border-t border-slate-700 pt-4 flex items-center
                                  justify-between'>
                    <div className='flex items-center gap-3'>
                      <h3 className='text-xs font-mono text-slate-400 uppercase tracking-widest'>
                        Tab
                      </h3>

                      {/* Mode toggle: Notation / ASCII (only when GP file exists) */}
                      {hasGpFile && (
                        <div className='flex bg-slate-800 rounded p-0.5 font-mono text-xs'>
                          <button
                            onClick={() => setTabMode('notation')}
                            className='px-2 py-0.5 rounded transition-colors'
                            style={{
                              backgroundColor: tabMode === 'notation' ? '#6366f1' : 'transparent',
                              color: tabMode === 'notation' ? '#fff' : '#64748b',
                            }}
                          >
                            Notation
                          </button>
                          <button
                            onClick={() => setTabMode('ascii')}
                            className='px-2 py-0.5 rounded transition-colors'
                            style={{
                              backgroundColor: tabMode === 'ascii' ? '#6366f1' : 'transparent',
                              color: tabMode === 'ascii' ? '#fff' : '#64748b',
                            }}
                          >
                            ASCII
                          </button>
                        </div>
                      )}

                      {/* Edit toggle (ASCII mode only) */}
                      {(!hasGpFile || tabMode === 'ascii') && !isBand && selectedMarker && (
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
                      )}

                      {/* GP file import button (no GP file yet) */}
                      {!hasGpFile && !isBand && (
                        <label className='px-2 py-1 text-xs font-mono rounded cursor-pointer
                                          transition-colors bg-slate-700 hover:bg-slate-600
                                          text-slate-300'>
                          🎼 Add GP file
                          <input
                            type='file'
                            accept='.gp,.gp3,.gp4,.gp5,.gpx,.gp8'
                            className='hidden'
                            onChange={gpFile.handleGpFileInput}
                          />
                        </label>
                      )}

                      {/* Remove GP file button */}
                      {hasGpFile && !isBand && (
                        <button
                          onClick={() => activeSong && gpFile.removeGp(activeSong.id)}
                          className='px-2 py-1 text-xs font-mono rounded transition-colors
                                    bg-slate-700 hover:bg-red-900 text-slate-400
                                    hover:text-red-300'
                        >
                          ✕ Remove GP
                        </button>
                      )}

                      {/* Import markers from GP file */}
                      {hasGpFile && !isBand && (
                        <button
                          onClick={handleGpMarkerImport}
                          className='px-2 py-1 text-xs font-mono rounded transition-colors
                                    bg-slate-700 hover:bg-slate-600 text-slate-300'
                        >
                          Import Markers
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notation mode */}
                  {hasGpFile && tabMode === 'notation' ? (
                    <NotationPanel
                      gpData={gpFile.activeGpData!}
                      songId={activeSong!.id}
                      enableSynth={isAlphaSynth || (isAudioGp && isViewer)}
                      enableExternalMedia={isAudioGp && !isViewer}
                      isPlaying={isPlaying}
                      showSyncEditor={isAudioGp && !isBand}
                      syncOffset={syncOffset}
                      bpmAdjust={bpmAdjust}
                      currentTime={currentTime}
                      onSyncOffsetChange={handleSyncOffsetChange}
                      onBpmAdjustChange={handleBpmAdjustChange}
                      onApiReady={handleNotationApiReady}
                      onTickUpdate={handleExternalMediaTick}
                    />
                  ) : (
                    /* ASCII mode (existing behavior) */
                    selectedMarker && (
                      <>
                        {!isBand && editMode ? (
                          <TabEditor marker={selectedMarker} songId={activeSong!.id} />
                        ) : (
                          <TabViewer
                            marker={selectedMarker}
                            currentTime={currentTime}
                            isPlaying={isPlaying}
                            sectionEnd={selectedMarkerEnd}
                            isViewer={isViewer}
                          />
                        )}
                      </>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Remote Controller fullscreen overlay (viewer only) */}
      {isViewer && showRemoteControl && (
        <div className='fixed inset-0 z-9999 bg-slate-900'>
          <div className='flex flex-col h-full'>
            <div className='flex items-center justify-between px-4 py-2
                            border-b border-slate-700'>
              <span className='font-mono text-xs text-slate-400 uppercase tracking-widest'>
                Remote Control
              </span>
              <button
                onClick={() => setShowRemoteControl(false)}
                className='px-3 py-1.5 rounded font-mono text-xs
                           bg-slate-700 hover:bg-slate-600 text-slate-300
                           transition-colors'
              >
                ✕ Close
              </button>
            </div>
            <div className='flex-1 overflow-hidden'>
              <RemoteControlView />
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
      {showDummyDialog && (
        <CreateDummySongDialog onClose={() => setShowDummyDialog(false)} />
      )}

      {gpImportMarks && (
        <GpMarkerImportDialog
          marks={gpImportMarks}
          hasExistingSections={useSongStore.getState().getActiveMarkers().length > 0}
          onMerge={handleGpImportMerge}
          onReplace={handleGpImportReplace}
          onCancel={() => setGpImportMarks(null)}
        />
      )}
    </div>
  );
}