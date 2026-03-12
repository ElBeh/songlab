import { useState } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { MarkerList } from '../Markers/MarkerList';
import { exportSong, importSong } from '../../services/exportImport';
import { exportSetlist, importSetlist } from '../../services/setlistService';
import type { Setlist } from '../../types';
import { useTabStore } from '../../stores/useTabStore';

interface SidebarProps {
  onSeekTo: (time: number) => void;
  duration: number;
  currentTime: number;
}

export function Sidebar({ onSeekTo, duration, currentTime }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'sections' | 'setlist'>('sections');
  const [setlistName, setSetlistName] = useState('');
  const [importedSetlist] = useState<Setlist | null>(null);

  const songs = useSongStore((state) => state.songs);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const getActiveSong = useSongStore((state) => state.getActiveSong);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const addSong = useSongStore((state) => state.addSong);

  const activeSong = getActiveSong();

  const handleExportSong = async () => {
    if (!activeSong) return;
    await exportSong(activeSong);
  };

const handleImportSong = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const song = await importSong(file);
      await addSong(song);
      await setActiveSongId(song.id);
      await useTabStore.getState().loadTabsForSong(song.id);
      await useTabStore.getState().loadSheetsForSong(song.id);
    } catch (err) {
      console.error('Import failed:', err);
    }
  };
  input.click();
};
  const handleExportSetlist = async () => {
    if (!setlistName.trim()) return;
    await exportSetlist(setlistName.trim(), songs);
  };

  const handleImportSetlist = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const importedSongs = await importSetlist(file);
        for (const song of importedSongs) {
          await addSong(song);
        }
        if (importedSongs.length > 0) {
          await setActiveSongId(importedSongs[0].id);
          await useTabStore.getState().loadTabsForSong(importedSongs[0].id);
          await useTabStore.getState().loadSheetsForSong(importedSongs[0].id); // neu
        }
      } catch (err) {
        console.error('Setlist import failed:', err);
      }
    };
    input.click();
  };

  return (
    <aside className='w-64 border-r border-slate-700 flex flex-col overflow-hidden'>
      {/* Tab navigation */}
      <div className='flex border-b border-slate-700'>
        {(['sections', 'setlist'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className='flex-1 py-2 text-xs font-mono uppercase tracking-widest
                       transition-colors'
            style={{
              color: activeTab === tab ? '#f1f5f9' : '#64748b',
              borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Sections tab */}
      {activeTab === 'sections' && (
        <div className='flex flex-col flex-1 overflow-hidden'>
          <div className='flex-1 overflow-y-auto p-4'>
            <MarkerList
              onSeekTo={onSeekTo}
              duration={duration}
              currentTime={currentTime}
              onMarkerSelect={(id) => useTabStore.getState().setActiveMarker(id)}
            />
          </div>

          {/* Song import/export at bottom */}
          <div className='border-t border-slate-700 p-3 flex flex-col gap-2'>
            <p className='text-xs font-mono text-slate-500 uppercase tracking-widest'>
              Song Data
            </p>
            <div className='flex gap-2'>
              {activeSong && (
                <button
                  onClick={handleExportSong}
                  className='flex-1 px-2 py-1 text-xs font-mono bg-slate-700
                             hover:bg-slate-600 text-slate-300 rounded transition-colors'
                >
                  ↓ export
                </button>
              )}
              <button
                onClick={handleImportSong}
                className='flex-1 px-2 py-1 text-xs font-mono bg-slate-700
                           hover:bg-slate-600 text-slate-300 rounded transition-colors'
              >
                ↑ import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setlist tab */}
      {activeTab === 'setlist' && (
        <div className='flex flex-col flex-1 overflow-y-auto p-4 gap-4'>
          {/* Current songs */}
          <div className='flex flex-col gap-1'>
            <p className='text-xs font-mono text-slate-500 uppercase tracking-widest mb-1'>
              Loaded Songs
            </p>
            {songs.length === 0 && (
              <p className='text-xs text-slate-600 font-mono'>No songs loaded.</p>
            )}
            {songs.map((song) => (
              <div
                key={song.id}
                className='flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
                           transition-colors'
                style={{
                  backgroundColor: song.id === activeSongId ? '#1e293b' : 'transparent',
                  color: song.id === activeSongId ? '#f1f5f9' : '#94a3b8',
                }}
              onClick={async () => {
                await setActiveSongId(song.id);
                await useTabStore.getState().loadTabsForSong(song.id);
                await useTabStore.getState().loadSheetsForSong(song.id);
              }}
              >
                <span className='flex-1 text-xs font-mono truncate'>{song.title}</span>
              </div>
            ))}
          </div>

          {/* Export setlist */}
          <div className='flex flex-col gap-2 border-t border-slate-700 pt-3'>
            <p className='text-xs font-mono text-slate-500 uppercase tracking-widest'>
              Export Setlist
            </p>
            <input
              type='text'
              placeholder='Setlist name...'
              value={setlistName}
              onChange={(e) => setSetlistName(e.target.value)}
              className='bg-slate-800 text-slate-200 text-xs rounded px-2 py-1.5
                         border border-slate-600 focus:border-indigo-500 outline-none font-mono'
            />
            <button
              onClick={handleExportSetlist}
              disabled={!setlistName.trim() || songs.length === 0}
              className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-slate-600
                         text-slate-300 rounded transition-colors
                         disabled:opacity-30 disabled:cursor-not-allowed'
            >
              ↓ export setlist
            </button>
          </div>

          {/* Import setlist */}
          <div className='flex flex-col gap-2 border-t border-slate-700 pt-3'>
            <p className='text-xs font-mono text-slate-500 uppercase tracking-widest'>
              Import Setlist
            </p>
            <button
              onClick={handleImportSetlist}
              className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-slate-600
                         text-slate-300 rounded transition-colors'
            >
              ↑ import setlist
            </button>
            {importedSetlist && (
              <div className='flex flex-col gap-1'>
                <p className='text-xs font-mono text-slate-400'>{importedSetlist.name}</p>
                {importedSetlist.entries.map((entry) => (
                  <div key={entry.songId} className='text-xs font-mono text-slate-500 px-2'>
                    • {entry.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}