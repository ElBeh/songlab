import type { SectionTab } from '../types';

// A tab is bound to a "scope": either a section marker or the whole song.
// Whole-song tabs reuse the existing `markerId` field with a sentinel value,
// so IndexedDB, export/import and Band Sync need no schema changes.

const SONG_SCOPE_PREFIX = 'song:';

/** Scope id for the whole-song tab of a song */
export function songScopeId(songId: string): string {
  return `${SONG_SCOPE_PREFIX}${songId}`;
}

/** True if the scope id refers to a whole-song tab rather than a marker */
export function isSongScope(scopeId: string): boolean {
  return scopeId.startsWith(SONG_SCOPE_PREFIX);
}

/** Store key for a tab, shared by all lookups: `${scopeId}-${sheetId}` */
export function tabKey(scopeId: string, sheetId: string): string {
  return `${scopeId}-${sheetId}`;
}

export interface ResolvedTab {
  /** The tab to display, null if neither scope has content yet */
  tab: SectionTab | null;
  /** The scope to read from and write to (marker id or song scope id) */
  scopeId: string;
  /** True if a marker is active but the whole-song tab is shown instead */
  isFallback: boolean;
}

/**
 * Resolve which tab to show for the active marker and sheet.
 * Order: the marker's own tab, then the whole-song tab.
 * Without an active marker the whole-song tab is used directly.
 */
export function resolveTab(
  tabs: Record<string, SectionTab>,
  songId: string,
  markerId: string | null,
  sheetId: string,
): ResolvedTab {
  const songScope = songScopeId(songId);

  if (markerId) {
    const markerTab = tabs[tabKey(markerId, sheetId)];
    if (markerTab) {
      return { tab: markerTab, scopeId: markerId, isFallback: false };
    }
  }

  return {
    tab: tabs[tabKey(songScope, sheetId)] ?? null,
    scopeId: songScope,
    isFallback: markerId !== null,
  };
}