// Continuous metronome scheduler using the Web Audio API lookahead pattern.
// Schedules clicks ~100ms ahead via a polling interval (~25ms).
// Reuses scheduleClick from clickSoundGenerator for consistent sound.
// Supports tempo maps from GP files for real-time BPM/time signature changes.

import { getAudioContext, scheduleClick } from './clickSoundGenerator';
import type { TempoMapEntry } from '../components/Tabs/NotationPanel';

const LOOKAHEAD_MS = 25;    // polling interval (ms)
const SCHEDULE_AHEAD = 0.1; // schedule clicks this far ahead (seconds)
const TICKS_PER_QUARTER = 960; // alphaTab standard

export interface MetronomeHandle {
  /** Stop the metronome and clean up all scheduled nodes */
  stop: () => void;
  /** Update tempo on the fly (only used when no tempoMap is provided) */
  setTempo: (bpm: number, beatsPerBar: number) => void;
  /** Update metronome volume (0–1) */
  setVolume: (volume: number) => void;
}

/** Find the active tempo map entry for a given tick */
function lookupTempo(map: TempoMapEntry[], tick: number): TempoMapEntry {
  let result = map[0];
  for (const entry of map) {
    if (entry.tick <= tick) {
      result = entry;
    } else {
      break;
    }
  }
  return result;
}

interface MetronomeOptions {
  bpm: number;
  beatsPerBar: number;
  audible?: boolean;
  volume?: number;
  /** Playback rate multiplier (applied to BPM from map or base) */
  playbackRate?: number;
  /** Tick-based tempo map from GP file (enables internal position tracking) */
  tempoMap?: TempoMapEntry[];
  /** Starting tick position (for tempo map lookup on resume) */
  startTick?: number;
  /** Starting beat-in-bar position (0-based, for correct accent after resume) */
  startBeatInBar?: number;
  /** Called when tempo/time signature changes (for UI updates) */
  onTempoChange?: (bpm: number, beatsPerBar: number) => void;
  /** Called on each beat (1-based, for visual indicator) */
  onBeat?: (beat: number) => void;
}

/**
 * Start a continuous metronome.
 * When a tempoMap is provided, the scheduler tracks musical position internally
 * and applies BPM/time signature changes proactively (no external tick sync needed).
 */
export function startMetronome(opts: MetronomeOptions): MetronomeHandle {
  const {
    bpm,
    beatsPerBar,
    audible = true,
    volume = 1,
    playbackRate = 1,
    tempoMap,
    startTick = 0,
    startBeatInBar = 0,
    onTempoChange,
    onBeat,
  } = opts;

  const ctx = getAudioContext();

  // Master gain node for volume control
  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  // Fixed mode (no tempo map)
  let fixedBpm = bpm;
  let fixedBeatsPerBar = beatsPerBar;

  // Tempo map mode: track musical position in ticks
  let musicalTick = startTick;
  let currentRate = playbackRate;
  let lastMapBpm = tempoMap ? lookupTempo(tempoMap, startTick).bpm : bpm;
  let lastMapBeats = tempoMap ? lookupTempo(tempoMap, startTick).beatsPerBar : beatsPerBar;

  let beatInBar = startBeatInBar;
  let nextBeatTime = ctx.currentTime + 0.05;
  let stopped = false;

  const activeNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

  function getEffectiveBpm(): number {
    if (tempoMap) {
      const entry = lookupTempo(tempoMap, musicalTick);
      // Detect tempo change
      if (entry.bpm !== lastMapBpm || entry.beatsPerBar !== lastMapBeats) {
        lastMapBpm = entry.bpm;
        lastMapBeats = entry.beatsPerBar;
        beatInBar = 0; // reset bar position on time sig change
        onTempoChange?.(entry.bpm, entry.beatsPerBar);
      }
      return entry.bpm * currentRate;
    }
    return fixedBpm * currentRate;
  }

  function getBeatsPerBar(): number {
    return tempoMap ? lastMapBeats : fixedBeatsPerBar;
  }

  function schedulePending() {
    if (stopped) return;

    while (nextBeatTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const effectiveBpm = getEffectiveBpm();
      const bpb = getBeatsPerBar();
      const isAccent = beatInBar === 0;

      if (audible) {
        const nodes = scheduleClick(ctx, nextBeatTime, isAccent, masterGain);
        activeNodes.push(nodes);

        const ref = nodes;
        const cleanupDelay = (nextBeatTime - ctx.currentTime) * 1000 + 100;
        setTimeout(() => {
          const idx = activeNodes.indexOf(ref);
          if (idx !== -1) activeNodes.splice(idx, 1);
        }, cleanupDelay);
      }

      if (onBeat) {
        const beat = beatInBar + 1;
        const delay = (nextBeatTime - ctx.currentTime) * 1000;
        setTimeout(() => {
          if (!stopped) onBeat(beat);
        }, delay);
      }

      const interval = 60 / effectiveBpm;
      nextBeatTime += interval;
      beatInBar = (beatInBar + 1) % bpb;

      // Advance musical position (tick tracking for tempo map)
      if (tempoMap) {
        musicalTick += TICKS_PER_QUARTER; // one quarter note per beat
      }
    }
  }

  const intervalId = window.setInterval(schedulePending, LOOKAHEAD_MS);
  schedulePending();

  return {
    stop: () => {
      stopped = true;
      window.clearInterval(intervalId);
      for (const { osc, gain } of activeNodes) {
        try { osc.stop(); } catch { /* already stopped */ }
        osc.disconnect();
        gain.disconnect();
      }
      activeNodes.length = 0;
      masterGain.disconnect();
    },

    setTempo: (newBpm, newBeatsPerBar) => {
      fixedBpm = newBpm;
      fixedBeatsPerBar = newBeatsPerBar;
      currentRate = playbackRate;
    },

    setVolume: (v) => {
      masterGain.gain.value = v;
    },
  };
}