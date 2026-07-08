// Characterization tests for the consolidated tempo-map service.
// Pins the tick <-> time math that was previously duplicated.
import { describe, it, expect } from 'vitest';
import { buildTempoSegments, elapsedMsToTick, tickToElapsedMs, tickToSeconds } from './tempoMap';
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
});
