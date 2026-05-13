import { useRef, useEffect, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { SyncOffsetEditor } from './SyncOffsetEditor';
import { useExternalMediaSync, buildTempoMap, tickToElapsedMs } from '../../hooks/useExternalMediaSync';
import { analyzeTuning, formatTuning } from '../../utils/tuningPresets';
import { ArrowLeftRight, ArrowUpDown, Minus, Plus, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';

interface TrackMixerState {
  index: number;
  name: string;
  volume: number;
  muted: boolean;
  solo: boolean;
}

interface NotationPanelProps {
  gpData: ArrayBuffer;
  songId: string;
  /** Enable alphaSynth MIDI playback (Dummy + GP mode) */
  enableSynth?: boolean;
  /** Enable external media cursor sync (Audio + GP mode) */
  enableExternalMedia?: boolean;
  /** Whether audio is currently playing (needed for external media sync) */
  isPlaying?: boolean;
  /** Show sync offset editor (Audio + GP mode, practice only) */
  showSyncEditor?: boolean;
  /** Audio time offset in ms where bar 1 beat 1 starts (null = not set) */
  syncOffset?: number | null;
  /** Additive BPM correction (null = not set) */
  bpmAdjust?: number | null;
  currentTime?: number;
  onSyncOffsetChange?: (offset: number) => void;
  onBpmAdjustChange?: (adjust: number) => void;
  /** Fires when the AlphaTabApi is created (and again with null on destroy).
   *  The parent hooks into this to wire useAlphaSynthPlayback. */
  onApiReady?: (api: alphaTab.AlphaTabApi | null) => void;
  /** Fires with the computed tick position during external media sync */
  onTickUpdate?: (tick: number) => void;
  /** Fires when the score is loaded with BPM, time signature and tempo map from the GP file */
  onScoreInfo?: (info: {
    bpm: number;
    timeSignature: [number, number];
    tempoMap: TempoMapEntry[];
  }) => void;
    /** Fires when user clicks on a beat in notation (Audio + GP mode) */
  onSeek?: (time: number) => void;
}

/** Tempo and time signature at a specific tick position in the score */
export interface TempoMapEntry {
  tick: number;
  bpm: number;
  beatsPerBar: number;
}

export function NotationPanel({
  gpData,
  songId,
  enableSynth = false,
  enableExternalMedia = false,
  isPlaying = false,
  showSyncEditor = false,
  syncOffset = null,
  bpmAdjust = null,
  currentTime = 0,
  onSyncOffsetChange,
  onBpmAdjustChange,
  onApiReady,
  onTickUpdate,
  onScoreInfo,
  onSeek,
}: NotationPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const layoutRef = useRef<'page' | 'horizontal'>('horizontal');

  const [tracks, setTracks] = useState<{ index: number; name: string; tuning: number[] }[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [layout, setLayout] = useState<'page' | 'horizontal'>('horizontal');
  const [scale, setScale] = useState(0.5);
  const [synthLoading, setSynthLoading] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [trackStates, setTrackStates] = useState<TrackMixerState[]>([]);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [apiForEditor, setApiForEditor] = useState<alphaTab.AlphaTabApi | null>(null);

  // Keep refs in sync
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Initialize alphaTab API
  useEffect(() => {
    if (!containerRef.current) return;

    const settings = new alphaTab.Settings();
    settings.core.fontDirectory = import.meta.env.BASE_URL + 'font/';
    settings.display.scale = scaleRef.current;
    settings.display.layoutMode =
      layoutRef.current === 'page' ? alphaTab.LayoutMode.Page : alphaTab.LayoutMode.Horizontal;

    // Configure player mode upfront so alphaTab creates cursor elements
    if (enableSynth) {
      settings.player.soundFont = import.meta.env.BASE_URL + 'soundfont/sonivox.sf2';
      settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
    } else if (enableExternalMedia) {
      settings.player.soundFont = import.meta.env.BASE_URL + 'soundfont/sonivox.sf2';
      settings.player.playerMode = alphaTab.PlayerMode.EnabledExternalMedia;
    } else {
      settings.player.playerMode = alphaTab.PlayerMode.Disabled;
    }

    // Scroll is handled manually (see RAF effect below) – do not set
    // scrollElement to avoid double-scroll conflicts with alphaTab internals.

    const api = new alphaTab.AlphaTabApi(containerRef.current, settings);

    api.scoreLoaded.on((score) => {
      const trackList = score.tracks.map((t, i) => ({
        index: i,
        name: t.name || `Track ${i + 1}`,
        tuning: t.staves.length > 0 && t.staves[0].stringTuning
          ? Array.from(t.staves[0].stringTuning.tunings) as number[]
          : [],
      }));
      setTracks(trackList);
      setActiveTrackIndex(0);

      // Initialize mixer states
      setTrackStates(
        score.tracks.map((t, i) => ({
          index: i,
          name: t.name || `Track ${i + 1}`,
          volume: 1.0,
          muted: false,
          solo: false,
        })),
      );

      // Extract BPM, time signature, and tempo map for metronome sync
      if (onScoreInfo && score.masterBars.length > 0) {
        const mb = score.masterBars[0];

        // Build tempo map: one entry per bar where BPM or time signature changes
        const tempoMap: { tick: number; bpm: number; beatsPerBar: number }[] = [];
        let currentBpm = score.tempo;
        let currentBeatsPerBar = mb.timeSignatureNumerator;

        for (const bar of score.masterBars) {
          const barBpm = bar.tempoAutomation ? bar.tempoAutomation.value : currentBpm;
          const barBeats = bar.timeSignatureNumerator;

          if (barBpm !== currentBpm || barBeats !== currentBeatsPerBar || bar === score.masterBars[0]) {
            tempoMap.push({ tick: bar.start, bpm: barBpm, beatsPerBar: barBeats });
            currentBpm = barBpm;
            currentBeatsPerBar = barBeats;
          }
        }

        onScoreInfo({
          bpm: score.tempo,
          timeSignature: [mb.timeSignatureNumerator, mb.timeSignatureDenominator],
          tempoMap,
        });
      }
    });

    if (enableSynth || enableExternalMedia) {
      setSynthLoading(true);

      api.playerReady.on(() => {
        setSynthLoading(false);
      });

      api.soundFontLoad.on((e) => {
        if (e.loaded >= e.total) {
          setSynthLoading(false);
        }
      });
    }

    apiRef.current = api;
    setApiForEditor(api);
    onApiReady?.(api);

    return () => {
      onApiReady?.(null);
      api.destroy();
      apiRef.current = null;
      setApiForEditor(null);
    };
  // onApiReady intentionally excluded – stable callback ref from parent
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId, enableSynth, enableExternalMedia]);

  // Load GP data into alphaTab
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !gpData) return;

    const uint8 = new Uint8Array(gpData);
    api.load(uint8);
  }, [gpData, songId]);

  // Update layout when toggled
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    api.settings.display.layoutMode =
      layout === 'page' ? alphaTab.LayoutMode.Page : alphaTab.LayoutMode.Horizontal;
    api.updateSettings();
    api.render();
  }, [layout]);

  // Update scale/zoom when changed
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    api.settings.display.scale = scale;
    api.updateSettings();
    api.render();
  }, [scale]);

  // Manual cursor-follow scroll for both page and horizontal mode.
  // alphaTab's built-in scrollElement only works when its own player drives
  // playback. In External Media mode (and after layout switches) it doesn't
  // fire, so we handle scrolling ourselves via requestAnimationFrame.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isPlaying) return;

    const beat = () => container.querySelector('.at-cursor-beat') as HTMLElement | null;

    let rafId = 0;
    const tick = () => {
      const el = beat();
      if (el) {
        const beatRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (layout === 'page') {
          const offset = beatRect.top - containerRect.top;
          const target = container.scrollTop + offset - containerRect.height * 0.3;

          if (Math.abs(offset - containerRect.height * 0.3) > 50) {
            container.scrollTo({ top: target, behavior: 'smooth' });
          }
        } else {
          const offset = beatRect.left - containerRect.left;

          if (offset < 0 || offset > containerRect.width * 0.85) {
            const target = container.scrollLeft + offset - containerRect.width * 0.1;
            container.scrollTo({ left: target, behavior: 'instant' });
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [layout, isPlaying]);

  // Switch track
  useEffect(() => {
    const api = apiRef.current;
    if (!api?.score) return;

    const track = api.score.tracks[activeTrackIndex];
    if (track) {
      api.renderTracks([track]);
    }
  }, [activeTrackIndex]);

  // --- External media sync (Audio + GP: cursor follows wavesurfer) ---
  useExternalMediaSync({
    api: enableExternalMedia ? apiForEditor : null,
    syncOffset: enableExternalMedia ? (syncOffset ?? 0) : 0,
    bpmAdjust: enableExternalMedia ? (bpmAdjust ?? 0) : 0,
    isPlaying: enableExternalMedia ? isPlaying : false,
    currentTime: enableExternalMedia ? currentTime : 0,
    onTickUpdate: enableExternalMedia ? onTickUpdate : undefined,
  });

// Click-to-seek: clicking a beat in the notation seeks the audio position
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !enableExternalMedia || !onSeek) return;

      const handleBeatMouseDown = (beat: alphaTab.model.Beat) => {
        const tempoMap = buildTempoMap(api)
          .map((seg) => ({ ...seg, bpm: seg.bpm + (bpmAdjust ?? 0) }));
        const elapsedMs = tickToElapsedMs(beat.absoluteDisplayStart, tempoMap);
        const audioTime = (elapsedMs + (syncOffset ?? 0)) / 1000;
        onSeek(audioTime);
      };

    api.beatMouseDown.on(handleBeatMouseDown);
    return () => api.beatMouseDown.off(handleBeatMouseDown);
  // onSeek intentionally excluded – stable callback ref from parent
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableExternalMedia, syncOffset, bpmAdjust, apiForEditor]);

  // --- Mixer controls ---

  const handleMasterVolumeChange = (volume: number) => {
    const api = apiRef.current;
    if (!api) return;
    api.masterVolume = volume;
    setMasterVolume(volume);
  };

  const handleVolumeChange = (index: number, volume: number) => {
    const api = apiRef.current;
    if (!api?.score) return;

    const track = api.score.tracks[index];
    if (!track) return;

    api.changeTrackVolume([track], volume);
    setTrackStates((prev) =>
      prev.map((t) => (t.index === index ? { ...t, volume } : t)),
    );
  };

  const handleMuteToggle = (index: number) => {
    const api = apiRef.current;
    if (!api?.score) return;

    const track = api.score.tracks[index];
    if (!track) return;

    const current = trackStates.find((t) => t.index === index);
    if (!current) return;

    const newMuted = !current.muted;
    api.changeTrackMute([track], newMuted);
    setTrackStates((prev) =>
      prev.map((t) => (t.index === index ? { ...t, muted: newMuted } : t)),
    );
  };

  const handleSoloToggle = (index: number) => {
    const api = apiRef.current;
    if (!api?.score) return;

    const track = api.score.tracks[index];
    if (!track) return;

    const current = trackStates.find((t) => t.index === index);
    if (!current) return;

    const newSolo = !current.solo;
    api.changeTrackSolo([track], newSolo);
    setTrackStates((prev) =>
      prev.map((t) => (t.index === index ? { ...t, solo: newSolo } : t)),
    );
  };

  // Derive tuning label for active track
  const activeTrack = tracks.find((t) => t.index === activeTrackIndex);
  const tuningLabel = activeTrack && activeTrack.tuning.length > 0
    ? formatTuning(analyzeTuning(activeTrack.tuning))
    : '';

  return (
    <div className='flex flex-col gap-2 flex-1 min-h-64'>
      {/* Controls bar */}
      <div className='flex items-center gap-3'>
          {/* Controls wrapper */}
          <div
            className="bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3"
          >
          {/* Track selector */}
          {tracks.length > 1 && (
          <select
            value={activeTrackIndex}
            onChange={(e) => setActiveTrackIndex(Number(e.target.value))}
            className='bg-slate-800 text-slate-200 text-xs font-mono rounded
                       px-2 py-1 border border-slate-600 focus:border-indigo-500
                       outline-none'
          >
            {tracks.map((t) => (
              <option key={t.index} value={t.index}>
                {t.name}
              </option>
            ))}
          </select>
          )}

          {/* Tuning display */}
          {tuningLabel && (
            <span
              className='text-xs font-mono text-amber-400 truncate'
              style={{ maxWidth: '200px' }}
              title={tuningLabel}
            >
              {tuningLabel}
            </span>
          )}

          {/* Divider */}
          <div className='w-px h-6 bg-slate-600 mx-1' />
      
          {/* Layout toggle */}
          <button
            onClick={() => setLayout((l) => (l === 'page' ? 'horizontal' : 'page'))}
            className="px-2 py-1 text-xs font-mono rounded transition-colors
                      bg-slate-700 hover:bg-slate-600 text-slate-300"
          >
            {layout === 'page' ? <><ArrowLeftRight size={ICON_SIZE.ACTION} className='inline-block' /> Horizontal</> : <><ArrowUpDown size={ICON_SIZE.ACTION} className='inline-block' /> Page</>}
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setScale((s) => Math.max(0.3, Math.round((s - 0.1) * 10) / 10))
              }
              className="px-1.5 py-0.5 text-xs font-mono rounded transition-colors
                        bg-slate-700 hover:bg-slate-600 text-slate-300"
              title="Zoom out"
            >
              <Minus size={ICON_SIZE.ACTION} />
            </button>

            <span className="text-xs font-mono text-slate-400 min-w-8 text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={() =>
                setScale((s) => Math.min(1.5, Math.round((s + 0.1) * 10) / 10))
              }
              className="px-1.5 py-0.5 text-xs font-mono rounded transition-colors
                        bg-slate-700 hover:bg-slate-600 text-slate-300"
              title="Zoom in"
            >
              <Plus size={ICON_SIZE.ACTION} />
            </button>
          </div>
        
          {/* Divider */}
          <div className='w-px h-6 bg-slate-600 mx-1' />

        {/* Sync Offset Editor (Audio + GP, practice mode) */}
        {showSyncEditor && onSyncOffsetChange && onBpmAdjustChange && (
          <SyncOffsetEditor
            syncOffset={syncOffset}
            bpmAdjust={bpmAdjust}
            currentTime={currentTime}
            onSyncOffsetChange={onSyncOffsetChange}
            onBpmAdjustChange={onBpmAdjustChange}
          />
        )}


        {/* Mixer toggle (only with synth) */}
        {enableSynth && tracks.length > 0 && (
          <button
            onClick={() => setShowMixer((v) => !v)}
            className='px-2 py-1 text-xs font-mono rounded transition-colors'
            style={{
              backgroundColor: showMixer ? '#6366f1' : '#334155',
              color: showMixer ? '#fff' : '#94a3b8',
            }}
          >
            <SlidersHorizontal size={ICON_SIZE.LABEL} className='inline-block' /> Mixer
          </button>
        )}

        {/* SoundFont loading indicator */}
        {synthLoading && (
          <span className='text-xs font-mono text-amber-400 animate-pulse'>
            Loading SoundFont…
          </span>
        )}

      </div>        
    </div>

      {/* Mixer panel */}
      {showMixer && enableSynth && (
        <div className='bg-slate-800 rounded-lg p-3 flex flex-col gap-2'>
          {/* Master volume */}
          <div className='flex items-center gap-3'>
            <span className='text-xs font-mono w-28 truncate text-slate-300 font-bold'>
              Master
            </span>
            <input
              type='range'
              min={0}
              max={100}
              value={Math.round(masterVolume * 100)}
              onChange={(e) =>
                handleMasterVolumeChange(Number(e.target.value) / 100)
              }
              className='flex-1 h-1 accent-indigo-500'
              style={{ maxWidth: '160px' }}
              aria-label='Master volume'
            />
            <span className='text-xs font-mono text-slate-500 w-8 text-right'>
              {Math.round(masterVolume * 100)}
            </span>
          </div>
          <div className='border-t border-slate-700' />
          {trackStates.map((t) => (
            <div key={t.index} className='flex items-center gap-3'>
              {/* Track name */}
              <span
                className='text-xs font-mono w-28 truncate'
                style={{
                  color: t.index === activeTrackIndex ? '#a5b4fc' : '#94a3b8',
                }}
                title={t.name}
              >
                {t.name}
              </span>

              {/* Volume slider */}
              <input
                type='range'
                min={0}
                max={100}
                value={Math.round(t.volume * 100)}
                onChange={(e) => handleVolumeChange(t.index, Number(e.target.value) / 100)}
                className='flex-1 h-1 accent-indigo-500'
                style={{ maxWidth: '160px' }}
              />
              <span className='text-xs font-mono text-slate-500 w-8 text-right'>
                {Math.round(t.volume * 100)}
              </span>

              {/* Mute button */}
              <button
                onClick={() => handleMuteToggle(t.index)}
                className='w-7 h-7 flex items-center justify-center rounded text-xs
                           transition-colors'
                style={{
                  backgroundColor: t.muted ? '#991b1b' : '#334155',
                  color: t.muted ? '#fca5a5' : '#94a3b8',
                }}
                title={t.muted ? 'Unmute' : 'Mute'}
              >
                {t.muted ? <VolumeX key='muted' size={ICON_SIZE.ACTION} /> : <Volume2 key='unmuted' size={ICON_SIZE.ACTION} />}
              </button>

              {/* Solo button */}
              <button
                onClick={() => handleSoloToggle(t.index)}
                className='w-7 h-7 flex items-center justify-center rounded text-xs
                           font-mono font-bold transition-colors'
                style={{
                  backgroundColor: t.solo ? '#854d0e' : '#334155',
                  color: t.solo ? '#fde047' : '#94a3b8',
                }}
                title={t.solo ? 'Unsolo' : 'Solo'}
              >
                S
              </button>
            </div>
          ))}
        </div>
      )}

      {/* alphaTab render container */}
      <div
        ref={containerRef}
        className="overflow-auto bg-white rounded relative h-auto max-h-[400px]"
      />
    </div>
  );
}