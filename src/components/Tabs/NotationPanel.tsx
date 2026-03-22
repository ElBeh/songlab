import { useRef, useEffect, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';

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
  /** Fires when the AlphaTabApi is created (and again with null on destroy).
   *  The parent hooks into this to wire useAlphaSynthPlayback. */
  onApiReady?: (api: alphaTab.AlphaTabApi | null) => void;
}

export function NotationPanel({
  gpData,
  songId,
  enableSynth = false,
  onApiReady,
}: NotationPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const layoutRef = useRef<'page' | 'horizontal'>('page');

  const [tracks, setTracks] = useState<{ index: number; name: string }[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [layout, setLayout] = useState<'page' | 'horizontal'>('page');
  const [synthLoading, setSynthLoading] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [trackStates, setTrackStates] = useState<TrackMixerState[]>([]);

  // Keep ref in sync
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Initialize alphaTab API
  useEffect(() => {
    if (!containerRef.current) return;

    const settings = new alphaTab.Settings();
    settings.core.fontDirectory = import.meta.env.BASE_URL + 'font/';
    settings.display.scale = 0.5;
    settings.display.layoutMode =
      layoutRef.current === 'page' ? alphaTab.LayoutMode.Page : alphaTab.LayoutMode.Horizontal;

    // Configure player mode upfront so alphaTab creates cursor elements
    if (enableSynth) {
      settings.player.soundFont = import.meta.env.BASE_URL + 'soundfont/sonivox.sf2';
      settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
    } else {
      settings.player.playerMode = alphaTab.PlayerMode.Disabled;
    }

    // alphaTab handles horizontal scroll; page mode scroll is manual (see effect below)
    settings.player.scrollElement = containerRef.current;
    settings.player.scrollOffsetX = -80;

    const api = new alphaTab.AlphaTabApi(containerRef.current, settings);

    api.scoreLoaded.on((score) => {
      const trackList = score.tracks.map((t, i) => ({
        index: i,
        name: t.name || `Track ${i + 1}`,
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
    });

    if (enableSynth) {
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
    onApiReady?.(api);

    return () => {
      onApiReady?.(null);
      api.destroy();
      apiRef.current = null;
    };
  // onApiReady intentionally excluded – stable callback ref from parent
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId, enableSynth]);

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

    // Re-bind scroll element after render (alphaTab loses it on re-render)
    if (layout === 'horizontal' && containerRef.current) {
      api.settings.player.scrollElement = containerRef.current;
      api.settings.player.scrollOffsetX = -80;
      api.updateSettings();
    }
  }, [layout]);

  // Manual scroll for page mode
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (layout !== 'page') return;

    const beat = () => container.querySelector('.at-cursor-beat') as HTMLElement | null;

    let rafId = 0;
    const tick = () => {
      const el = beat();
      if (el) {
        const beatRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offset = beatRect.top - containerRect.top;
        const target = container.scrollTop + offset - containerRect.height * 0.3;

        if (Math.abs(offset - containerRect.height * 0.3) > 50) {
          container.scrollTo({ top: target, behavior: 'smooth' });
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [layout]);

  // Switch track
  useEffect(() => {
    const api = apiRef.current;
    if (!api?.score) return;

    const track = api.score.tracks[activeTrackIndex];
    if (track) {
      api.renderTracks([track]);
    }
  }, [activeTrackIndex]);

  // --- Mixer controls ---

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

  return (
    <div className='flex flex-col gap-2 flex-1 min-h-64'>
      {/* Controls bar */}
      <div className='flex items-center gap-3'>
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

        {/* Layout toggle */}
        <button
          onClick={() => setLayout((l) => (l === 'page' ? 'horizontal' : 'page'))}
          className='px-2 py-1 text-xs font-mono rounded transition-colors
                     bg-slate-700 hover:bg-slate-600 text-slate-300'
        >
          {layout === 'page' ? '↔ Horizontal' : '↕ Page'}
        </button>

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
            🎛 Mixer
          </button>
        )}

        {/* SoundFont loading indicator */}
        {synthLoading && (
          <span className='text-xs font-mono text-amber-400 animate-pulse'>
            Loading SoundFont…
          </span>
        )}
      </div>

      {/* Mixer panel */}
      {showMixer && enableSynth && (
        <div className='bg-slate-800 rounded-lg p-3 flex flex-col gap-2'>
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
                {t.muted ? '🔇' : '🔊'}
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
        className='overflow-auto bg-white rounded relative'
        style={{ height: '400px' }}
      />
    </div>
  );
}