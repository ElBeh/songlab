import { describe, it, expect } from 'vitest';
import { computeScrollDelta } from './scrollLookahead';

const VIEW = { top: 0, bottom: 800 };

describe('computeScrollDelta', () => {
  it('does not scroll when section and look-ahead are visible', () => {
    expect(computeScrollDelta({ top: 100, bottom: 400 }, { top: 420, bottom: 500 }, VIEW, 16)).toBe(0);
  });

  it('scrolls down until the look-ahead is visible with margin', () => {
    // look-ahead bottom 900 + 16 margin - 800 view bottom = 116
    expect(computeScrollDelta({ top: 300, bottom: 800 }, { top: 820, bottom: 900 }, VIEW, 16)).toBe(116);
  });

  it('never pushes the start of the active section out at the top', () => {
    // needed 1016, but the active section starts at 200 -> at most 184
    expect(computeScrollDelta({ top: 200, bottom: 1500 }, { top: 1600, bottom: 1800 }, VIEW, 16)).toBe(184);
  });

  it('scrolls up when the active section starts above the view', () => {
    expect(computeScrollDelta({ top: -300, bottom: 100 }, { top: 120, bottom: 200 }, VIEW, 16)).toBe(-316);
  });

  it('respects the offset of a scroll container', () => {
    const view = { top: 500, bottom: 900 };
    expect(computeScrollDelta({ top: 600, bottom: 850 }, { top: 870, bottom: 950 }, view, 16)).toBe(66);
  });
});