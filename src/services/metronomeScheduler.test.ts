// Regression tests for the position-driven metronome scheduler (issue #13).
// The AudioContext and the click generator are stubbed so click placement can
// be asserted on an exact timeline instead of on real audio hardware.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startMetronome } from './metronomeScheduler';
import { buildFixedTimeline, buildTimeline } from './tempoMap';

const mocks = vi.hoisted(() => {
  const clicks: { time: number; accent: boolean }[] = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    createGain: () => ({
      gain: { value: 1 },
      connect: () => {},
      disconnect: () => {},
    }),
  };
  return { clicks, ctx };
});

vi.mock('./clickSoundGenerator', () => ({
  getAudioContext: () => mocks.ctx,
  ensureAudioReady: () => {},
  scheduleClick: (_ctx: unknown, time: number, accent: boolean) => {
    mocks.clicks.push({ time, accent });
    return {
      osc: { stop: () => {}, disconnect: () => {} },
      gain: { disconnect: () => {} },
    };
  },
}));

type ScoreArg = Parameters<typeof buildTimeline>[0];

/** Build a masterBars stub; bar starts are derived from the given lengths. */
function makeScore(
  tempo: number,
  bars: { num: number; den: number; ticks: number; bpm?: number }[],
): ScoreArg {
  let start = 0;
  const masterBars = bars.map((b) => {
    const mb = {
      start,
      timeSignatureNumerator: b.num,
      timeSignatureDenominator: b.den,
      tempoAutomation: b.bpm ? { value: b.bpm } : null,
    };
    start += b.ticks;
    return mb;
  });
  return { tempo, masterBars } as unknown as ScoreArg;
}

/** Advance the fake audio clock and the lookahead interval together. */
function advance(seconds: number): void {
  const stepMs = 25;
  const steps = Math.round((seconds * 1000) / stepMs);
  for (let i = 0; i < steps; i++) {
    mocks.ctx.currentTime = Number((mocks.ctx.currentTime + stepMs / 1000).toFixed(6));
    vi.advanceTimersByTime(stepMs);
  }
}

const clickTimes = () => mocks.clicks.map((c) => Number(c.time.toFixed(3)));
const accents = () => mocks.clicks.map((c) => c.accent);

describe('metronomeScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.clicks.length = 0;
    mocks.ctx.currentTime = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('places the downbeat on the anchor when starting from the top', () => {
    // 120 bpm, 4/4: beat = 0.5s
    const handle = startMetronome({ timeline: buildFixedTimeline(120, [4, 4]) });
    handle.sync(0);
    advance(1.6);
    handle.stop();

    expect(clickTimes()).toEqual([0, 0.5, 1, 1.5]);
    expect(accents()).toEqual([true, false, false, false]);
  });

  it('stays silent until the first sync call', () => {
    const handle = startMetronome({ timeline: buildFixedTimeline(120, [4, 4]) });
    advance(1);
    expect(mocks.clicks).toHaveLength(0);

    handle.sync(0);
    advance(0.6);
    handle.stop();
    expect(clickTimes()).toEqual([1, 1.5]);
  });

  it('keeps the accent on the downbeat when resuming mid-beat', () => {
    // Paused at song time 1.2s, i.e. 40% into beat 3 of bar 1
    mocks.ctx.currentTime = 10;
    const handle = startMetronome({ timeline: buildFixedTimeline(120, [4, 4]) });
    handle.sync(1.2);
    advance(1.35);
    handle.stop();

    // Next beat is song 1.5 (bar 1 beat 4), the accent follows at song 2.0
    expect(clickTimes()).toEqual([10.3, 10.8, 11.3]);
    expect(accents()).toEqual([false, true, false]);
  });

  it('re-anchors hard on a seek and drops pending clicks', () => {
    const handle = startMetronome({ timeline: buildFixedTimeline(120, [4, 4]) });
    handle.sync(0);
    advance(0.8);
    expect(clickTimes()).toEqual([0, 0.5]);

    // Seek to song time 4.0 (a downbeat) while the audio clock reads 0.8
    handle.sync(4);
    advance(0.6);
    handle.stop();

    expect(clickTimes()).toEqual([0, 0.5, 0.8, 1.3]);
    expect(accents()).toEqual([true, false, true, false]);
  });

  it('ignores position jitter below the drift threshold', () => {
    const handle = startMetronome({ timeline: buildFixedTimeline(120, [4, 4]) });
    handle.sync(0);
    advance(0.25);
    handle.sync(0.255); // 5ms off, must not shift the grid
    advance(0.85);
    handle.stop();

    expect(clickTimes()).toEqual([0, 0.5, 1]);
  });

  it('honours a pickup bar by delaying the first accent', () => {
    // 1 quarter pickup at 120 bpm, then full 4/4 bars
    const timeline = buildTimeline(
      makeScore(120, [
        { num: 4, den: 4, ticks: 960 },
        { num: 4, den: 4, ticks: 3840 },
      ]),
    );
    const handle = startMetronome({ timeline });
    handle.sync(0);
    advance(1.1);
    handle.stop();

    expect(clickTimes()).toEqual([0, 0.5, 1]);
    expect(accents()).toEqual([false, true, false]);
  });

  it('follows a tempo change from the timeline', () => {
    const timeline = buildTimeline(
      makeScore(120, [
        { num: 4, den: 4, ticks: 3840 },
        { num: 4, den: 4, ticks: 3840, bpm: 60 },
      ]),
    );
    const changes: [number, number][] = [];
    const handle = startMetronome({
      timeline,
      onTempoChange: (bpm, beats) => changes.push([bpm, beats]),
    });
    handle.sync(0);
    advance(4.1);
    handle.stop();

    // Bar 1 at 120 bpm (0.5s), bar 2 at 60 bpm (1.0s)
    expect(clickTimes()).toEqual([0, 0.5, 1, 1.5, 2, 3, 4]);
    expect(accents()).toEqual([true, false, false, false, true, false, false]);
    expect(changes).toEqual([[120, 4], [60, 4]]);
  });

  it('follows a time signature change and moves the accent accordingly', () => {
    const timeline = buildTimeline(
      makeScore(120, [
        { num: 4, den: 4, ticks: 3840 },
        { num: 3, den: 4, ticks: 2880 },
        { num: 3, den: 4, ticks: 2880 },
      ]),
    );
    const handle = startMetronome({ timeline });
    handle.sync(0);
    advance(3.6);
    handle.stop();

    expect(clickTimes()).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    expect(accents()).toEqual([true, false, false, false, true, false, false, true]);
  });

  it('uses the denominator for the beat length in compound meters', () => {
    // 6/8 at 120 quarter bpm: eighth = 0.25s, bar = 1.5s
    const timeline = buildTimeline(
      makeScore(120, [
        { num: 6, den: 8, ticks: 2880 },
        { num: 6, den: 8, ticks: 2880 },
      ]),
    );
    const handle = startMetronome({ timeline });
    handle.sync(0);
    advance(1.8);
    handle.stop();

    expect(clickTimes()).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]);
    expect(accents()).toEqual([true, false, false, false, false, false, true, false]);
  });

  it('stretches beats in real time when the playback rate drops', () => {
    const handle = startMetronome({ timeline: buildFixedTimeline(120, [4, 4]) });
    handle.sync(0);
    advance(0.05);
    handle.setPlaybackRate(0.5);
    advance(2.1);
    handle.stop();

    // Rate drops at 0.05s, so the following beats sit 1.0s apart in real time
    expect(clickTimes()).toEqual([0, 0.95, 1.95]);
  });

  it('schedules nothing for an empty timeline', () => {
    const handle = startMetronome({ timeline: [] });
    handle.sync(0);
    advance(2);
    handle.stop();

    expect(mocks.clicks).toHaveLength(0);
  });

  it('auto-starts without a position source in solo mode', () => {
    const handle = startMetronome({ timeline: buildFixedTimeline(120, [4, 4]), autoStart: true });
    advance(1.1);
    handle.stop();

    // START_DELAY of 50ms before the first click
    expect(clickTimes()).toEqual([0.05, 0.55, 1.05]);
  });
});