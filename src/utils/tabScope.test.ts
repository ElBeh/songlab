import { describe, it, expect } from 'vitest';
import { resolveTab, songScopeId, isSongScope, tabKey } from './tabScope';
import type { SectionTab } from '../types';

function tab(markerId: string, sheetId: string, content: string): SectionTab {
  return { id: `${markerId}-${sheetId}`, songId: 'song-1', markerId, sheetId, content, updatedAt: 0 };
}

function tabMap(...list: SectionTab[]): Record<string, SectionTab> {
  return Object.fromEntries(list.map((t) => [tabKey(t.markerId, t.sheetId), t]));
}

const SONG = songScopeId('song-1');

describe('tabScope', () => {
  it('recognizes song scope ids', () => {
    expect(isSongScope(SONG)).toBe(true);
    expect(isSongScope('marker-uuid')).toBe(false);
  });

  it('uses the whole-song tab when no marker is active', () => {
    const tabs = tabMap(tab(SONG, 'sheet-1', 'song'));
    const result = resolveTab(tabs, 'song-1', null, 'sheet-1');
    expect(result).toEqual({ tab: tabs[tabKey(SONG, 'sheet-1')], scopeId: SONG, isFallback: false });
  });

  it('prefers the marker tab over the whole-song tab', () => {
    const tabs = tabMap(tab(SONG, 'sheet-1', 'song'), tab('m1', 'sheet-1', 'verse'));
    const result = resolveTab(tabs, 'song-1', 'm1', 'sheet-1');
    expect(result.tab?.content).toBe('verse');
    expect(result.scopeId).toBe('m1');
    expect(result.isFallback).toBe(false);
  });

  it('falls back to the whole-song tab when the marker has none', () => {
    const tabs = tabMap(tab(SONG, 'sheet-1', 'song'));
    const result = resolveTab(tabs, 'song-1', 'm1', 'sheet-1');
    expect(result.tab?.content).toBe('song');
    expect(result.scopeId).toBe(SONG);
    expect(result.isFallback).toBe(true);
  });

  it('targets the song scope for a new tab when nothing exists', () => {
    const result = resolveTab({}, 'song-1', 'm1', 'sheet-1');
    expect(result).toEqual({ tab: null, scopeId: SONG, isFallback: true });
  });

  it('does not mix sheets', () => {
    const tabs = tabMap(tab('m1', 'sheet-2', 'bass'));
    const result = resolveTab(tabs, 'song-1', 'm1', 'sheet-1');
    expect(result.tab).toBeNull();
  });
});