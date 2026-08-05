// Single owner for tempo-map handling derived from Guitar Pro scores.
// Previously this logic was duplicated across useExternalMediaSync.ts and
// gpMarkerImport.ts; both now delegate here.
import type * as alphaTab from '@coderline/alphatab';
import type { BeatPosition, TempoSegment, TimelineBar } from '../types';

const TICKS_PER_BEAT = 960;
/** Ticks of a whole note (4 quarter notes at 960 ticks each) */
const TICKS_PER_WHOLE = 3840;
/** Tolerance when matching a time to a beat boundary (seconds) */
const BEAT_EPSILON = 0.001;

/**
 * Build a tempo map from an alphaTab score.
 * Only bars with explicit tempoAutomation start a new segment; all other
 * bars inherit the previous tempo. Falls back to the score tempo when no
 * automation exists.
 */
export function buildTempoSegments(score: alphaTab.model.Score | null | undefined): TempoSegment[] {
  if (!score) return [];

  const segments: TempoSegment[] = [];
  for (const mb of score.masterBars) {
    if (mb.tempoAutomation) {
      segments.push({ startTick: mb.start, bpm: mb.tempoAutomation.value });
    }
  }

  if (segments.length === 0) {
    segments.push({ startTick: 0, bpm: score.tempo });
  }

  return segments;
}

/**
 * Convert elapsed time (ms since bar 1 beat 1) to an alphaTab tick.
 * Walks the segments accumulating ticks until the elapsed time is located.
 */
export function elapsedMsToTick(elapsedMs: number, tempoMap: TempoSegment[]): number {
  if (tempoMap.length === 0 || elapsedMs <= 0) return 0;

  let remaining = elapsedMs;

  for (let i = 0; i < tempoMap.length; i++) {
    const seg = tempoMap[i];
    const msPerTick = 60000 / (seg.bpm * TICKS_PER_BEAT);

    if (i < tempoMap.length - 1) {
      const nextSeg = tempoMap[i + 1];
      const segmentTicks = nextSeg.startTick - seg.startTick;
      const segmentMs = segmentTicks * msPerTick;

      if (remaining <= segmentMs) {
        return Math.round(seg.startTick + remaining / msPerTick);
      }
      remaining -= segmentMs;
    } else {
      // Last segment: extrapolate
      return Math.round(seg.startTick + remaining / msPerTick);
    }
  }

  return 0;
}

/**
 * Convert an alphaTab tick to elapsed time in ms (inverse of elapsedMsToTick).
 */
export function tickToElapsedMs(tick: number, tempoMap: TempoSegment[]): number {
  if (tempoMap.length === 0 || tick <= 0) return 0;

  let elapsedMs = 0;

  for (let i = 0; i < tempoMap.length; i++) {
    const seg = tempoMap[i];
    const msPerTick = 60000 / (seg.bpm * TICKS_PER_BEAT);

    if (i < tempoMap.length - 1) {
      const nextSeg = tempoMap[i + 1];
      if (tick < nextSeg.startTick) {
        elapsedMs += (tick - seg.startTick) * msPerTick;
        return elapsedMs;
      }
      elapsedMs += (nextSeg.startTick - seg.startTick) * msPerTick;
    } else {
      elapsedMs += (tick - seg.startTick) * msPerTick;
      return elapsedMs;
    }
  }

  return elapsedMs;
}

/** Convenience wrapper: tick to elapsed time in seconds. */
export function tickToSeconds(tick: number, tempoMap: TempoSegment[]): number {
  return tickToElapsedMs(tick, tempoMap) / 1000;
}

// ---------------------------------------------------------------------------
// Musical timeline
//
// The timeline is the single source of truth for the metronome. Every bar
// carries its own tempo, time signature and absolute song time, so beat
// positions can be derived from a playback position instead of being
// dead-reckoned by a free-running scheduler.
// ---------------------------------------------------------------------------

/** Ticks of one beat for a given time signature denominator. */
function ticksPerBeat(denominator: number): number {
  return TICKS_PER_WHOLE / denominator;
}

/** Duration of one beat in seconds. bpm is always quarter notes per minute. */
function secondsPerBeat(bpm: number, denominator: number): number {
  return (60 / bpm) * (4 / denominator);
}

/** Fill startTime and secondsPerBeat by accumulating bar durations. */
function withBarTimes(bars: TimelineBar[]): TimelineBar[] {
  let time = 0;
  return bars.map((bar) => {
    const spb = secondsPerBeat(bar.bpm, bar.denominator);
    const withTime: TimelineBar = { ...bar, startTime: time, secondsPerBeat: spb };
    time += bar.beatCount * spb;
    return withTime;
  });
}

/**
 * Build the musical timeline from an alphaTab score.
 *
 * Bar length is derived from the distance to the next bar's start tick, which
 * makes pickup bars (anacrusis) and irregular bars fall out automatically.
 * Tempo is inherited from the previous bar unless the bar carries an explicit
 * tempo automation. Mid-bar tempo automations are not resolved; they are
 * applied from the containing bar's start.
 */
export function buildTimeline(score: alphaTab.model.Score | null | undefined): TimelineBar[] {
  if (!score || score.masterBars.length === 0) return [];

  const masterBars = score.masterBars;
  const bars: TimelineBar[] = [];
  let bpm = score.tempo > 0 ? score.tempo : 120;

  for (let i = 0; i < masterBars.length; i++) {
    const mb = masterBars[i];
    if (mb.tempoAutomation && mb.tempoAutomation.value > 0) {
      bpm = mb.tempoAutomation.value;
    }

    const denominator = mb.timeSignatureDenominator > 0 ? mb.timeSignatureDenominator : 4;
    const beatsPerBar = mb.timeSignatureNumerator > 0 ? mb.timeSignatureNumerator : 4;
    const tpb = ticksPerBeat(denominator);

    const next = masterBars[i + 1];
    const spanTicks = next ? next.start - mb.start : beatsPerBar * tpb;
    const beatCount = spanTicks > 0 ? Math.max(1, Math.round(spanTicks / tpb)) : beatsPerBar;

    bars.push({
      index: i,
      startTick: mb.start,
      startTime: 0,
      bpm,
      beatsPerBar,
      denominator,
      secondsPerBeat: 0,
      beatCount,
      firstBeatIndex: beatCount < beatsPerBar ? beatsPerBar - beatCount : 0,
    });
  }

  return withBarTimes(bars);
}

/**
 * Build a timeline for songs without a score: a single bar that is
 * extrapolated indefinitely by barAt().
 */
export function buildFixedTimeline(
  bpm: number | null,
  timeSignature: [number, number] | null,
): TimelineBar[] {
  if (bpm === null || bpm <= 0) return [];

  const beatsPerBar = timeSignature && timeSignature[0] > 0 ? timeSignature[0] : 4;
  const denominator = timeSignature && timeSignature[1] > 0 ? timeSignature[1] : 4;

  return withBarTimes([
    {
      index: 0,
      startTick: 0,
      startTime: 0,
      bpm,
      beatsPerBar,
      denominator,
      secondsPerBeat: 0,
      beatCount: beatsPerBar,
      firstBeatIndex: 0,
    },
  ]);
}

/**
 * Apply an additive BPM correction to every bar and recompute all bar times.
 * Used in Audio + GP mode where the GP tempo is nudged to match the recording.
 */
export function withBpmAdjust(timeline: TimelineBar[], adjust: number): TimelineBar[] {
  if (adjust === 0 || timeline.length === 0) return timeline;
  return withBarTimes(
    timeline.map((bar) => ({ ...bar, bpm: Math.max(1, bar.bpm + adjust) })),
  );
}

/**
 * Resolve a bar by index. Indexes beyond the timeline are extrapolated as
 * full bars using the last bar's tempo and time signature, so the metronome
 * keeps running past the end of the score.
 */
export function barAt(timeline: TimelineBar[], barIndex: number): TimelineBar {
  if (barIndex < timeline.length) return timeline[barIndex];

  const last = timeline[timeline.length - 1];
  const lastEndTime = last.startTime + last.beatCount * last.secondsPerBeat;
  const lastEndTick = last.startTick + last.beatCount * ticksPerBeat(last.denominator);
  const fullBarTime = last.beatsPerBar * last.secondsPerBeat;
  const fullBarTicks = last.beatsPerBar * ticksPerBeat(last.denominator);
  const offset = barIndex - timeline.length;

  return {
    ...last,
    index: barIndex,
    startTick: lastEndTick + offset * fullBarTicks,
    startTime: lastEndTime + offset * fullBarTime,
    beatCount: last.beatsPerBar,
    firstBeatIndex: 0,
  };
}

/** Song time in seconds of a beat position. */
export function beatTime(timeline: TimelineBar[], pos: BeatPosition): number {
  const bar = barAt(timeline, pos.barIndex);
  return bar.startTime + pos.beatInBar * bar.secondsPerBeat;
}

/** Accent index of a beat position (0 = downbeat). */
export function beatAccentIndex(timeline: TimelineBar[], pos: BeatPosition): number {
  const bar = barAt(timeline, pos.barIndex);
  return (bar.firstBeatIndex + pos.beatInBar) % bar.beatsPerBar;
}

/** The beat following the given position. */
export function nextBeatPosition(timeline: TimelineBar[], pos: BeatPosition): BeatPosition {
  const bar = barAt(timeline, pos.barIndex);
  if (pos.beatInBar + 1 < bar.beatCount) {
    return { barIndex: pos.barIndex, beatInBar: pos.beatInBar + 1 };
  }
  return { barIndex: pos.barIndex + 1, beatInBar: 0 };
}

/** Index of the bar containing the given song time (binary search). */
function findBarIndex(timeline: TimelineBar[], time: number): number {
  let low = 0;
  let high = timeline.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (timeline[mid].startTime <= time) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

/**
 * First beat at or after the given song time.
 * Times before the first bar resolve to the very first beat, which lets the
 * metronome stay silent until the downbeat when a sync offset is in use.
 */
export function beatPositionAtOrAfter(
  timeline: TimelineBar[],
  time: number,
): BeatPosition | null {
  if (timeline.length === 0) return null;
  if (time <= timeline[0].startTime + BEAT_EPSILON) {
    return { barIndex: 0, beatInBar: 0 };
  }

  const lastReal = timeline[timeline.length - 1];
  const timelineEnd = lastReal.startTime + lastReal.beatCount * lastReal.secondsPerBeat;

  let barIndex: number;
  if (time >= timelineEnd) {
    // Extrapolated region: full bars repeating the last bar's configuration
    const fullBarTime = lastReal.beatsPerBar * lastReal.secondsPerBeat;
    barIndex = timeline.length + Math.floor((time - timelineEnd) / fullBarTime);
  } else {
    barIndex = findBarIndex(timeline, time);
  }

  const bar = barAt(timeline, barIndex);
  const rawBeat = (time - bar.startTime) / bar.secondsPerBeat;
  const beatInBar = Math.ceil(rawBeat - BEAT_EPSILON / bar.secondsPerBeat);

  if (beatInBar >= bar.beatCount) {
    return { barIndex: barIndex + 1, beatInBar: 0 };
  }
  return { barIndex, beatInBar: Math.max(0, beatInBar) };
}