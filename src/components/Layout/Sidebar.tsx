import { useState, useCallback } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useModeStore } from '../../stores/useModeStore';
import { MarkerList } from '../Markers/MarkerList';
import { exportSong, importSong } from '../../services/exportImport';
import { exportSetlist, importSetlist } from '../../services/setlistService';
import type { Setlist } from '../../types';
import { useTabStore } from '../../stores/useTabStore';
import { useToastStore } from '../../stores/useToastStore';

interface SidebarProps {
  onSeekTo: (time: number) => void;
  duration: number;
  currentTime: number;
}

export function Sidebar({ onSeekTo, duration, currentTime }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'sections' | 'setlist'>('sections');
  const [setlistName, setSetlistName] = useState('');
  const [importedSetlist] = useState<Setlist | null>(null);
  const [editingPauseId, setEditingPauseId] = useState<string | null>(null);
  const [editingPauseValue, setEditingPauseValue] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const songs = useSongStore((state) => state.songs);
  const songOrder = useSongStore((state) => state.songOrder);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const getActiveSong = useSongStore((state) => state.getActiveSong);
  const getOrderedSongs = useSongStore((state) => state.getOrderedSongs);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const addSong = useSongStore((state) => state.addSong);
  const removeSong = useSongStore((state) => state.removeSong);
  const moveItem = useSongStore((state) => state.moveItem);
  const reorderItem = useSongStore((state) => state.reorderItem);
  const addPause = useSongStore((state) => state.addPause);
  const updatePause = useSongStore((state) => state.updatePause);
  const removePause = useSongStore((state) => state.removePause);

  const activeSong = getActiveSong();
  const orderedSongs = getOrderedSongs();
  const addToast = useToastStore((state) => state.addToast);
  const isBand = useModeStore((state) => state.mode) === 'band';

  // Build a song lookup for rendering
  const songMap = new Map(songs.map((s) => [s.id, s]));

  const handleExportSong = async () => {
    if (!activeSong) return;
    await exportSong(activeSong);
    addToast(`Exported "${activeSong.title}"`, 'success');
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
        addToast(`Imported "${song.title}"`, 'success');
      } catch (err) {
        console.error('Import failed:', err);
        addToast('Song import failed', 'error');
      }
    };
    input.click();
  };

  const handleExportSetlist = async () => {
    if (!setlistName.trim()) return;
    await exportSetlist(setlistName.trim(), orderedSongs);
    addToast(`Exported setlist "${setlistName.trim()}"`, 'success');
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
          await useTabStore.getState().loadSheetsForSong(importedSongs[0].id);
        }
        addToast(`Imported ${importedSongs.length} song(s)`, 'success');
      } catch (err) {
        console.error('Setlist import failed:', err);
        addToast('Setlist import failed', 'error');
      }
    };
    input.click();
  };

  const handlePauseEditCommit = (id: string) => {
    const val = parseInt(editingPauseValue, 10);
    if (!isNaN(val) && val > 0) {
      updatePause(id, val);
    }
    setEditingPauseId(null);
  };

  // --- Drag & Drop handlers ---

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Minimal data required for Firefox DnD support
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex === null || dragIndex === idx) {
      setDropIndex(null);
      return;
    }
    setDropIndex(idx);
  }, [dragIndex]);

  const handleDrop = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== idx) {
      reorderItem(dragIndex, idx);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, reorderItem]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  return (
    <aside className={`${isBand ? 'w-48' : 'w-64'} border-r border-slate-700 flex flex-col overflow-hidden transition-all`}>

      {/* Tab navigation */}
      {!isBand && (
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
      )}

      {/* Sections tab */}
      {!isBand && activeTab === 'sections' && (
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
      {(isBand || activeTab === 'setlist') && (
        <div className='flex flex-col flex-1 overflow-y-auto p-4 gap-4'>
          {/* Setlist items (songs + pauses) */}
          <div className='flex flex-col gap-0.5'>
            <p className='text-xs font-mono text-slate-500 uppercase tracking-widest mb-1'>
              Setlist
            </p>
            {songOrder.length === 0 && (
              <p className='text-xs text-slate-600 font-mono'>No songs loaded.</p>
            )}
            {songOrder.map((item, idx) => {
              if (item.type === 'song') {
                const song = songMap.get(item.songId);
                if (!song) return null;
                return (
                  <div
                    key={item.songId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className='flex items-center gap-1 px-2 py-1.5 rounded
                               transition-colors group'
                    style={{
                      backgroundColor: song.id === activeSongId ? '#1e293b' : 'transparent',
                      color: song.id === activeSongId ? '#f1f5f9' : '#94a3b8',
                      opacity: dragIndex === idx ? 0.4 : 1,
                      borderTop: dropIndex === idx && dragIndex !== null && dragIndex > idx
                        ? '2px solid #6366f1' : '2px solid transparent',
                      borderBottom: dropIndex === idx && dragIndex !== null && dragIndex < idx
                        ? '2px solid #6366f1' : '2px solid transparent',
                      cursor: 'grab',
                    }}
                  >
                    {/* Reorder buttons */}
                    <div className='flex flex-col opacity-0 group-hover:opacity-100
                                    transition-opacity'>
                      <button
                        onClick={() => moveItem(idx, 'up')}
                        disabled={idx === 0}
                        className='text-[10px] leading-none text-slate-500 hover:text-slate-200
                                   disabled:opacity-20 disabled:cursor-not-allowed
                                   transition-colors px-0.5'
                        title='Move up'
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveItem(idx, 'down')}
                        disabled={idx === songOrder.length - 1}
                        className='text-[10px] leading-none text-slate-500 hover:text-slate-200
                                   disabled:opacity-20 disabled:cursor-not-allowed
                                   transition-colors px-0.5'
                        title='Move down'
                      >
                        ▼
                      </button>
                    </div>

                    {/* Dummy indicator */}
                    {song.isDummy && (
                      <span className='text-[10px] text-slate-600' title='No audio file'>
                        📝
                      </span>
                    )}

                    {/* Song title */}
                    <span
                      className='flex-1 text-xs font-mono truncate cursor-pointer'
                      onClick={async () => {
                        await setActiveSongId(song.id);
                        await useTabStore.getState().loadTabsForSong(song.id);
                        await useTabStore.getState().loadSheetsForSong(song.id);
                      }}
                    >
                      {song.title}
                    </span>

                    {/* Delete button */}
                    <button
                      onClick={() => {
                        addToast(`Removed "${song.title}"`, 'info');
                        removeSong(song.id);
                      }}
                      className='text-slate-600 hover:text-red-400 transition-colors text-xs
                                 opacity-0 group-hover:opacity-100'
                      title='Remove song'
                    >
                      ✕
                    </button>
                  </div>
                );
              }

              // Pause item
return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className='flex items-center gap-1 px-2 py-1 group'
                  style={{
                    opacity: dragIndex === idx ? 0.4 : 1,
                    borderTop: dropIndex === idx && dragIndex !== null && dragIndex > idx
                      ? '2px solid #6366f1' : '2px solid transparent',
                    borderBottom: dropIndex === idx && dragIndex !== null && dragIndex < idx
                      ? '2px solid #6366f1' : '2px solid transparent',
                    cursor: 'grab',
                  }}
                >
                  {/* Reorder buttons */}
                  <div className='flex flex-col opacity-0 group-hover:opacity-100
                                  transition-opacity'>
                    <button
                      onClick={() => moveItem(idx, 'up')}
                      disabled={idx === 0}
                      className='text-[10px] leading-none text-slate-500 hover:text-slate-200
                                 disabled:opacity-20 disabled:cursor-not-allowed
                                 transition-colors px-0.5'
                      title='Move up'
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveItem(idx, 'down')}
                      disabled={idx === songOrder.length - 1}
                      className='text-[10px] leading-none text-slate-500 hover:text-slate-200
                                 disabled:opacity-20 disabled:cursor-not-allowed
                                 transition-colors px-0.5'
                      title='Move down'
                    >
                      ▼
                    </button>
                  </div>

                  {/* Divider line — label — line */}
                  <div className='flex-1 flex items-center gap-2'>
                    <div className='flex-1 h-px bg-slate-700' />
                    {editingPauseId === item.id ? (
                      <input
                        type='number'
                        min={1}
                        max={300}
                        value={editingPauseValue}
                        onChange={(e) => setEditingPauseValue(e.target.value)}
                        onBlur={() => handlePauseEditCommit(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePauseEditCommit(item.id);
                          if (e.key === 'Escape') setEditingPauseId(null);
                        }}
                        autoFocus
                        className='w-10 bg-slate-900 text-slate-200 text-xs rounded px-1 py-0.5
                                   border border-indigo-500 outline-none font-mono text-center'
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPauseId(item.id);
                          setEditingPauseValue(String(item.duration));
                        }}
                        className='text-[10px] font-mono text-slate-600 hover:text-slate-400
                                   transition-colors whitespace-nowrap'
                        title='Click to edit duration'
                      >
                        {item.duration}s
                      </button>
                    )}
                    <div className='flex-1 h-px bg-slate-700' />
                  </div>

                  {/* Delete pause */}
                  <button
                    onClick={() => removePause(item.id)}
                    className='text-slate-600 hover:text-red-400 transition-colors text-xs
                               opacity-0 group-hover:opacity-100'
                    title='Remove pause'
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            {/* Add pause at end of setlist */}
            {!isBand && songOrder.length > 0 && (
              <button
                onClick={() => addPause(songOrder.length - 1)}
                className='px-2 py-1 text-xs font-mono text-slate-600 hover:text-slate-300
                           transition-colors self-start'
              >
                + add pause
              </button>
            )}
          </div>

{!isBand && (
            <>
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
            </>
          )}
        </div>       
      )}
    </aside>
  );
}