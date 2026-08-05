// Characterization tests for the consolidated tempo-map service.
// Pins the tick <-> time math that was previously duplicated.
import { describe, it, expect } from 'vitest';
import {
  barAt,
  beatAccentIndex,
  beatPositionAtOrAfter,
  beatTime,
  buildFixedTimeline,
  buildTempoSegments,
  buildTimeline,
  elapsedMsToTick,
  nextBeatPosition,
  tickToElapsedMs,
  tickToSeconds,
  withBpmAdjust,
} from './tempoMap';
import type { TempoSegment } from '../types';

type ScoreArg = Parameters<typeof buildTempoSegments>[0];

describe('tempoMap', () => {
  describe('buildTempoSegments', () => {
    it('collects only bars with explicit tempo automation', () => {
      const score = {
        tempo: 120,
        masterBars: [
          { start: 0, tempoAutomation: { value: 120 } },
          { start: 3840 },
          { start: 7680, tempoAutomation: { value: 90 } },
        ],
      } as unknown as ScoreArg;
      expect(buildTempoSegments(score)).toEqual([
        { startTick: 0, bpm: 120 },
        { startTick: 7680, bpm: 90 },
      ]);
    });

    it('falls back to the score tempo when no automation exists', () => {
      const score = {
        tempo: 100,
        masterBars: [{ start: 0 }, { start: 3840 }],
      } as unknown as ScoreArg;
      expect(buildTempoSegments(score)).toEqual([{ startTick: 0, bpm: 100 }]);
    });

    it('returns an empty map for a null score', () => {
      expect(buildTempoSegments(null)).toEqual([]);
    });
  });

  describe('tick <-> time conversion', () => {
    // 120 bpm: 960 ticks = 1 beat = 500ms; first segment spans 0..3840 = 2000ms.
    // 60 bpm:  960 ticks = 1 beat = 1000ms.
    const map: TempoSegment[] = [
      { startTick: 0, bpm: 120 },
      { startTick: 3840, bpm: 60 },
    ];

    it('converts a tick within the first segment', () => {
      expect(tickToElapsedMs(960, map)).toBeCloseTo(500);
    });

    it('converts a tick spanning into the second segment', () => {
      expect(tickToElapsedMs(4800, map)).toBeCloseTo(3000);
    });

    it('round-trips tick -> ms -> tick', () => {
      const tick = 4800;
      expect(elapsedMsToTick(tickToElapsedMs(tick, map), map)).toBe(tick);
    });

    it('returns seconds via tickToSeconds', () => {
      expect(tickToSeconds(960, map)).toBeCloseTo(0.5);
    });
  });

  describe('buildTimeline', () => {
    /** Build a masterBars stub. Bar starts are derived from the given lengths. */
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

    it('derives bar times from tempo and time signature', () => {
      const score = makeScore(120, [
        { num: 4, den: 4, ticks: 3840 },
        { num: 4, den: 4, ticks: 3840 },
      ]);
      const timeline = buildTimeline(score);

      expect(timeline).toHaveLength(2);
      expect(timeline[0].secondsPerBeat).toBeCloseTo(0.5);
      expect(timeline[0].beatCount).toBe(4);
      expect(timeline[1].startTime).toBeCloseTo(2);
    });

    it('uses the denominator for the beat length in compound meters', () => {
      // 6/8 at 120 quarter-note bpm: one eighth = 0.25s, bar = 1.5s
      const score = makeScore(120, [
        { num: 6, den: 8, ticks: 2880 },
        { num: 6, den: 8, ticks: 2880 },
      ]);
      const timeline = buildTimeline(score);

      expect(timeline[0].secondsPerBeat).toBeCloseTo(0.25);
      expect(timeline[0].beatCount).toBe(6);
      expect(timeline[1].startTime).toBeCloseTo(1.5);
    });

    it('inherits tempo until an automation changes it', () => {
      const score = makeScore(120, [
        { num: 4, den: 4, ticks: 3840 },
        { num: 4, den: 4, ticks: 3840 },
        { num: 4, den: 4, ticks: 3840, bpm: 60 },
      ]);
      const timeline = buildTimeline(score);

      expect(timeline.map((b) => b.bpm)).toEqual([120, 120, 60]);
      expect(timeline[2].startTime).toBeCloseTo(4);
      expect(timeline[2].secondsPerBeat).toBeCloseTo(1);
    });

    it('detects a pickup bar and offsets its accent index', () => {
      // 1 quarter pickup, then full 4/4 bars
      const score = makeScore(120, [
        { num: 4, den: 4, ticks: 960 },
        { num: 4, den: 4, ticks: 3840 },
      ]);
      const timeline = buildTimeline(score);

      expect(timeline[0].beatCount).toBe(1);
      expect(timeline[0].firstBeatIndex).toBe(3);
      expect(beatAccentIndex(timeline, { barIndex: 0, beatInBar: 0 })).toBe(3);
      expect(beatAccentIndex(timeline, { barIndex: 1, beatInBar: 0 })).toBe(0);
      expect(timeline[1].startTime).toBeCloseTo(0.5);
    });

    it('handles a time signature change mid-song', () => {
      const score = makeScore(120, [
        { num: 4, den: 4, ticks: 3840 },
        { num: 3, den: 4, ticks: 2880 },
      ]);
      const timeline = buildTimeline(score);

      expect(timeline[1].beatsPerBar).toBe(3);
      expect(timeline[1].beatCount).toBe(3);
      expect(timeline[1].startTime).toBeCloseTo(2);
    });

    it('returns an empty timeline for a null score', () => {
      expect(buildTimeline(null)).toEqual([]);
    });
  });

  describe('timeline navigation', () => {
    // 120 bpm, 4/4: beat = 0.5s, bar = 2s
    const fixed = buildFixedTimeline(120, [4, 4]);

    it('resolves the first beat for times at or before the start', () => {
      expect(beatPositionAtOrAfter(fixed, -1.3)).toEqual({ barIndex: 0, beatInBar: 0 });
      expect(beatPositionAtOrAfter(fixed, 0)).toEqual({ barIndex: 0, beatInBar: 0 });
    });

    it('rounds a mid-beat time up to the next beat', () => {
      expect(beatPositionAtOrAfter(fixed, 0.7)).toEqual({ barIndex: 0, beatInBar: 2 });
      expect(beatPositionAtOrAfter(fixed, 1.0)).toEqual({ barIndex: 0, beatInBar: 2 });
    });

    it('rolls over into the next bar', () => {
      expect(beatPositionAtOrAfter(fixed, 1.6)).toEqual({ barIndex: 1, beatInBar: 0 });
    });

    it('extrapolates bars beyond the timeline', () => {
      const pos = beatPositionAtOrAfter(fixed, 10.2);
      expect(pos).toEqual({ barIndex: 5, beatInBar: 1 });
      expect(beatTime(fixed, pos!)).toBeCloseTo(10.5);
      expect(barAt(fixed, 5).bpm).toBe(120);
    });

    it('advances beat by beat across bar boundaries', () => {
      let pos = { barIndex: 0, beatInBar: 3 };
      pos = nextBeatPosition(fixed, pos);
      expect(pos).toEqual({ barIndex: 1, beatInBar: 0 });
      expect(beatAccentIndex(fixed, pos)).toBe(0);
      expect(beatTime(fixed, pos)).toBeCloseTo(2);
    });

    it('keeps beat times consistent across a tempo change', () => {
      const timeline = buildFixedTimeline(60, [4, 4]);
      expect(beatTime(timeline, { barIndex: 2, beatInBar: 1 })).toBeCloseTo(9);
    });

    it('returns null for an empty timeline', () => {
      expect(beatPositionAtOrAfter([], 1)).toBeNull();
    });
  });

  describe('withBpmAdjust', () => {
    it('shifts every bar tempo and recomputes bar times', () => {
      const timeline = buildFixedTimeline(120, [4, 4]);
      const adjusted = withBpmAdjust(timeline, -60);

      expect(adjusted[0].bpm).toBe(60);
      expect(adjusted[0].secondsPerBeat).toBeCloseTo(1);
      expect(beatTime(adjusted, { barIndex: 1, beatInBar: 0 })).toBeCloseTo(4);
    });

    it('returns the original timeline when the adjustment is zero', () => {
      const timeline = buildFixedTimeline(120, [4, 4]);
      expect(withBpmAdjust(timeline, 0)).toBe(timeline);
    });
  });
});