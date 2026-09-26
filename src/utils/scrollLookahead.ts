// Auto-scroll with look-ahead for the songbook: bring the active section into
// view together with the start of the next section, so the reader sees where
// the current part ends and what comes next.

/** Vertical extent in viewport coordinates (as from getBoundingClientRect) */
export interface VerticalRange {
  top: number;
  bottom: number;
}

/** Space kept between content and the edge of the visible area, in px */
const SCROLL_MARGIN = 16;

/**
 * Scroll distance (positive = down) that shows `lookahead` at the bottom of the
 * view without pushing the start of `active` out at the top. If the active
 * section starts above the view (e.g. after seeking back), it is scrolled to
 * the top instead. Returns 0 if everything is already visible.
 */
export function computeScrollDelta(
  active: VerticalRange,
  lookahead: VerticalRange,
  view: VerticalRange,
  margin: number = SCROLL_MARGIN,
): number {
  const maxDown = active.top - (view.top + margin);
  if (maxDown < 0) return maxDown; // active start is above the view: scroll up to it

  const neededDown = lookahead.bottom + margin - view.bottom;
  if (neededDown <= 0) return 0;
  return Math.min(neededDown, maxDown);
}

/** Nearest ancestor that actually scrolls vertically, or the document */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

/**
 * Smoothly scroll so that `active` and `lookahead` are visible, preferring the
 * start of `active` when both do not fit.
 */
export function scrollWithLookahead(active: HTMLElement, lookahead: HTMLElement): void {
  const parent = findScrollParent(active);
  const view: VerticalRange = parent
    ? parent.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight };

  const delta = computeScrollDelta(
    active.getBoundingClientRect(),
    lookahead.getBoundingClientRect(),
    view,
  );
  if (delta === 0) return;

  (parent ?? window).scrollBy({ top: delta, behavior: 'smooth' });
}