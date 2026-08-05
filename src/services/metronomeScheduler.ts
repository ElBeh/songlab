// Position-driven metronome scheduler.
//
// Beat times come from the musical timeline (services/tempoMap). The scheduler
// only maps song time to AudioContext time through an anchor that is
// continuously re-synced against the real playback position. That keeps the
// click locked to the music instead of free-running on its own clock, and makes
// tempo and time signature changes fall out of the timeline automatically.

import { getAudioContext, scheduleClick } from './clickSoundGenerator';
import {
  barAt,
  beatAccentIndex,
  beatPositionAtOrAfter,
  beatTime,
  nextBeatPosition,
} from './tempoMap';
import type { BeatPosition, TimelineBar } from '../types';

const LOOKAHEAD_MS = 25;      // polling interval (ms)
const SCHEDULE_AHEAD = 0.1;   // schedule clicks this far ahead (seconds)
const DRIFT_IGNORE = 0.015;   // ignore anchor updates below this drift (seconds)
const HARD_RESYNC = 0.05;     // drift at or above this counts as a seek (seconds)
const LATE_TOLERANCE = 0.03;  // a beat this far in the past still fires, immediately
const START_DELAY = 0.05;     // delay before the first click in free-running mode
const NODE_KEEP = 0.1;        // keep finished nodes this long before pruning

export interface MetronomeHandle {
  /** Stop the metronome and clean up all scheduled nodes */
  stop: () => void;
  /**
   * Report the current playback position in song seconds (relative to bar 1
   * beat 1). Small deviations are ignored, larger ones re-anchor the click grid.
   */
  sync: (songTime: number) => void;
  /** Replace the musical timeline (solo tempo change, new score) */
  setTimeline: (timeline: TimelineBar[]) => void;
  /** Update the playback rate multiplier */
  setPlaybackRate: (rate: number) => void;
  /** Update metronome volume (0-1) */
  setVolume: (volume: number) => void;
}

interface MetronomeOptions {
  /** Musical timeline; bars carry tempo, time signature and song time */
  timeline: TimelineBar[];
  /** Playback rate multiplier (song time to real time) */
  playbackRate?: number;
  audible?: boolean;
  volume?: number;
  /**
   * Start immediately at song time 0 without waiting for a position update.
   * Used in solo mode where no playback position exists.
   */
  autoStart?: boolean;
  /** Called when the effective tempo or time signature changes */
  onTempoChange?: (bpm: number, beatsPerBar: number) => void;
  /** Called on each beat (1-based accent index, for visual indicators) */
  onBeat?: (beat: number) => void;
}

interface ScheduledNode {
  osc: OscillatorNode;
  gain: GainNode;
  time: number;
}

/**
 * Start a position-driven metronome.
 *
 * Unless autoStart is set the metronome stays silent until the first sync()
 * call, so it cannot run ahead of a player that is still starting up
 * (alphaSynth soundfont priming, media element latency).
 */
export function startMetronome(opts: MetronomeOptions): MetronomeHandle {
  const {
    timeline: initialTimeline,
    playbackRate = 1,
    audible = true,
    volume = 1,
    autoStart = false,
    onTempoChange,
    onBeat,
  } = opts;

  const ctx = getAudioContext();

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  let timeline = initialTimeline;
  let rate = playbackRate > 0 ? playbackRate : 1;

  let anchorSongTime = 0;
  let anchorAudioTime = 0;
  let anchored = false;

  let position: BeatPosition | null = null;
  let reportedBpm: number | null = null;
  let reportedBeatsPerBar: number | null = null;

  let stopped = false;
  const nodes: ScheduledNode[] = [];
  const timeouts = new Set<number>();

  /** Song seconds to AudioContext seconds */
  function toAudioTime(songTime: number): number {
    return anchorAudioTime + (songTime - anchorSongTime) / rate;
  }

  /** AudioContext seconds to song seconds */
  function toSongTime(audioTime: number): number {
    return anchorSongTime + (audioTime - anchorAudioTime) * rate;
  }

  /** Drop everything that has not been heard yet (seek, rate change) */
  function cancelPending(): void {
    const now = ctx.currentTime;
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].time <= now) continue;
      const { osc, gain } = nodes[i];
      try { osc.stop(); } catch { /* already stopped */ }
      osc.disconnect();
      gain.disconnect();
      nodes.splice(i, 1);
    }
    for (const id of timeouts) window.clearTimeout(id);
    timeouts.clear();
  }

  /** Re-anchor the click grid to a known playback position */
  function anchorAt(songTime: number, audioTime: number, hard: boolean): void {
    if (hard) cancelPending();

    anchorSongTime = songTime;
    anchorAudioTime = audioTime;
    anchored = true;

    // A soft update only shifts the grid; the pending beat stays valid.
    // A hard re-anchor has dropped everything pending, so recompute from scratch.
    if (!hard && position) return;
    position = beatPositionAtOrAfter(timeline, songTime);
  }

  function pruneNodes(now: number): void {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].time + NODE_KEEP < now) nodes.splice(i, 1);
    }
  }

  function scheduleBeatCallback(beat: number, bpm: number, beatsPerBar: number, delayMs: number): void {
    const id = window.setTimeout(() => {
      timeouts.delete(id);
      if (stopped) return;
      if (bpm !== reportedBpm || beatsPerBar !== reportedBeatsPerBar) {
        reportedBpm = bpm;
        reportedBeatsPerBar = beatsPerBar;
        onTempoChange?.(bpm, beatsPerBar);
      }
      onBeat?.(beat);
    }, delayMs);
    timeouts.add(id);
  }

  function schedulePending(): void {
    if (stopped || !anchored || timeline.length === 0 || !position) return;

    const now = ctx.currentTime;
    pruneNodes(now);

    while (position) {
      const time = toAudioTime(beatTime(timeline, position));
      if (time >= now + SCHEDULE_AHEAD) break;

      // Beats far in the past are dropped; a slightly late one still fires so
      // the downbeat is not lost when playback starts exactly on a beat.
      if (time > now - LATE_TOLERANCE) {
        const playTime = Math.max(time, now);
        const bar = barAt(timeline, position.barIndex);
        const accentIndex = beatAccentIndex(timeline, position);

        if (audible) {
          const { osc, gain } = scheduleClick(ctx, playTime, accentIndex === 0, masterGain);
          nodes.push({ osc, gain, time: playTime });
        }

        if (onBeat || onTempoChange) {
          scheduleBeatCallback(accentIndex + 1, bar.bpm, bar.beatsPerBar, (playTime - now) * 1000);
        }
      }

      position = nextBeatPosition(timeline, position);
    }
  }

  if (autoStart) {
    anchorAt(0, ctx.currentTime + START_DELAY, true);
  }

  const intervalId = window.setInterval(schedulePending, LOOKAHEAD_MS);
  schedulePending();

  return {
    stop: () => {
      stopped = true;
      window.clearInterval(intervalId);
      for (const id of timeouts) window.clearTimeout(id);
      timeouts.clear();
      for (const { osc, gain } of nodes) {
        try { osc.stop(); } catch { /* already stopped */ }
        osc.disconnect();
        gain.disconnect();
      }
      nodes.length = 0;
      masterGain.disconnect();
    },

    sync: (songTime: number) => {
      if (stopped) return;
      const now = ctx.currentTime;

      if (!anchored) {
        anchorAt(songTime, now, true);
        schedulePending();
        return;
      }

      const drift = songTime - toSongTime(now);
      if (Math.abs(drift) < DRIFT_IGNORE) return;

      anchorAt(songTime, now, Math.abs(drift) >= HARD_RESYNC);
      schedulePending();
    },

    setTimeline: (next: TimelineBar[]) => {
      if (stopped || next === timeline) return;
      const now = ctx.currentTime;
      const songNow = anchored ? toSongTime(now) : 0;
      timeline = next;
      if (anchored) anchorAt(songNow, now, true);
    },

    setPlaybackRate: (next: number) => {
      if (stopped || next <= 0 || next === rate) return;
      const now = ctx.currentTime;
      const songNow = anchored ? toSongTime(now) : 0;
      rate = next;
      if (anchored) anchorAt(songNow, now, true);
    },

    setVolume: (v: number) => {
      masterGain.gain.value = v;
    },
  };
}