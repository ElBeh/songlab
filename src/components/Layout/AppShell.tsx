import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { WaveformPlayer } from '../Player/WaveformPlayer';
import { DummyWaveform } from '../Player/DummyWaveform';
import { TransportControls } from '../Player/TransportControls';
import { TempoControls } from '../Player/TempoControls';
import { LoopPopoverButton } from '../Player/Looppopoverbutton';
import { TempoIndicator } from '../Player/TempoIndicator';
import { MarkerForm } from '../Markers/MarkerForm';
import { TabEditor } from '../Tabs/TabEditor';
import { TabViewer } from '../Tabs/TabViewer';
import { Sidebar } from './Sidebar';
import { ToastContainer } from './Toast';
import { CreateDummySongDialog } from './CreateDummySongDialog';
import { VolumeControl } from '../Player/VolumeControl';
import { useSongStore } from '../../stores/useSongStore';
import { useTabStore } from '../../stores/useTabStore';
import { useToastStore } from '../../stores/useToastStore';
import { useModeStore } from '../../stores/useModeStore';
import { useTempoStore } from '../../stores/useTempoStore';
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
import { JoinPromptDialog } from './JoinPromptDialog';
import { NotationPanel } from '../Tabs/NotationPanel';
import { SongbookView } from '../Songbook/SongbookView';
import { SongbookEditor } from '../Songbook/SongbookEditor';
import { withBpmAdjust } from '../../services/tempoMap';
import type { TimelineBar } from '../../types';
import { MarkerImportDialog } from '../Markers/MarkerImportDialog';
import { useGpFile, isGpFile } from '../../hooks/useGpFile';
import { extractGpMarkers } from '../../utils/gpMarkerImport';
import { importedMarksToSectionMarkers, type ImportedMark } from '../../utils/sectionImport';
import { parseChordPro } from '../../utils/chordSheetParser';
import { songbookSectionsToMarks } from '../../utils/songbookMarkerImport';
import type * as alphaTab from '@coderline/alphatab';
import { useControlCommandHandler } from '../../hooks/useControlCommandHandler';
import { useMidiInput } from '../../hooks/useMidiInput';
import { useCountIn } from '../../hooks/useCountIn';
import { useCountInStore } from '../../stores/useCountInStore';
import { CountInToggle } from '../Player/CountInToggle';
import { CountInIndicator } from '../Player/CountInIndicator';
import { useMetronome } from '../../hooks/useMetronome';
import { useSectionLoop } from '../../hooks/useSectionLoop';
import { MetronomeToggle } from '../Player/MetronomeToggle';
import { MetronomeSplitButton } from '../Player/MetronomeSplitButton';
import type { ControlCommand, SyncRole } from '../../../shared/syncProtocol';
import { RemoteControlView } from '../Controller/RemoteControlView';
import { Music, Pause, Play, SkipBack, Repeat, Eye, Pencil, Music2, X } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';
import { useSetlistStore } from '../../stores/useSetlistStore';
import { useShallow } from 'zustand/shallow';
import { ModeMenu } from './ModeMenu';
import { ToolsMenu } from './ToolsMenu';  
import { StandaloneMetronome } from '../Tools/StandaloneMetronome';

const VIEW_MODE_LABELS = { notation: 'Notation', ascii: 'ASCII', songbook: 'Songbook' } as const;

export default function AppShell() {
  const [showMarkerForm, setShowMarkerForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showDummyDialog, setShowDummyDialog] = useState(false);
  // Role requested via QR join link (?join=viewer); triggers the join prompt
  const [joinRole, setJoinRole] = useState<SyncRole | null>(null);

  // Detect the QR join parameter once on mount, then strip it from the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('join') === 'viewer') {
      setJoinRole('viewer');
      params.delete('join');
      const query = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
    }
  }, []);
  // Sheet view mode; 'notation' falls back to ASCII while no GP file is loaded
  const [tabMode, setTabMode] = useState<'ascii' | 'notation' | 'songbook'>('notation');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showRemoteControl, setShowRemoteControl] = useState(false);
  const [showMetronome, setShowMetronome] = useState(false);

  // State selector (not the stable getter) so song changes reliably re-render
  const activeSong = useSongStore(
    (state) => state.songs.find((s) => s.id === state.activeSongId) ?? null,
  );
  const addMarker = useSongStore((state) => state.addMarker);
  const setActiveMarker = useTabStore((state) => state.setActiveMarker);

  // On song switch: songs without GP file open in the songbook if they have one.
  // Adjusting state during render on a changed key – no useEffect needed.
  const [lastViewSongId, setLastViewSongId] = useState<string | null>(null);
  if (activeSong && activeSong.id !== lastViewSongId) {
    setLastViewSongId(activeSong.id);
    if (!activeSong.gpFileName && activeSong.chordSheet) setTabMode('songbook');
  }
  const addToast = useToastStore((state) => state.addToast);

  const mode = useModeStore((state) => state.mode);
  const autoAdvance = useModeStore((state) => state.autoAdvance);
  const isSession = mode === 'session';

  const isDummy = activeSong?.isDummy ?? false;

  // --- Band Sync ---
  const syncRole = useSyncStore((s) => s.role);
  const syncStatus = useSyncStore((s) => s.status);
  const isViewer = syncStatus === 'connected' && syncRole === 'viewer';

  // Viewer: always force band mode
  useEffect(() => {
    if (isViewer) {
      useModeStore.getState().setMode('session');
    }
  }, [isViewer]);

  // Load song library + setlists from IndexedDB on mount
  useEffect(() => {
    const init = async () => {
      await useSongStore.getState().loadAllSongs();
      await useSetlistStore.getState().loadSetlists();
    };
    init();
  }, []);

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
    // Markers are kept sorted by startTime in the store (see useSongStore),
    // so the last matching entry is the active section — no re-sort needed.
    const markers = useSongStore.getState().getActiveMarkers();
    const active = markers.findLast((m) => m.startTime <= t + 0.1);
    // Before the first marker no section is active: clear the selection so the
    // whole-song tab is shown instead of the last visited marker's tab
    setActiveMarker(active?.id ?? null);
  }, [setActiveMarker]);

  // --- GP file (loaded early for isAlphaSynth routing) ---
  const gpFile = useGpFile();
  const { loadPersistedGp } = gpFile;
  const hasGpFile = !!gpFile.activeGpData;
  const viewMode = tabMode === 'notation' && !hasGpFile ? 'ascii' : tabMode;
  const isAlphaSynth = isDummy && hasGpFile;
  const isPureDummy = isDummy && !hasGpFile;
  const isAudioGp = !isDummy && hasGpFile;

  // --- Playback hooks (all three always called – React rules of hooks) ---
  // Loop restart ref: wired to count-in logic after useCountIn is set up below
  const loopRestartRef = useRef<(() => void) | undefined>(undefined);
  const handleLoopRestart = useCallback(() => { loopRestartRef.current?.(); }, []);

  const playback = usePlayback({
    onTimeUpdate: !isDummy ? onMarkerTimeUpdate : undefined,
    onFinish: !isDummy ? setlistAdvance.handleSongFinish : undefined,
    onLoopRestart: !isDummy ? handleLoopRestart : undefined,
  });
  const dummyPlayback = useDummyPlayback({
    duration: activeSong?.duration ?? 0,
    onTimeUpdate: isPureDummy ? onMarkerTimeUpdate : undefined,
    onFinish: isPureDummy ? setlistAdvance.handleSongFinish : undefined,
    onLoopRestart: isPureDummy ? handleLoopRestart : undefined,
  });
  const alphaSynthPlayback = useAlphaSynthPlayback({
    onTimeUpdate: isAlphaSynth ? onMarkerTimeUpdate : undefined,
    onFinish: isAlphaSynth ? setlistAdvance.handleSongFinish : undefined,
    onLoopRestart: isAlphaSynth ? handleLoopRestart : undefined,
  });

  // Destructured stable references (memoized in the hooks) so effect/callback
  // dependency arrays can list them directly and stay exhaustive-deps clean.
  const { wavesurferRef, setIsPlaying: playbackSetIsPlaying } = playback;
  const { handlePlayPause: dummyHandlePlayPause, setIsPlaying: dummySetIsPlaying } = dummyPlayback;
  const {
    setApi: alphaSynthSetApi,
    handlePlayPause: alphaSynthHandlePlayPause,
    isPlaying: alphaSynthIsPlaying,
  } = alphaSynthPlayback;

  // --- Notation API callback (forwards to alphaSynth when needed) ---
  // Also stores raw API ref for viewer synth control (play/pause/seek/drift)
  const viewerApiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const handleNotationApiReady = useCallback((api: alphaTab.AlphaTabApi | null) => {
    // Host Dummy+GP: wire synth playback natively
    // Viewer Audio+GP: wire synth so we can track isReady + drive cursor
    if (isAlphaSynth || (isAudioGp && isViewer)) alphaSynthSetApi(api);
    viewerApiRef.current = api;
  }, [isAlphaSynth, isAudioGp, isViewer, alphaSynthSetApi]);

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

  // Auto-set BPM and time signature from GP file score data
  const [scoreTimeline, setScoreTimeline] = useState<TimelineBar[]>([]);
  const handleScoreInfo = useCallback((info: {
    bpm: number;
    timeSignature: [number, number];
    timeline: TimelineBar[];
  }) => {
    const song = useSongStore.getState().getActiveSong();
    if (!song) return;
    // GP file is authoritative – overwrite any manual values
    useSongStore.getState().updateSong({
      ...song,
      bpm: Math.round(info.bpm),
      timeSignature: info.timeSignature,
    });
    setScoreTimeline(info.timeline);
  }, []);

  // --- Marker Import (GP rehearsal marks, songbook sections) ---
  const [markerImport, setMarkerImport] = useState<{
    title: string;
    description: string;
    note?: string;
    marks: ImportedMark[];
    /** Marker id prefix per source ("gp", "sb") */
    idPrefix: string;
  } | null>(null);

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

    setMarkerImport({
      title: 'Import GP Markers',
      description: `Found ${marks.length} rehearsal mark${marks.length !== 1 ? 's' : ''} in the Guitar Pro file:`,
      marks,
      idPrefix: 'gp',
    });
  }, [activeSong, addToast]);

  const handleMarkerImportMerge = useCallback(async () => {
    if (!markerImport || !activeSong) return;
    const markers = importedMarksToSectionMarkers(markerImport.marks, activeSong.id, markerImport.idPrefix);
    await Promise.all(markers.map((m) => addMarker(m)));
    addToast(`Imported ${markers.length} section(s)`, 'success');
    setMarkerImport(null);
  }, [markerImport, activeSong, addMarker, addToast]);

  const handleMarkerImportReplace = useCallback(async () => {
    if (!markerImport || !activeSong) return;
    const { removeMarker } = useSongStore.getState();
    const existing = useSongStore.getState().getActiveMarkers();
    await Promise.all(existing.map((m) => removeMarker(m.id)));
    const markers = importedMarksToSectionMarkers(markerImport.marks, activeSong.id, markerImport.idPrefix);
    await Promise.all(markers.map((m) => addMarker(m)));
    addToast(`Replaced with ${markers.length} section(s)`, 'success');
    setMarkerImport(null);
  }, [markerImport, activeSong, addMarker, addToast]);

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

  const playbackRate = useTempoStore((s) => s.playbackRate);

  // --- Count-in (plays click bar before actual playback starts) ---
  const countIn = useCountIn({
    bpm: activeSong?.bpm ?? null,
    timeSignature: activeSong?.timeSignature ?? null,
    playbackRate,
    onComplete: handlePlayPause,
    audible: !isViewer,
  });
  const currentBeat = useCountInStore((s) => s.currentBeat);

  const handlePlayPauseWithCountIn = useCallback(() => {
    // Currently counting in → cancel
    if (countIn.isCountingIn) {
      countIn.cancelCountIn();
      return;
    }
    // Not playing + count-in available → start count-in first
    if (!_isPlaying && countIn.canCountIn) {
      countIn.startCountIn();
      return;
    }
    // Otherwise: normal play/pause toggle
    handlePlayPause();
  }, [countIn, _isPlaying, handlePlayPause]);

  // Stop playback and open standalone metronome
  const handleOpenMetronome = useCallback(() => {
    if (countIn.isCountingIn) countIn.cancelCountIn();
    if (_isPlaying) handlePlayPause();
    setShowMetronome(true);
  }, [_isPlaying, handlePlayPause, countIn]);

  // Wire loop restart ref to count-in (resolves circular dep with playback hooks)
  const { canCountIn, startCountIn } = countIn;
  useEffect(() => {
    loopRestartRef.current = () => {
      if (canCountIn) {
        startCountIn();
      } else {
        handlePlayPause();
      }
    };
  }, [canCountIn, startCountIn, handlePlayPause]);

  // --- Section loop (shared across wavesurfer, alphaSynth and dummy clock) ---
  useSectionLoop({
    isPlaying: _isPlaying,
    currentTime: _currentTime,
    onSeek: handleSeekTo,
    enabled: !isViewer,
  });

  // --- Metronome (continuous click during playback) ---
  // alphaSynth reports score time directly, so no sync offset applies there.
  // Audio playback reports media time, which the song's sync offset maps to
  // score time. The BPM correction only exists in Audio + GP mode.
  const metronomeTimeline = useMemo(() => {
    if (scoreTimeline.length === 0) return undefined;
    if (isAlphaSynth) return scoreTimeline;
    return withBpmAdjust(scoreTimeline, activeSong?.bpmAdjust ?? 0);
  }, [scoreTimeline, isAlphaSynth, activeSong?.bpmAdjust]);

  const metronome = useMetronome({
    hasSong: !!activeSong,
    bpm: activeSong?.bpm ?? null,
    timeSignature: activeSong?.timeSignature ?? null,
    playbackRate,
    isPlaying: _isPlaying,
    audible: !isViewer,
    timeline: metronomeTimeline,
    currentTime: _currentTime,
    songTimeOffset: isAlphaSynth ? 0 : (activeSong?.syncOffset ?? 0) / 1000,
  });

  // Host: handle incoming control commands from remote Controller
  const handleControlCommand = useControlCommandHandler({
    handlePlayPause: handlePlayPauseWithCountIn,
    handleSeekTo,
    isPlaying: _isPlaying,
  });
  // Keep the ref in sync inside an effect — mutating refs during render is
  // unsafe with concurrent rendering (a render may be discarded or replayed).
  useEffect(() => {
    controlCommandRef.current = handleControlCommand;
  }, [handleControlCommand]);

  // MIDI input: footswitch / controller via Web MIDI API
  useMidiInput({
    handlePlayPause: handlePlayPauseWithCountIn,
    handleSeekTo,
    currentTime: _currentTime,
  });

  // Viewer overrides: use synced playback from host
  const syncedTime = useSyncStore((s) => s.syncedTime);
  const syncedIsPlaying = useSyncStore((s) => s.syncedIsPlaying);
  const syncedCountdown = useSyncStore((s) => s.syncedCountdown);
  const syncedAutoAdvance = useSyncStore((s) => s.syncedAutoAdvance);
  const syncedTickPosition = useSyncStore((s) => s.syncedTickPosition);
  const syncedCountInBeat = useSyncStore((s) => s.syncedCountInBeat);
  const isPlaying = isViewer ? syncedIsPlaying : _isPlaying;
  const currentTime = isViewer ? syncedTime : _currentTime;
  // Viewer has no wavesurfer → duration comes from the song metadata
  const duration = isViewer ? (activeSong?.duration ?? 0) : _duration;

  // Viewer: mirror host count-in state into CountInStore for the overlay
  useEffect(() => {
    if (!isViewer) return;
    const store = useCountInStore.getState();
    if (syncedCountInBeat !== null) {
      if (!store.isCountingIn) store.start(activeSong?.timeSignature?.[0] ?? 4);
      store.setBeat(syncedCountInBeat);
    } else if (store.isCountingIn) {
      store.finish();
    }
  }, [isViewer, syncedCountInBeat, activeSong?.timeSignature]);

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
    countInBeat: countIn.isCountingIn ? (currentBeat ?? null) : null,
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
  const { audioUrl, loadPersistedAudio, upgradeDummySong } = audioFile;

  // --- Marker tracking ---
  const { selectedMarker, selectedMarkerEnd } = useActiveMarkerTracker(currentTime, duration);

  // --- Songbook marker import ---
  // Parsed once per text change, not per playback tick
  const chordSheet = activeSong?.chordSheet ?? null;
  const songbookSections = useMemo(
    () => (chordSheet ? parseChordPro(chordSheet).sections : []),
    [chordSheet],
  );
  const hasSongbookSections = useMemo(
    () => songbookSectionsToMarks(songbookSections, 0).length > 0,
    [songbookSections],
  );

  const handleSongbookMarkerImport = useCallback(() => {
    const marks = songbookSectionsToMarks(songbookSections, duration);
    if (marks.length === 0) {
      addToast('No labeled sections found in the songbook', 'info');
      return;
    }
    setMarkerImport({
      title: 'Import Songbook Sections',
      description: `Found ${marks.length} section${marks.length !== 1 ? 's' : ''} in the songbook:`,
      note: 'Start times are estimated from the text length. Drag the markers to their exact position afterwards.',
      marks,
      idPrefix: 'sb',
    });
  }, [songbookSections, duration, addToast]);

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
        wavesurferRef.current?.play();
        playbackSetIsPlaying(true);
      }, 100);
    }
  }, [baseHandleReady, addToast, wavesurferRef, playbackSetIsPlaying]);

  // Auto-play pure dummy songs after setlist advance (band mode)
  const activeSongId = useSongStore((state) => state.activeSongId);
  useEffect(() => {
    if (pendingAutoPlayRef.current && isPureDummy) {
      pendingAutoPlayRef.current = false;
      dummyHandlePlayPause();
    }
  }, [activeSongId, isPureDummy, dummyHandlePlayPause]);

  // Auto-play alphaSynth songs after setlist advance (band mode)
  const alphaSynthReady = alphaSynthPlayback.isReady;
  useEffect(() => {
    if (pendingAutoPlayRef.current && isAlphaSynth && alphaSynthReady) {
      pendingAutoPlayRef.current = false;
      alphaSynthHandlePlayPause();
    }
  }, [isAlphaSynth, alphaSynthReady, alphaSynthHandlePlayPause]);

  // Load persisted audio from IndexedDB when switching songs
  useEffect(() => {
    if (!activeSongId) return;
    if (!isDummy) {
      if (!audioUrl) {
        loadPersistedAudio(activeSongId);
      }
    }
    loadPersistedGp(activeSongId);
  }, [activeSongId, isDummy, audioUrl, loadPersistedAudio, loadPersistedGp]);

  // Host: push full song data to viewers on song switch, GP change, or
  // (re)connect. Incremental edits (markers, tabs, sheets) are synced via
  // their granular events, and song metadata reaches viewers through the
  // setlist broadcast — so the heavy full push (incl. GP binary) must not
  // be re-sent on every edit.
  useEffect(() => {
    if (!activeSongId) return;
    if (syncStatus !== 'connected' || syncRole !== 'host') return;

    // Debounce: wait for tabs/sheets to settle after song switch
    const timer = setTimeout(() => {
      const song = useSongStore.getState().songs.find((s) => s.id === activeSongId);
      if (!song) return;
      const markers = useSongStore.getState().getActiveMarkers();
      const { tabs: currentTabs, sheets: currentSheets } = useTabStore.getState();
      const songTabs = Object.values(currentTabs).filter((t) => t.songId === activeSongId);

      emitSongData({
        song,
        markers,
        tabs: songTabs,
        sheets: currentSheets.filter((s) => s.songId === activeSongId),
        gpData: gpFile.activeGpData ?? null,
        gpFileName: song.gpFileName ?? null,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [activeSongId, syncStatus, syncRole, gpFile.activeGpData]);

// Host: push setlist to viewers on connect + when songs/order change
  const songs = useSongStore((s) => s.songs);
  const allSetlists = useSetlistStore((s) => s.setlists);
  const songOrder = useSetlistStore(useShallow((state) => {
    const active = state.setlists.find((s) => s.id === state.activeSetlistId);
    return active?.items ?? [];
  }));

  useEffect(() => {
    if (syncStatus !== 'connected' || syncRole !== 'host') return;
    if (songs.length === 0) return;

    const { activeSetlistId: currentSetlistId } = useSetlistStore.getState();
    const items = useSetlistStore.getState().getActiveItems();
    const activeSetlist = useSetlistStore.getState().getActiveSetlist();
    emitSetlistSync({
      songs,
      songOrder: items,
      activeSetlistName: activeSetlist?.name ?? null,
      // Full setlist collection so controllers can browse and switch
      setlists: allSetlists.map((sl) => ({ id: sl.id, name: sl.name, items: sl.items })),
      activeSetlistId: currentSetlistId,
    });
  }, [songs, songOrder, allSetlists, syncStatus, syncRole]);

  // --- Add marker handler ---
  const handleAddMarker = useCallback(() => {
    if (!audioUrl && !isDummy) return;

    if (isAlphaSynth) {
      // alphaSynth: pause via API toggle if currently playing
      if (alphaSynthIsPlaying) alphaSynthHandlePlayPause();
    } else if (isDummy) {
      dummySetIsPlaying(false);
    } else {
      const ws = wavesurferRef.current;
      if (ws?.isPlaying()) {
        ws.pause();
        playbackSetIsPlaying(false);
      }
    }
    setShowMarkerForm(true);
  }, [
    audioUrl,
    isDummy,
    isAlphaSynth,
    dummySetIsPlaying,
    wavesurferRef,
    playbackSetIsPlaying,
    alphaSynthIsPlaying,
    alphaSynthHandlePlayPause,
  ]);

  // --- Upgrade dummy → real audio ---
  const handleUpgradeFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeSong) {
      upgradeDummySong(file, activeSong.id);
    }
  }, [activeSong, upgradeDummySong]);

  // --- Keyboard shortcuts ---
  useKeyboardShortcuts({
    wavesurferRef: playback.wavesurferRef,
    onPlayPause: handlePlayPauseWithCountIn,
    onAddMarker: handleAddMarker,
    onSeek: isDummy ? handleSeekTo : undefined,
    currentTime: isDummy ? currentTime : undefined,
    duration: isDummy ? duration : undefined,
    disabled: showMetronome,
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
        <div className='flex items-baseline gap-2'>
          <h1 className='text-lg font-mono font-semibold tracking-wide'>SongLab</h1>
          <span className='font-mono text-xs text-slate-500'>v{__APP_VERSION__}</span>
        </div>

        {/* Mode toggle – segmented control (hidden for viewers) */}
          {!isViewer && (
          <div className='flex gap-1'>
            <ModeMenu />
            <ToolsMenu onOpenMetronome={handleOpenMetronome} />
          </div>
        )}

        <input
          id='file-input'
          type='file'
          accept='audio/*,.gp,.gp3,.gp4,.gp5,.gpx,.gp8'
          className='hidden'
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (isGpFile(file.name)) {
              gpFile.createSongFromGpFile(file);
            } else {
              audioFile.handleFileInput(e);
            }
            e.target.value = '';
          }}
        />

        <div className='flex-1' />
        
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
          onAddMarker={handleAddMarker}
          onAddSong={() => document.getElementById('file-input')?.click()}
          onCreateDummy={() => setShowDummyDialog(true)}
        />

        <main className='flex-1 flex flex-col gap-4 p-6 overflow-y-auto relative'>
          <CountInIndicator />
          {/* Drop zone (only in practice mode when no active song) */}
          {!isSession && !hasPlayer && (
            <div
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (!file) return;
                if (isGpFile(file.name)) {
                  audioFile.handleDragLeave();
                  gpFile.createSongFromGpFile(file);
                } else {
                  audioFile.handleDrop(e);
                }
              }}
              onDragOver={audioFile.handleDragOver}
              onDragLeave={audioFile.handleDragLeave}
              className={`flex flex-col items-center justify-center border-2 border-dashed
                          rounded-xl py-16 gap-4 transition-colors cursor-pointer
                          ${audioFile.isDragging
                            ? 'border-indigo-400 bg-indigo-950'
                            : 'border-slate-600 hover:border-slate-400'}`}
            >
              <span className='text-4xl'><Music size={36} /></span>
              <p className='text-slate-400 font-mono text-sm'>
                Drop an audio or Guitar Pro file here, or
              </p>
              <label className='px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white
                                rounded-lg font-mono text-sm cursor-pointer transition-colors'>
                Browse file
                <input
                  type='file'
                  accept='audio/*,.gp,.gp3,.gp4,.gp5,.gpx,.gp8'
                  className='hidden'
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (isGpFile(file.name)) {
                      gpFile.createSongFromGpFile(file);
                    } else {
                      audioFile.handleFileInput(e);
                    }
                    e.target.value = '';
                  }}
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
                  {isSession && (
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
                  {/* Session mode: compact play/pause + reset (host only) */}
                  {isSession && !isViewer && (
                    <div className='bg-slate-800 rounded-lg px-4 py-2 flex items-center gap-2'>
                      <button
                        onClick={handlePlayPauseWithCountIn}
                        className='w-8 h-8 flex items-center justify-center rounded-full
                                   bg-indigo-500 hover:bg-indigo-400 text-white
                                   transition-colors text-sm'
                      >
                        {isPlaying ? <Pause key='pause' size={ICON_SIZE.TRANSPORT} /> : <Play key='play' size={ICON_SIZE.TRANSPORT} />}
                      </button>
                      <button
                        onClick={handleReset}
                        className='text-slate-300 hover:text-white transition-colors'
                        title='Reset to start'
                      >
                        <SkipBack size={ICON_SIZE.TRANSPORT} />
                      </button>
                      <div className='w-px h-6 bg-slate-600' />

                      <div className='bg-slate-800 rounded-lg flex items-center gap-1'>
                        <button
                          onClick={toggleSongLoop}
                          className='px-3 py-1 rounded font-mono text-xs transition-colors'
                          style={{
                            backgroundColor: songLoop ? '#22c55e' : '#334155',
                            color: songLoop ? '#fff' : '#94a3b8',
                          }}
                          title='Loop entire song'
                        >
                          <Repeat size={ICON_SIZE.ACTION} className='inline-block' /> song
                        </button>
                        <LoopPopoverButton songLoop={songLoop} />
                      </div>

                      <div className='w-px h-6 bg-slate-600' />
                      <CountInToggle compact />
                      <div className='w-px h-6 bg-slate-600' />

                      <MetronomeSplitButton
                        isSoloMode={metronome.isSoloMode}
                        isRunning={metronome.isRunning}
                        onStartSolo={metronome.startSolo}
                        onStopSolo={metronome.stopSolo}
                      />
                      {(!isDummy || isAlphaSynth) && (
                        <>
                          <div className='w-px h-6 bg-slate-600' />
                          <TempoIndicator />
                        </>
                      )}

                      <div className='w-px h-6 bg-slate-600' />

                      {!isDummy && (
                        <div className='bg-slate-800 rounded-lg px-4 py-2 flex items-center'>
                          <VolumeControl />
                        </div>
                      )}


                    </div>
                  )}

                </div>
              </div>

              {/* Waveform */}
              {(isDummy || isViewer) ? (
                <DummyWaveform
                  duration={duration}
                  currentTime={currentTime}
                  height={isSession ? 32 : 96}
                  onSeek={isViewer ? undefined : handleSeekTo}
                />
              ) : (
                <WaveformPlayer
                  audioUrl={audioFile.audioUrl!}
                  height={isSession ? 32 : 96}
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
              {!isSession && (
                <div className='flex items-stretch gap-3 flex-wrap'>
                  <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center'>
                    <TransportControls
                      wavesurferRef={playback.wavesurferRef}
                      onSeek={isDummy ? handleSeekTo : undefined}
                      currentTime={currentTime}
                      duration={duration}
                      isPlaying={isPlaying}
                      onPlayPause={handlePlayPauseWithCountIn}
                      songLoop={songLoop}
                      onSongLoopToggle={toggleSongLoop}
                      onReset={handleReset}
                      canEditDuration={isPureDummy}
                      onDurationChange={(seconds) => {
                        if (!activeSong) return;
                        useSongStore.getState().updateSong({ ...activeSong, duration: seconds });
                      }}
                    />
                  </div>

                  <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3'>
                    <CountInToggle />
                    <div className='w-px h-6 bg-slate-600' />
                    <MetronomeToggle
                      isSoloMode={metronome.isSoloMode}
                      isRunning={metronome.isRunning}
                      onStartSolo={metronome.startSolo}
                      onStopSolo={metronome.stopSolo}
                    />
                  </div>

                  {(!isDummy || isAlphaSynth) && (
                    <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center'>
                      <TempoControls />
                    </div>
                  )}

                  {/* volume controls */}
                  {!isDummy && !isViewer && (
                    <div className='bg-slate-800 rounded-lg px-4 py-2 flex items-center'>
                      <VolumeControl />
                    </div>
                  )}

                  {/* attach or change audiofile */}

                    {isDummy ? (
                      <label className='flex items-center bg-slate-800 rounded-lg px-4 py-2 text-xs text-indigo-400
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
                      <label className='flex items-center bg-slate-800 rounded-lg px-4 py-2 text-xs text-slate-500
                                        hover:text-slate-300 font-mono cursor-pointer
                                        transition-colors'>
                        change audio file
                        <input
                          type='file'
                          accept='audio/*'
                          className='hidden'
                          onChange={audioFile.handleFileInput}
                        />
                      </label>
                    )}


                </div>
                )
              }


              {/* MarkerForm modal – practice mode only */}
              {!isSession && showMarkerForm && (
                <MarkerForm
                  currentTime={currentTime}
                  songId={activeSong.id}
                  onAdd={async (marker) => {
                    await addMarker(marker);
                    const { getActiveMarkers, updateMarker } = useSongStore.getState();
                    const sameType = getActiveMarkers().filter(
                      (x) => x.type === marker.type && x.id !== marker.id,
                    );
                    await Promise.all(
                      sameType.map((x) => updateMarker({ ...x, color: marker.color })),
                    );
                    setShowMarkerForm(false);
                  }}
                  onCancel={() => setShowMarkerForm(false)}
                />
              )}

              {/* Keyboard shortcut hints – practice mode only */}
              {!isSession && (
                <p className='text-xs text-slate-600 font-mono'>
                  Space: play/pause · M: add marker · ←/→: seek 1s · L: loop toggle
                </p>
              )}

              {/* Tab section */}
              {activeSong && (
                <div className='flex flex-col gap-2 flex-1 min-h-64'>
                  <div className='border-t border-slate-700 pt-4 flex items-center
                                  justify-between'>
                    <div className='flex items-center gap-3'>
                      <h3 className='text-xs font-mono text-slate-400 uppercase tracking-widest'>
                        Sheet
                      </h3>

                      {/* View mode toggle: Notation (only with GP file) / ASCII / Songbook */}
                      <div className='flex bg-slate-800 rounded p-0.5 font-mono text-xs'>
                        {(['notation', 'ascii', 'songbook'] as const)
                          .filter((value) => value !== 'notation' || hasGpFile)
                          .map((value) => (
                          <button
                            key={value}
                            onClick={() => setTabMode(value)}
                            className='px-2 py-0.5 rounded transition-colors'
                            style={{
                              backgroundColor: viewMode === value ? '#6366f1' : 'transparent',
                              color: viewMode === value ? '#fff' : '#64748b',
                            }}
                          >
                            {VIEW_MODE_LABELS[value]}
                          </button>
                        ))}
                      </div>

                      {/* Edit toggle (ASCII and songbook). Without markers the whole-song tab is edited */}
                      {viewMode !== 'notation' && !isSession && (
                        <button
                          onClick={() => setEditMode((v) => !v)}
                          className='self-start px-3 py-1 text-sm font-mono rounded
                                    transition-colors'
                          style={{
                            backgroundColor: editMode ? '#6366f1' : '#475569',
                            color: editMode ? '#fff' : '#cbd5e1',
                          }}
                        >
                          {editMode
                            ? <><Eye size={ICON_SIZE.ACTION} className='inline-block' /> View {viewMode === 'songbook' ? 'Songbook' : 'Tab'}</>
                            : <><Pencil size={ICON_SIZE.ACTION} className='inline-block' /> Edit {viewMode === 'songbook' ? 'Songbook' : 'Tab'}</>}
                        </button>
                      )}

                      {/* GP file import button (no GP file yet) */}
                      {!hasGpFile && !isSession && (
                        <label className='px-2 py-1 text-xs font-mono rounded cursor-pointer
                                          transition-colors bg-slate-700 hover:bg-slate-600
                                          text-slate-300'>
                          <Music2 size={ICON_SIZE.LABEL} className='inline-block' /> Add GP file
                          <input
                            type='file'
                            accept='.gp,.gp3,.gp4,.gp5,.gpx,.gp8'
                            className='hidden'
                            onChange={gpFile.handleGpFileInput}
                          />
                        </label>
                      )}

                      {/* Remove GP file button */}
                      {hasGpFile && !isSession && (
                        <button
                          onClick={() => activeSong && gpFile.removeGp(activeSong.id)}
                          className='px-2 py-1 text-xs font-mono rounded transition-colors
                                    bg-slate-700 hover:bg-red-900 text-slate-400
                                    hover:text-red-300'
                        >
                          <X size={ICON_SIZE.ACTION} className='inline-block' /> Remove GP
                        </button>
                      )}

                      {/* Import markers from the songbook sections (songbook mode only) */}
                      {viewMode === 'songbook' && hasSongbookSections && !isSession && (
                        <button
                          onClick={handleSongbookMarkerImport}
                          className='px-2 py-1 text-xs font-mono rounded transition-colors
                                    bg-slate-700 hover:bg-slate-600 text-slate-300'
                        >
                          Import Songbook Markers
                        </button>
                      )}

                      {/* Import markers from GP file */}
                      {hasGpFile && !isSession && (
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
                  {viewMode === 'notation' ? (
                    <NotationPanel
                      gpData={gpFile.activeGpData!}
                      songId={activeSong!.id}
                      enableSynth={isAlphaSynth || (isAudioGp && isViewer)}
                      enableExternalMedia={isAudioGp && !isViewer}
                      isPlaying={isPlaying}
                      showSyncEditor={isAudioGp && !isSession}
                      syncOffset={syncOffset}
                      bpmAdjust={bpmAdjust}
                      currentTime={currentTime}
                      onSyncOffsetChange={handleSyncOffsetChange}
                      onBpmAdjustChange={handleBpmAdjustChange}
                      onApiReady={handleNotationApiReady}
                      onTickUpdate={handleExternalMediaTick}
                      onScoreInfo={handleScoreInfo}
                      onSeek={handleSeekTo} 
                    />
                  ) : viewMode === 'songbook' ? (
                    /* Songbook mode: lyrics with chords for the whole song */
                    !isSession && editMode ? (
                      <SongbookEditor song={activeSong} />
                    ) : activeSong.chordSheet ? (
                      <SongbookView
                        chordSheet={activeSong.chordSheet}
                        activeMarker={selectedMarker}
                      />
                    ) : (
                      <div className='flex-1 min-h-48 flex items-center justify-center
                                      bg-slate-900 rounded-lg border border-slate-700
                                      text-slate-600 font-mono text-sm'>
                        {isSession ? 'No songbook for this song' : 'No songbook yet. Click Edit Songbook to add lyrics and chords.'}
                      </div>
                    )
                  ) : (
                    /* ASCII mode: marker tab with fallback to the whole-song tab */
                    activeSong && (
                      <>
                        {!isSession && editMode ? (
                          <TabEditor marker={selectedMarker} songId={activeSong.id} />
                        ) : (
                          <TabViewer
                            marker={selectedMarker}
                            songId={activeSong.id}
                            currentTime={currentTime}
                            isPlaying={isPlaying}
                            sectionEnd={selectedMarkerEnd}
                            songDuration={duration}
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
              <div className='flex items-baseline gap-2'>
                <span className='font-mono text-xs text-slate-400 uppercase tracking-widest'>
                  Remote Control
                </span>
                <span className='font-mono text-xs text-slate-500'>v{__APP_VERSION__}</span>
              </div>
              <button
                onClick={() => setShowRemoteControl(false)}
                className='px-3 py-1.5 rounded font-mono text-xs
                           bg-slate-700 hover:bg-slate-600 text-slate-300
                           transition-colors'
              >
                <X size={ICON_SIZE.ACTION} className='inline-block' /> Close
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

      {joinRole && (
        <JoinPromptDialog
          role={joinRole}
          onJoin={(name) => {
            syncSession.connect(window.location.origin, joinRole, name);
            setJoinRole(null);
          }}
          onClose={() => setJoinRole(null)}
        />
      )}

      {showMetronome && (
        <StandaloneMetronome onClose={() => setShowMetronome(false)} />
      )}

      {markerImport && (
        <MarkerImportDialog
          title={markerImport.title}
          description={markerImport.description}
          note={markerImport.note}
          marks={markerImport.marks}
          hasExistingSections={useSongStore.getState().getActiveMarkers().length > 0}
          onMerge={handleMarkerImportMerge}
          onReplace={handleMarkerImportReplace}
          onCancel={() => setMarkerImport(null)}
        />
      )}
    </div>
  );
}