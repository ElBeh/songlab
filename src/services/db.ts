import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SongData, SectionMarker, SectionTab, TabSheet } from '../types';

// IndexedDB schema – idb uses this for type safety
interface SongLabDB extends DBSchema {
  songs: {
    key: string;
    value: SongData;
  };
  markers: {
    key: string;
    value: SectionMarker;
    indexes: { 'by-song': string };
  };
  tabs: {
    key: string;
    value: SectionTab;
    indexes: { 'by-song': string };
  };
  tabSheets: {
    key: string;
    value: TabSheet;
    indexes: { 'by-song': string };
  };
  config: {
    key: string;
    value: { key: string; value: unknown };
  };
  audioFiles: {
    key: string;           // songId
    value: { songId: string; data: ArrayBuffer; mimeType: string };
  };
}

const DB_NAME = 'songlab';
const DB_VERSION = 6;

let dbInstance: IDBPDatabase<SongLabDB> | null = null;

async function getDB(): Promise<IDBPDatabase<SongLabDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SongLabDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('songs', { keyPath: 'id' });
        const markerStore = db.createObjectStore('markers', { keyPath: 'id' });
        markerStore.createIndex('by-song', 'songId');
      }
      if (oldVersion < 2) {
        const tabStore = db.createObjectStore('tabs', { keyPath: 'id' });
        tabStore.createIndex('by-song', 'songId');
      }
      if (oldVersion < 4) {
      const tabSheetStore = db.createObjectStore('tabSheets', { keyPath: 'id' });
      tabSheetStore.createIndex('by-song', 'songId');
    }
      if (oldVersion < 5) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
      if (oldVersion < 6) {
        db.createObjectStore('audioFiles', { keyPath: 'songId' });
      }
    },
  });

  return dbInstance;
}

// --- Songs ---

export async function saveSong(song: SongData): Promise<void> {
  const db = await getDB();
  await db.put('songs', song);
}

export async function getSong(id: string): Promise<SongData | undefined> {
  const db = await getDB();
  return db.get('songs', id);
}

export async function getAllSongs(): Promise<SongData[]> {
  const db = await getDB();
  return db.getAll('songs');
}

export async function deleteSong(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('songs', id);
}

// --- Markers ---

export async function saveMarker(marker: SectionMarker): Promise<void> {
  const db = await getDB();
  await db.put('markers', marker);
}

export async function getMarkersForSong(songId: string): Promise<SectionMarker[]> {
  const db = await getDB();
  return db.getAllFromIndex('markers', 'by-song', songId);
}

export async function deleteMarker(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('markers', id);
}

// --- Tabs ---

export async function saveTab(tab: SectionTab): Promise<void> {
  const db = await getDB();
  await db.put('tabs', tab);
}

export async function getTabsForSong(songId: string): Promise<SectionTab[]> {
  const db = await getDB();
  return db.getAllFromIndex('tabs', 'by-song', songId);
}

export async function deleteTab(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tabs', id);
}

export async function saveTabSheet(sheet: TabSheet): Promise<void> {
  const db = await getDB();
  await db.put('tabSheets', sheet);
}

export async function getTabSheetsForSong(songId: string): Promise<TabSheet[]> {
  const db = await getDB();
  return db.getAllFromIndex('tabSheets', 'by-song', songId);
}

export async function deleteTabSheet(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tabSheets', id);
}

// --- Config (key-value) ---

export async function getConfig<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const entry = await db.get('config', key);
  return entry?.value as T | undefined;
}

export async function setConfig<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('config', { key, value });
}

// --- Audio Files ---

export async function saveAudioFile(
  songId: string,
  data: ArrayBuffer,
  mimeType: string,
): Promise<void> {
  const db = await getDB();
  await db.put('audioFiles', { songId, data, mimeType });
}

export async function getAudioFile(
  songId: string,
): Promise<{ data: ArrayBuffer; mimeType: string } | undefined> {
  const db = await getDB();
  return db.get('audioFiles', songId);
}

export async function deleteAudioFile(songId: string): Promise<void> {
  const db = await getDB();
  await db.delete('audioFiles', songId);
}