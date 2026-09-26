import { describe, it, expect } from 'vitest';
import { findSectionForMarker } from './songbookSectionMatch';
import type { SheetSection } from './chordSheetParser';
import type { SectionMarker, SectionType } from '../types';

function section(label: string | null, kind: string | null = null): SheetSection {
  return { label, kind, lines: [] };
}

function marker(label: string, type: SectionType = 'custom'): SectionMarker {
  return { id: label, songId: 's', type, label, startTime: 0, color: '#fff' };
}

describe('findSectionForMarker', () => {
  const sections = [
    section(null),
    section('Intro', 'intro'),
    section('Verse 1', 'verse'),
    section('Verse 2', 'verse'),
    section('Chorus', 'chorus'),
    section('Bridge', 'bridge'),
  ];

  it('returns -1 without a marker', () => {
    expect(findSectionForMarker(sections, null)).toBe(-1);
  });

  it('matches exact labels case-insensitively', () => {
    expect(findSectionForMarker(sections, marker('verse 2'))).toBe(3);
    expect(findSectionForMarker(sections, marker('  BRIDGE '))).toBe(5);
  });

  it('matches a numbered marker to an unnumbered section', () => {
    expect(findSectionForMarker(sections, marker('Chorus 1'))).toBe(4);
    expect(findSectionForMarker(sections, marker('Chorus 3'))).toBe(4);
  });

  it('matches an unnumbered marker to the first numbered section', () => {
    expect(findSectionForMarker(sections, marker('Verse'))).toBe(2);
  });

  it('uses the marker number among unnumbered duplicates', () => {
    const dup = [section('Verse', 'verse'), section('Chorus', 'chorus'), section('Verse', 'verse')];
    expect(findSectionForMarker(dup, marker('Verse 2'))).toBe(2);
    expect(findSectionForMarker(dup, marker('Verse 5'))).toBe(0);
  });

  it('ignores repeat hints like (x2)', () => {
    expect(findSectionForMarker([section('Chorus (x2)')], marker('Chorus'))).toBe(0);
  });

  it('falls back to marker type vs section kind', () => {
    expect(findSectionForMarker(sections, marker('Refrain', 'chorus'))).toBe(4);
  });

  it('returns -1 for unknown custom markers', () => {
    expect(findSectionForMarker(sections, marker('Solo'))).toBe(-1);
  });
});