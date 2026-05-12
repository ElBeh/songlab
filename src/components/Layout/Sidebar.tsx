import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useSetlistStore } from '../../stores/useSetlistStore';
import { useModeStore } from '../../stores/useModeStore';
import { MarkerList } from '../Markers/MarkerList';
import { exportSong, importSong, exportSetlist, importSetlist } from '../../services/exportService';
import { useTabStore } from '../../stores/useTabStore';
import { useToastStore } from '../../stores/useToastStore';
import { UrlImportDialog } from './UrlImportDialog';
import { formatTime } from '../../utils/formatTime';
import { ChevronsRight, ChevronsLeft, ChevronRight, ChevronUp, ChevronDown, Pencil, X, Download, Upload } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';
import { useShallow } from 'zustand/shallow';

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

  // Setlist management state
  const [showSetlistMenu, setShowSetlistMenu] = useState(false);
  const [renamingSetlist, setRenamingSetlist] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteSetlist, setConfirmDeleteSetlist] = useState(false);
  const [creatingSetlist, setCreatingSetlist] = useState(false);
  const [newSetlistName, setNewSetlistName] = useState('');
  const setlistMenuRef = useRef<HTMLDivElement>(null);

  // Song context menu state
  const [songMenuId, setSongMenuId] = useState<string | null>(null);
  const songMenuRef = useRef<HTMLDivElement>(null);

  // Song delete confirmation state
  const [confirmDeleteSongId, setConfirmDeleteSongId] = useState<string | null>(null);

  // Song search state
  const [searchQuery, setSearchQuery] = useState('');

  // Song rename state
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editingSongValue, setEditingSongValue] = useState('');

  // Close import/export dropdown on outside click
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

  // Close setlist dropdown on outside click
  useEffect(() => {
    if (!showSetlistMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (setlistMenuRef.current && !setlistMenuRef.current.contains(e.target as Node)) {
        setShowSetlistMenu(false);
        setConfirmDeleteSetlist(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSetlistMenu]);

  // Close song context menu on outside click
  useEffect(() => {
    if (!songMenuId) return;
    const handleClick = (e: MouseEvent) => {
      if (songMenuRef.current && !songMenuRef.current.contains(e.target as Node)) {
        setSongMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [songMenuId]);

  // --- Song store ---
  const songs = useSongStore((state) => state.songs);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const markersBySong = useSongStore((state) => state.markersBySong);
  const getActiveSong = useSongStore((state) => state.getActiveSong);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const addSong = useSongStore((state) => state.addSong);
  const removeSong = useSongStore((state) => state.removeSong);
  const updateSong = useSongStore((state) => state.updateSong);

  // --- Setlist store ---
  const allSetlists = useSetlistStore((state) => state.setlists);
  const activeSetlistId = useSetlistStore((state) => state.activeSetlistId);
  const activeSetlist = allSetlists.find((s) => s.id === activeSetlistId);
  const songOrder = useSetlistStore(useShallow((state) => {
    const active = state.setlists.find((s) => s.id === state.activeSetlistId);
    return active?.items ?? [];
  }));
  const getOrderedSongs = useSetlistStore((state) => state.getOrderedSongs);
  const moveItem = useSetlistStore((state) => state.moveItem);
  const reorderItem = useSetlistStore((state) => state.reorderItem);
  const addPause = useSetlistStore((state) => state.addPause);
  const updatePause = useSetlistStore((state) => state.updatePause);
  const removePause = useSetlistStore((state) => state.removePause);
  const switchSetlist = useSetlistStore((state) => state.switchSetlist);
  const createSetlist = useSetlistStore((state) => state.createSetlist);
  const renameSetlist = useSetlistStore((state) => state.renameSetlist);
  const duplicateSetlist = useSetlistStore((state) => state.duplicateSetlist);
  const deleteSetlist = useSetlistStore((state) => state.deleteSetlist);
  const totalDuration = useSetlistStore.getState().getTotalDuration();

  const activeSong = getActiveSong();
  const orderedSongs = getOrderedSongs();
  const addToast = useToastStore((state) => state.addToast);
  const isSession = useModeStore((state) => state.mode) === 'session';
  const canEdit = !isViewer && !isSession;

  // Build a song lookup for rendering
  const songMap = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const markerCount = activeSongId ? (markersBySong[activeSongId] ?? []).length : 0;
  const songCount = songOrder.filter((i) => i.type === 'song').length;

  // --- Search: find matching songs across all setlists ---
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const results: { songId: string; title: string; setlistName: string; setlistId: string }[] = [];
    const seen = new Set<string>();

    for (const sl of allSetlists) {
      for (const item of sl.items) {
        if (item.type !== 'song') continue;
        const song = songMap.get(item.songId);
        if (!song) continue;
        if (!song.title.toLowerCase().includes(q)) continue;
        const key = `${item.songId}:${sl.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          songId: item.songId,
          title: song.title,
          setlistName: sl.name,
          setlistId: sl.id,
        });
      }
    }
    return results;
  }, [searchQuery, allSetlists, songMap]);

  // --- Song delete handler with cross-setlist warning ---
  const handleDeleteSong = useCallback((songId: string) => {
    const song = songMap.get(songId);
    if (!song) return;

    const referencedIn = useSetlistStore.getState().getSetlistsContainingSong(songId);
    const otherSetlists = referencedIn.filter((s) => s.id !== activeSetlistId);

    if (otherSetlists.length > 0 && confirmDeleteSongId !== songId) {
      setConfirmDeleteSongId(songId);
      return;
    }

    useSetlistStore.getState().removeSongFromAllSetlists(songId);
    removeSong(songId);
    addToast(`Removed "${song.title}"`, 'info');
    setConfirmDeleteSongId(null);
  }, [songMap, activeSetlistId, confirmDeleteSongId, removeSong, addToast]);

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
        await useSetlistStore.getState().addSongToActiveSetlist(song.id);
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
    const name = activeSetlist?.name ?? 'Setlist';
    await exportSetlist(name, songOrder, orderedSongs);
    addToast(`Exported "${name}"`, 'success');
  };

const handleImportSetlist = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const result = await importSetlist(file);
        for (const song of result.songs) {
          await addSong(song);
        }
        await createSetlist(result.name);
        await useSetlistStore.getState().setActiveItems(result.items);
        if (result.songs.length > 0) {
          await setActiveSongId(result.songs[0].id);
          await useTabStore.getState().loadTabsForSong(result.songs[0].id);
          await useTabStore.getState().loadSheetsForSong(result.songs[0].id);
        }
        addToast(`Imported ${result.songs.length} song(s)`, 'success');
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
            {/* Setlist selector row */}
              <div className='relative' ref={setlistMenuRef}>
                <div className='flex items-center gap-2'>
                  {renamingSetlist ? (
                    <input
                      type='text'
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        if (renameValue.trim() && activeSetlistId) {
                          renameSetlist(activeSetlistId, renameValue.trim());
                        }
                        setRenamingSetlist(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && renameValue.trim() && activeSetlistId) {
                          renameSetlist(activeSetlistId, renameValue.trim());
                          setRenamingSetlist(false);
                        }
                        if (e.key === 'Escape') setRenamingSetlist(false);
                      }}
                      autoFocus
                      className='flex-1 bg-slate-900 text-slate-200 text-xs rounded px-2 py-1
                                 border border-indigo-500 outline-none font-mono'
                    />
                  ) : (
                    <button
                      onClick={() => setShowSetlistMenu((v) => !v)}
                      className='flex-1 flex items-center gap-1.5 px-2 py-1 text-xs font-mono
                                 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded
                                 transition-colors text-left'
                    >
                      <span className='flex-1 truncate'>
                        {activeSetlist?.name ?? 'No setlist'}
                      </span>
                      <ChevronDown size={12} className='text-slate-500 shrink-0' />
                    </button>
                  )}
                  {totalDuration > 0 && !renamingSetlist && (
                    <span className='text-[10px] font-mono text-slate-600 whitespace-nowrap'>
                      {formatTime(totalDuration)}
                    </span>
                  )}
                </div>

                {/* Setlist dropdown menu */}
                {showSetlistMenu && (
                  <div className='absolute left-0 right-0 top-full mt-1 bg-slate-800 border
                                  border-slate-600 rounded-lg shadow-xl py-1 z-50'>
                    {allSetlists.map((sl) => (
                      <button
                        key={sl.id}
                        onClick={() => {
                          switchSetlist(sl.id);
                          setShowSetlistMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-mono
                                   transition-colors ${
                                     sl.id === activeSetlistId
                                       ? 'text-indigo-400 bg-slate-700/50'
                                       : 'text-slate-300 hover:bg-slate-700'
                                   }`}
                      >
                        {sl.name}
                      </button>
                    ))}
                    <div className='border-t border-slate-700 my-1' />

                    {creatingSetlist ? (
                      <div className='px-3 py-1.5'>
                        <input
                          type='text'
                          placeholder='Setlist name...'
                          value={newSetlistName}
                          onChange={(e) => setNewSetlistName(e.target.value)}
                          onBlur={() => setCreatingSetlist(false)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && newSetlistName.trim()) {
                              await createSetlist(newSetlistName.trim());
                              setNewSetlistName('');
                              setCreatingSetlist(false);
                              setShowSetlistMenu(false);
                            }
                            if (e.key === 'Escape') setCreatingSetlist(false);
                          }}
                          autoFocus
                          className='w-full bg-slate-900 text-slate-200 text-xs rounded px-2
                                     py-1 border border-slate-600 focus:border-indigo-500
                                     outline-none font-mono'
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setCreatingSetlist(true)}
                        className='w-full text-left px-3 py-1.5 text-xs font-mono
                                   text-slate-400 hover:bg-slate-700 transition-colors'
                      >
                        + New Setlist
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setRenameValue(activeSetlist?.name ?? '');
                        setRenamingSetlist(true);
                        setShowSetlistMenu(false);
                      }}
                      className='w-full text-left px-3 py-1.5 text-xs font-mono
                                 text-slate-400 hover:bg-slate-700 transition-colors'
                    >
                      Rename
                    </button>

                    <button
                      onClick={async () => {
                        if (activeSetlistId) {
                          await duplicateSetlist(activeSetlistId);
                          setShowSetlistMenu(false);
                        }
                      }}
                      className='w-full text-left px-3 py-1.5 text-xs font-mono
                                 text-slate-400 hover:bg-slate-700 transition-colors'
                    >
                      Duplicate
                    </button>

                    {allSetlists.length > 1 && (
                      confirmDeleteSetlist ? (
                        <button
                          onClick={async () => {
                            if (activeSetlistId) {
                              await deleteSetlist(activeSetlistId);
                              setConfirmDeleteSetlist(false);
                              setShowSetlistMenu(false);
                            }
                          }}
                          className='w-full text-left px-3 py-1.5 text-xs font-mono
                                     text-red-400 hover:bg-slate-700 transition-colors'
                        >
                          Confirm delete?
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteSetlist(true)}
                          className='w-full text-left px-3 py-1.5 text-xs font-mono
                                     text-slate-400 hover:bg-slate-700 transition-colors'
                        >
                          Delete
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

            {/* Song search */}
            <input
              type='text'
              placeholder='Search songs...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5
                         border border-slate-700 focus:border-indigo-500
                         outline-none font-mono placeholder-slate-600'
            />

            {/* Search results (cross-setlist) */}
            {searchResults !== null ? (
              <div className='flex flex-col gap-0.5'>
                {searchResults.length === 0 && (
                  <p className='text-xs text-slate-600 font-mono'>No matches.</p>
                )}
                {searchResults.map((result) => (
                  <button
                    key={`${result.songId}:${result.setlistId}`}
                    onClick={async () => {
                      if (result.setlistId !== activeSetlistId) {
                        switchSetlist(result.setlistId);
                      }
                      await setActiveSongId(result.songId);
                      await useTabStore.getState().loadTabsForSong(result.songId);
                      await useTabStore.getState().loadSheetsForSong(result.songId);
                      setSearchQuery('');
                    }}
                    className={`flex flex-col px-2 py-1.5 rounded text-left transition-colors
                               hover:bg-slate-800 ${
                                 result.songId === activeSongId
                                   ? 'bg-slate-800 text-slate-100'
                                   : 'text-slate-400'
                               }`}
                  >
                    <span className='text-xs font-mono truncate'>{result.title}</span>
                    {result.setlistId !== activeSetlistId && (
                      <span className='text-[10px] font-mono text-slate-600'>
                        in {result.setlistName}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
            /* Normal setlist view */
            <div className='flex flex-col gap-0.5'>
              {songOrder.length === 0 && (
                <p className='text-xs text-slate-600 font-mono'>No songs loaded.</p>
              )}
              {songOrder.map((item, idx) => {
                const songNumber = item.type === 'song'
                  ? songOrder.filter((it, i) => i <= idx && it.type === 'song').length
                  : 0;

                if (item.type === 'song') {
                  const song = songMap.get(item.songId);
                  if (!song) return null;

                  const otherSetlists = confirmDeleteSongId === song.id
                    ? useSetlistStore.getState().getSetlistsContainingSong(song.id)
                        .filter((s) => s.id !== activeSetlistId)
                    : [];

                  return (
                    <div
                      key={item.songId}
                      draggable={canEdit}
                      onDragStart={canEdit ? (e) => handleDragStart(e, idx) : undefined}
                      onDragOver={canEdit ? (e) => handleDragOver(e, idx) : undefined}
                      onDrop={canEdit ? (e) => handleDrop(e, idx) : undefined}
                      onDragEnd={canEdit ? handleDragEnd : undefined}
                      className='flex flex-col rounded transition-colors group'
                      style={{
                        backgroundColor: song.id === activeSongId ? '#1e293b' : 'transparent',
                        opacity: dragIndex === idx ? 0.4 : 1,
                        borderTop: dropIndex === idx && dragIndex !== null && dragIndex > idx
                          ? '2px solid #6366f1' : '2px solid transparent',
                        borderBottom: dropIndex === idx && dragIndex !== null && dragIndex < idx
                          ? '2px solid #6366f1' : '2px solid transparent',
                        cursor: canEdit ? 'default' : 'grab',
                      }}
                    >
                      <div className='flex items-center gap-1 px-2 py-1.5'
                           style={{ color: song.id === activeSongId ? '#f1f5f9' : '#94a3b8' }}>
                        {/* Reorder buttons */}
                        {canEdit && (
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
                        {canEdit && (
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

                        {/* Context menu (copy/move to setlist) */}
                        {canEdit && allSetlists.length > 1 && (
                        <div className='relative'
                             ref={songMenuId === song.id ? songMenuRef : undefined}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSongMenuId(songMenuId === song.id ? null : song.id);
                            }}
                            className='text-slate-600 hover:text-slate-300 transition-colors
                                       text-xs opacity-0 group-hover:opacity-100 font-mono'
                            title='Copy or move to another setlist'
                          >
                            ...
                          </button>
                          {songMenuId === song.id && (
                            <div className='absolute right-0 top-full mt-1 bg-slate-800 border
                                            border-slate-600 rounded-lg shadow-xl py-1 z-50
                                            min-w-[140px]'>
                              {allSetlists
                                .filter((sl) => sl.id !== activeSetlistId)
                                .map((sl) => (
                                  <div key={sl.id} className='flex flex-col'>
                                    <button
                                      onClick={async () => {
                                        await useSetlistStore.getState()
                                          .copySongToSetlist(song.id, sl.id);
                                        addToast(`Copied to "${sl.name}"`, 'info');
                                        setSongMenuId(null);
                                      }}
                                      className='w-full text-left px-3 py-1 text-xs font-mono
                                                 text-slate-300 hover:bg-slate-700
                                                 transition-colors'
                                    >
                                      Copy to {sl.name}
                                    </button>
                                    <button
                                      onClick={async () => {
                                        await useSetlistStore.getState()
                                          .moveSongToSetlist(song.id, sl.id);
                                        addToast(`Moved to "${sl.name}"`, 'info');
                                        setSongMenuId(null);
                                      }}
                                      className='w-full text-left px-3 py-1 text-xs font-mono
                                                 text-slate-400 hover:bg-slate-700
                                                 transition-colors'
                                    >
                                      Move to {sl.name}
                                    </button>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                        )}

                        {/* Delete button */}
                        {canEdit && (
                        <button
                          onClick={() => handleDeleteSong(song.id)}
                          className='text-slate-600 hover:text-red-400 transition-colors text-xs
                                     opacity-0 group-hover:opacity-100'
                          title='Remove song'
                        >
                          <X size={ICON_SIZE.ACTION} />
                        </button>
                        )}
                      </div>

                      {/* Delete warning: song referenced in other setlists */}
                      {confirmDeleteSongId === song.id && otherSetlists.length > 0 && (
                        <div className='px-2 pb-1.5 flex flex-col gap-1'>
                          <span className='text-[10px] font-mono text-amber-400'>
                            Also in: {otherSetlists.map((s) => s.name).join(', ')}
                          </span>
                          <div className='flex gap-2'>
                            <button
                              onClick={() => handleDeleteSong(song.id)}
                              className='text-[10px] font-mono text-red-400
                                         hover:text-red-300 transition-colors'
                            >
                              Delete anyway
                            </button>
                            <button
                              onClick={() => setConfirmDeleteSongId(null)}
                              className='text-[10px] font-mono text-slate-500
                                         hover:text-slate-300 transition-colors'
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Pause item
                if (!canEdit) {
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
                      cursor: canEdit ? 'grab' : 'default',
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
              {canEdit && songOrder.length > 0 && (
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
            )}
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
                onClick={() => {
                  handleExportSetlist();
                  setShowImportExport(false);
                }}
                disabled={songOrder.length === 0}
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
          onImported={async (result) => {
            for (const song of result.songs) {
              await addSong(song);
            }
            await createSetlist(result.name);
            await useSetlistStore.getState().setActiveItems(result.items);
            if (result.songs.length > 0) {
              await setActiveSongId(result.songs[0].id);
              await useTabStore.getState().loadTabsForSong(result.songs[0].id);
              await useTabStore.getState().loadSheetsForSong(result.songs[0].id);
            }
          }}
        />
      )}
      </>
      )}
    </aside>
  );
}