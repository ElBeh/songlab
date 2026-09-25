import { useState } from 'react';
import {
  commitBundles,
  parseImportFile,
  selectBundlesToCommit,
  type ImportedSetlist,
  type ParsedImport,
  type SongBundle,
} from '../services/exportService';
import { useSongStore } from '../stores/useSongStore';
import { useSetlistStore } from '../stores/useSetlistStore';
import { useTabStore } from '../stores/useTabStore';
import { useToastStore } from '../stores/useToastStore';
import type { ImportConflictResolution } from '../types';

type GigImport = Extract<ParsedImport, { type: 'gig' }>;
type Decisions = Map<number, ImportConflictResolution>;

interface PendingImport {
  parsed: GigImport;
  /** Indices into parsed.setlists whose name clashes with an existing setlist */
  conflicts: number[];
  /** Index into `conflicts` of the conflict currently shown */
  position: number;
  decisions: Decisions;
}

const toast = (message: string, type: 'success' | 'error' | 'info') =>
  useToastStore.getState().addToast(message, type);

/** Make a song active and load its tabs and sheets */
async function activateSong(songId: string): Promise<void> {
  await useSongStore.getState().setActiveSongId(songId);
  await useTabStore.getState().loadTabsForSong(songId);
  await useTabStore.getState().loadSheetsForSong(songId);
}

async function importSong(bundle: SongBundle): Promise<void> {
  const [song] = await commitBundles([bundle]);
  await useSongStore.getState().addSong(song);
  await useSetlistStore.getState().addSongToActiveSetlist(song.id);
  await activateSong(song.id);
  toast(`Imported "${song.title}"`, 'success');
}

/** Create or replace one imported setlist. Returns its id, or null if skipped. */
async function writeSetlist(
  setlist: ImportedSetlist,
  resolution: ImportConflictResolution | undefined,
): Promise<string | null> {
  if (resolution === 'skip') return null;

  if (resolution === 'replace') {
    const existing = useSetlistStore.getState().findSetlistByName(setlist.name);
    if (existing) {
      await useSetlistStore.getState().replaceSetlistItems(existing.id, setlist.items);
      return existing.id;
    }
  }

  const name = resolution === 'keepBoth'
    ? useSetlistStore.getState().getUniqueSetlistName(setlist.name)
    : setlist.name;
  const id = await useSetlistStore.getState().createSetlist(name);
  await useSetlistStore.getState().replaceSetlistItems(id, setlist.items);
  return id;
}

/** Persist songs and setlists according to the conflict decisions */
async function applyGigImport(parsed: GigImport, decisions: Decisions): Promise<void> {
  const kept = parsed.setlists.filter((_, i) => decisions.get(i) !== 'skip');
  const skippedCount = parsed.setlists.length - kept.length;
  if (kept.length === 0) {
    toast('Import discarded', 'info');
    return;
  }

  const bundles = selectBundlesToCommit(parsed.bundles, parsed.setlists, kept);
  const songs = await commitBundles(bundles);
  for (const song of songs) {
    await useSongStore.getState().addSong(song);
  }

  const setlistIds: string[] = [];
  for (const [i, setlist] of parsed.setlists.entries()) {
    const id = await writeSetlist(setlist, decisions.get(i));
    if (id) setlistIds.push(id);
  }

  useSetlistStore.getState().switchSetlist(setlistIds[0]);
  if (songs.length > 0) await activateSong(songs[0].id);

  const base = kept.length > 1
    ? `Imported ${kept.length} setlists with ${songs.length} song(s)`
    : `Imported ${songs.length} song(s)`;
  toast(skippedCount > 0 ? `${base}, skipped ${skippedCount}` : base, 'success');
}

/**
 * Import orchestration for file and URL imports: detects setlist name clashes,
 * walks the user through one conflict dialog per clash, then persists the result.
 */
export function useImportFlow() {
  const [pending, setPending] = useState<PendingImport | null>(null);

  const runSafely = async (task: () => Promise<void>) => {
    try {
      await task();
    } catch (error) {
      console.error('Import failed:', error);
      toast('Import failed', 'error');
    }
  };

  /** Start an import from already parsed data (e.g. URL import) */
  const importParsed = (parsed: ParsedImport) => runSafely(async () => {
    if (parsed.type === 'song') {
      await importSong(parsed.bundle);
      return;
    }
    const { findSetlistByName } = useSetlistStore.getState();
    const conflicts = parsed.setlists.flatMap((sl, i) => (findSetlistByName(sl.name) ? [i] : []));
    if (conflicts.length === 0) {
      await applyGigImport(parsed, new Map());
      return;
    }
    setPending({ parsed, conflicts, position: 0, decisions: new Map() });
  });

  /** Parse an export file, then start the import */
  const importFromFile = (file: File) => runSafely(async () => {
    const parsed = await parseImportFile(file);
    await importParsed(parsed);
  });

  /** Record a decision; shows the next conflict or persists once all are resolved */
  const resolveConflict = async (
    resolution: ImportConflictResolution,
    applyToAll: boolean,
  ): Promise<void> => {
    if (!pending) return;
    const { parsed, conflicts, position } = pending;

    const decisions = new Map(pending.decisions);
    const targets = applyToAll ? conflicts.slice(position) : [conflicts[position]];
    targets.forEach((i) => decisions.set(i, resolution));

    const next = applyToAll ? conflicts.length : position + 1;
    if (next < conflicts.length) {
      setPending({ ...pending, position: next, decisions });
      return;
    }
    setPending(null);
    await runSafely(() => applyGigImport(parsed, decisions));
  };

  // Props for ImportConflictDialog, or null when no conflict is pending
  const conflictDialog = pending
    ? (() => {
        const setlistName = pending.parsed.setlists[pending.conflicts[pending.position]].name;
        return {
          setlistName,
          keepBothName: useSetlistStore.getState().getUniqueSetlistName(setlistName),
          conflictIndex: pending.position + 1,
          conflictCount: pending.conflicts.length,
          onResolve: resolveConflict,
        };
      })()
    : null;

  return { importFromFile, importParsed, conflictDialog };
}