// Maps the active section marker to a songbook section by label, so the
// songbook highlights the section that is currently playing.

import type { SectionMarker } from '../types';
import type { SheetSection } from './chordSheetParser';

/** Lowercase, trimmed, single-spaced label */
function normalize(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** "Chorus 2" -> { base: "chorus", number: 2 }; "Chorus (x2)" -> { base: "chorus" } */
function splitLabel(label: string): { base: string; number: number | null } {
  const cleaned = normalize(label).replace(/\s*\(?x\d+\)?$/, '');
  const match = cleaned.match(/^(.*?)\s*(\d+)$/);
  return match && match[1]
    ? { base: match[1], number: Number(match[2]) }
    : { base: cleaned, number: null };
}

/**
 * Index of the songbook section for the given marker, or -1.
 * Order: exact label, then same base name (the marker's number picks the
 * n-th candidate if there are several, e.g. two unnumbered "Verse" blocks),
 * then the marker type against the section kind.
 * A chorus written once in the songbook thus matches "Chorus 1", "Chorus 2", ...
 */
export function findSectionForMarker(sections: SheetSection[], marker: SectionMarker | null): number {
  if (!marker) return -1;

  const label = normalize(marker.label);
  const exact = sections.findIndex((s) => s.label !== null && normalize(s.label) === label);
  if (exact !== -1) return exact;

  const { base, number } = splitLabel(marker.label);
  const sameBase = sections
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => s.label !== null && splitLabel(s.label).base === base);
  if (sameBase.length > 0) {
    const pick = number !== null && number <= sameBase.length ? number - 1 : 0;
    return sameBase[pick].index;
  }

  if (marker.type !== 'custom') {
    return sections.findIndex((s) => s.kind === marker.type);
  }
  return -1;
}