import { useState, useCallback, useRef, useEffect } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useModeStore } from '../../stores/useModeStore';
import { MarkerList } from '../Markers/MarkerList';
import { exportSong, importSong, exportSetlist, importSetlist } from '../../services/exportService';
import { useTabStore } from '../../stores/useTabStore';
import { useToastStore } from '../../stores/useToastStore';
import { UrlImportDialog } from './UrlImportDialog';
import { ChevronsRight, ChevronsLeft, ChevronRight, ChevronUp, ChevronDown, Pencil, X, Download, Upload } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';

interface SidebarProps {
  onSeekTo: (time: number) => void;
  duration: number;
  currentTime: number;
  isViewer?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onAddMarker?: () => void;
}

export function Sidebar({ onSeekTo, duration, currentTime, isViewer = false, collapsed = false, onToggleCollapse, onAddMarker }: SidebarProps) {
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [setlistOpen, setSetlistOpen] = useState(true);
  const [setlistName, setSetlistName] = useState('');
  const [editingPauseId, setEditingPauseId] = useState<string | null>(null);
  const [editingPauseValue, setEditingPauseValue] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [setlistExportMode, setSetlistExportMode] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const importExportRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showImportExport) return;
    const handleClick = (e: MouseEvent) => {
      if (importExportRef.current && !importExportRef.current.contains(e.target as Node)) {
        setShowImportExport(false);
        setSetlistExportMode(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showImportExport]);

  const songs = useSongStore((state) => state.songs);
  const songOrder = useSongStore((state) => state.songOrder);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const markersBySong = useSongStore((state) => state.markersBySong);
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
  const updateSong = useSongStore((state) => state.updateSong);

  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editingSongValue, setEditingSongValue] = useState('');

  const activeSong = getActiveSong();
  const orderedSongs = getOrderedSongs();
  const addToast = useToastStore((state) => state.addToast);
  const isSession = useModeStore((state) => state.mode) === 'session';

  // Build a song lookup for rendering
  const songMap = new Map(songs.map((s) => [s.id, s]));
  const markerCount = activeSongId ? (markersBySong[activeSongId] ?? []).length : 0;
  const songCount = songOrder.filter((i) => i.type === 'song').length;

  // Commit song title rename
  const commitSongRename = async (song: typeof songs[0]) => {
    const trimmed = editingSongValue.trim();
    if (trimmed && trimmed !== song.title) {
      await updateSong({ ...song, title: trimmed });
      addToast(`Renamed to "${trimmed}"`, 'info');
    }
    setEditingSongId(null);
  };

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

  // --- Collapsed: thin vertical strip with expand button ---
  if (collapsed) {
    return (
      <aside className='w-10 border-r border-slate-700 flex flex-col items-center
                         py-2 gap-2 transition-all'>
        <button
          onClick={onToggleCollapse}
          className='w-8 h-8 flex items-center justify-center rounded
                     text-slate-400 hover:text-white hover:bg-slate-700
                     transition-colors text-sm'
          title='Expand sidebar'
        >
          <ChevronsRight size={ICON_SIZE.ACTION} />
        </button>
      </aside>
    );
  }

  return (
    <aside className={`${isSession ? 'w-48' : 'w-64'} border-r border-slate-700 flex flex-col overflow-y-auto transition-all`}>

      {/* Collapse button */}
      <button
        onClick={onToggleCollapse}
        className='flex items-center justify-center py-1.5 border-b border-slate-700
                   text-slate-500 hover:text-white hover:bg-slate-800/50
                   transition-colors text-sm'
        title='Collapse sidebar'
      >
        <ChevronsLeft size={ICON_SIZE.ACTION} />
      </button>

      {/* ── Sections accordion ── */}
      {!isSession && (
        <div className='flex flex-col'>
          {/* Header */}
          <button
            onClick={() => setSectionsOpen((v) => !v)}
            className='flex items-center gap-2 px-4 py-2.5 border-b border-slate-700
                       hover:bg-slate-800/50 transition-colors text-left'
          >
            <span className='text-slate-500 transition-transform'
                  style={{ transform: sectionsOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <ChevronRight size={ICON_SIZE.ACCORDION} />
            </span>
            <span className='text-xs font-mono uppercase tracking-widest text-slate-400 flex-1'>
              Sections
            </span>
            {markerCount > 0 && (
              <span className='text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5
                               rounded-full'>
                {markerCount}
              </span>
            )}
          </button>

          {/* Content */}
          {sectionsOpen && (
            <div className='flex flex-col'>
              <div className='p-4'>
                <MarkerList
                  onSeekTo={onSeekTo}
                  duration={duration}
                  currentTime={currentTime}
                  onMarkerSelect={(id) => useTabStore.getState().setActiveMarker(id)}
                />
              </div>

              {/* Add marker button */}
              {activeSong && onAddMarker && (
                <div className='p-3'>
                  <button
                    onClick={onAddMarker}
                    className='w-full px-2 py-1.5 text-xs font-mono text-slate-400
                               hover:text-slate-200 hover:bg-slate-800 rounded
                               transition-colors'
                  >
                    + add marker
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* ── Setlist accordion ── */}
      <div className='flex flex-col border-t border-slate-400'>
        {/* Header */}
        <button
          onClick={() => setSetlistOpen((v) => !v)}
          className='flex items-center gap-2 px-4 py-2.5 border-b border-slate-700
                     hover:bg-slate-800/50 transition-colors text-left'
        >
          <span className='text-slate-500 transition-transform'
                style={{ transform: setlistOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <ChevronRight size={ICON_SIZE.ACCORDION} />
          </span>
          <span className='text-xs font-mono uppercase tracking-widest text-slate-400 flex-1'>
            Setlist
          </span>
          {songCount > 0 && (
            <span className='text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5
                             rounded-full'>
              {songCount}
            </span>
          )}
        </button>

        {/* Content */}
        {setlistOpen && (
          <div className='flex flex-col p-4 gap-4'>
            {/* Setlist items (songs + pauses) */}
            <div className='flex flex-col gap-0.5'>
              {songOrder.length === 0 && (
                <p className='text-xs text-slate-600 font-mono'>No songs loaded.</p>
              )}
              {songOrder.map((item, idx) => {
                // Song position number (pauses don't count)
                const songNumber = item.type === 'song'
                  ? songOrder.filter((it, i) => i <= idx && it.type === 'song').length
                  : 0;

                if (item.type === 'song') {
                  const song = songMap.get(item.songId);
                  if (!song) return null;
                  return (
                    <div
                      key={item.songId}
                      draggable={!isViewer}
                      onDragStart={isViewer ? undefined : (e) => handleDragStart(e, idx)}
                      onDragOver={isViewer ? undefined : (e) => handleDragOver(e, idx)}
                      onDrop={isViewer ? undefined : (e) => handleDrop(e, idx)}
                      onDragEnd={isViewer ? undefined : handleDragEnd}
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
                        cursor: isViewer ? 'default' : 'grab',
                      }}
                    >
                      {/* Reorder buttons */}
                      {!isViewer && (
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
                          <ChevronUp size={ICON_SIZE.ACCORDION} />
                        </button>
                        <button
                          onClick={() => moveItem(idx, 'down')}
                          disabled={idx === songOrder.length - 1}
                          className='text-[10px] leading-none text-slate-500 hover:text-slate-200
                                     disabled:opacity-20 disabled:cursor-not-allowed
                                     transition-colors px-0.5'
                          title='Move down'
                        >
                          <ChevronDown size={ICON_SIZE.ACCORDION} />
                        </button>
                      </div>
                      )}

                      {/* Song title */}
                      {editingSongId === song.id ? (
                        <input
                          value={editingSongValue}
                          onChange={(e) => setEditingSongValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitSongRename(song);
                            if (e.key === 'Escape') setEditingSongId(null);
                          }}
                          onBlur={() => commitSongRename(song)}
                          className='flex-1 bg-slate-700 text-slate-100 text-xs font-mono
                                     px-1 rounded outline-none border border-indigo-500
                                     min-w-0'
                          autoFocus
                        />
                      ) : (
                        <span
                          className='flex-1 text-xs font-mono truncate cursor-pointer'
                          onClick={isViewer ? undefined : async () => {
                            await setActiveSongId(song.id);
                            await useTabStore.getState().loadTabsForSong(song.id);
                            await useTabStore.getState().loadSheetsForSong(song.id);
                          }}
                        >
                          <span className='text-slate-500 mr-1.5'>{songNumber}.</span>
                          {song.title}
                        </span>
                      )}

                      {/* Rename button */}
                      {!isViewer && (
                      <button
                        onClick={() => {
                          setEditingSongId(song.id);
                          setEditingSongValue(song.title);
                        }}
                        className='text-slate-600 hover:text-indigo-400 transition-colors
                                   text-sm font-mono opacity-0 group-hover:opacity-100'
                        title='Rename song'
                      >
                        <Pencil size={ICON_SIZE.ACTION} />
                      </button>
                      )}

                      {/* Delete button */}
                      {!isViewer && (
                      <button
                        onClick={() => {
                          addToast(`Removed "${song.title}"`, 'info');
                          removeSong(song.id);
                        }}
                        className='text-slate-600 hover:text-red-400 transition-colors text-xs
                                   opacity-0 group-hover:opacity-100'
                        title='Remove song'
                      >
                        <X size={ICON_SIZE.ACTION} />
                      </button>
                      )}
                    </div>
                  );
                }

                // Pause item
                if (isViewer) {
                  return (
                    <div key={item.id} className='flex items-center gap-1 px-2 py-1'>
                      <div className='flex-1 flex items-center gap-2'>
                        <div className='flex-1 h-px bg-slate-700' />
                        <span className='text-[10px] font-mono text-slate-600 whitespace-nowrap'>
                          {item.duration}s
                        </span>
                        <div className='flex-1 h-px bg-slate-700' />
                      </div>
                    </div>
                  );
                }
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
                        <ChevronUp size={ICON_SIZE.ACCORDION} />
                      </button>
                      <button
                        onClick={() => moveItem(idx, 'down')}
                        disabled={idx === songOrder.length - 1}
                        className='text-[10px] leading-none text-slate-500 hover:text-slate-200
                                   disabled:opacity-20 disabled:cursor-not-allowed
                                   transition-colors px-0.5'
                        title='Move down'
                      >
                        <ChevronDown size={ICON_SIZE.ACCORDION} />
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
                      <X size={ICON_SIZE.ACTION} />
                    </button>
                  </div>
                );
              })}

              {/* Add pause at end of setlist */}
              {!isSession && songOrder.length > 0 && (
                <button
                  onClick={() => addPause(songOrder.length - 1)}
                  className='w-full px-2 py-1.5 text-xs font-mono text-slate-400
                               hover:text-slate-200 hover:bg-slate-800 rounded
                               transition-colors'
                >
                  + add pause
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Import / Export (pinned to bottom, practice mode only) ── */}
      {!isSession && (
      <>
      <div className='mt-auto border-t border-slate-700 p-3' ref={importExportRef}>
        <div className='relative'>
          <button
            onClick={() => {
              setShowImportExport((v) => !v);
              setSetlistExportMode(false);
            }}
            className='w-full px-2 py-1.5 text-xs font-mono rounded transition-colors
                       bg-slate-700 hover:bg-slate-600 text-slate-300'
          >
            Import / Export
          </button>
          {showImportExport && (
            <div className='absolute left-0 right-0 bottom-full mb-1 bg-slate-800 border
                            border-slate-600 rounded-lg shadow-xl py-1 z-50'>
              {activeSong && (
                <button
                  onClick={() => {
                    handleExportSong();
                    setShowImportExport(false);
                  }}
                  className='w-full text-left px-3 py-1.5 text-xs font-mono
                             text-slate-300 hover:bg-slate-700 transition-colors'
                >
                  <Download size={ICON_SIZE.ACTION} className='inline-block' /> Export Song
                </button>
              )}
              <button
                onClick={() => {
                  handleImportSong();
                  setShowImportExport(false);
                }}
                className='w-full text-left px-3 py-1.5 text-xs font-mono
                           text-slate-300 hover:bg-slate-700 transition-colors'
              >
                <Upload size={ICON_SIZE.ACTION} className='inline-block' /> Import Song
              </button>
              <div className='border-t border-slate-700 my-1' />
              {!setlistExportMode ? (
                <button
                  onClick={() => setSetlistExportMode(true)}
                  disabled={songs.length === 0}
                  className='w-full text-left px-3 py-1.5 text-xs font-mono
                             text-slate-300 hover:bg-slate-700 transition-colors
                             disabled:opacity-30 disabled:cursor-not-allowed'
                >
                  <Download size={ICON_SIZE.ACTION} className='inline-block' /> Export Setlist
                </button>
              ) : (
                <div className='px-3 py-1.5 flex flex-col gap-1.5'>
                  <input
                    type='text'
                    placeholder='Setlist name...'
                    value={setlistName}
                    onChange={(e) => setSetlistName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && setlistName.trim()) {
                        handleExportSetlist();
                        setShowImportExport(false);
                        setSetlistExportMode(false);
                      }
                    }}
                    autoFocus
                    className='bg-slate-900 text-slate-200 text-xs rounded px-2
                               py-1 border border-slate-600 focus:border-indigo-500
                               outline-none font-mono w-full'
                  />
                  <button
                    onClick={() => {
                      handleExportSetlist();
                      setShowImportExport(false);
                      setSetlistExportMode(false);
                    }}
                    disabled={!setlistName.trim()}
                    className='px-2 py-1 text-xs font-mono bg-indigo-600
                               hover:bg-indigo-500 text-white rounded
                               transition-colors disabled:opacity-30
                               disabled:cursor-not-allowed'
                  >
                    <Download size={ICON_SIZE.ACTION} className='inline-block' /> Export
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  handleImportSetlist();
                  setShowImportExport(false);
                }}
                className='w-full text-left px-3 py-1.5 text-xs font-mono
                           text-slate-300 hover:bg-slate-700 transition-colors'
              >
                <Upload size={ICON_SIZE.ACTION} className='inline-block' /> Import Setlist
              </button>
              <button
                onClick={() => {
                  setShowUrlImport(true);
                  setShowImportExport(false);
                }}
                className='w-full text-left px-3 py-1.5 text-xs font-mono
                           text-slate-300 hover:bg-slate-700 transition-colors'
              >
                <Upload size={ICON_SIZE.ACTION} className='inline-block' /> Import from URL
              </button>
            </div>
          )}
        </div>
      </div>

      {/* URL Import Dialog */}
      {showUrlImport && (
        <UrlImportDialog
          onClose={() => setShowUrlImport(false)}
          onImported={async (importedSongs) => {
            for (const song of importedSongs) {
              await addSong(song);
            }
            if (importedSongs.length > 0) {
              await setActiveSongId(importedSongs[0].id);
              await useTabStore.getState().loadTabsForSong(importedSongs[0].id);
              await useTabStore.getState().loadSheetsForSong(importedSongs[0].id);
            }
          }}
        />
      )}
      </>
      )}
    </aside>
  );
}