// Turns the labeled songbook sections into section markers. The songbook has
// no timing, so start times are estimated from the text length of each
// section; the user then drags the markers to their exact position.

import type { SheetSection } from './chordSheetParser';
import { SECTION_COLORS } from './sectionColors';
import { mapSectionType, type ImportedMark } from './sectionImport';

/** Sections that become markers: labeled song parts, no tab/grid blocks */
function isImportable(section: SheetSection): section is SheetSection & { label: string } {
  return section.label !== null && section.kind !== 'tab' && section.kind !== 'grid';
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Number of text lines that take playing time (empty lines excluded) */
function lineCount(section: SheetSection): number {
  return section.lines.filter((line) => line.type !== 'empty').length;
}

/**
 * Relative length of each section. An empty section (a {chorus} reference or
 * a bare "[Chorus]" header) takes the length of the first section with the
 * same label that has content. Every section weighs at least one line.
 */
function sectionWeights(sections: (SheetSection & { label: string })[]): number[] {
  const contentLines = new Map<string, number>();
  for (const section of sections) {
    const key = normalizeLabel(section.label);
    const count = lineCount(section);
    if (count > 0 && !contentLines.has(key)) contentLines.set(key, count);
  }
  return sections.map((section) => {
    const own = lineCount(section);
    const borrowed = contentLines.get(normalizeLabel(section.label)) ?? 0;
    return Math.max(own || borrowed, 1);
  });
}

/**
 * Labels with occurrence numbers: a label that appears several times is
 * numbered in song order ("Chorus 1", "Chorus 2", ...). Labels that appear
 * once or already end with a number stay unchanged.
 */
function numberedLabels(sections: (SheetSection & { label: string })[]): string[] {
  const totals = new Map<string, number>();
  for (const section of sections) {
    const key = normalizeLabel(section.label);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  return sections.map((section) => {
    const label = section.label.trim();
    const key = normalizeLabel(label);
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    const isRepeated = (totals.get(key) ?? 0) > 1;
    return isRepeated && !/\d$/.test(label) ? `${label} ${occurrence}` : label;
  });
}

/**
 * Convert songbook sections into marks for the marker import.
 * Start times are distributed across the song duration in proportion to the
 * text length of each section, beginning at 0.
 */
export function songbookSectionsToMarks(sections: SheetSection[], duration: number): ImportedMark[] {
  const importable = sections.filter(isImportable);
  if (importable.length === 0) return [];

  const weights = sectionWeights(importable);
  const labels = numberedLabels(importable);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const length = Math.max(duration, 0);

  let elapsed = 0;
  return importable.map((section, i) => {
    const timeSeconds = Math.round((length * elapsed) / total * 100) / 100;
    elapsed += weights[i];
    // The label decides the type; the section kind helps for labels like "Refrain"
    const byLabel = mapSectionType(section.label);
    const type = byLabel === 'custom' && section.kind ? mapSectionType(section.kind) : byLabel;
    return { name: labels[i], type, color: SECTION_COLORS[type], timeSeconds };
  });
}