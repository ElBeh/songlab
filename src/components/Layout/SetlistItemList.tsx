import { useState, useRef, useMemo, useCallback } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useSetlistStore } from '../../stores/useSetlistStore';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useTabStore } from '../../stores/useTabStore';
import { useToastStore } from '../../stores/useToastStore';
import { ChevronUp, ChevronDown, Pencil, X } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';
import { useShallow } from 'zustand/shallow';

interface SetlistItemListProps {
  /** Read-only mode: item interactions are disabled */
  isViewer: boolean;
  /** Whether editing actions (reorder, rename, delete, add) are allowed */
  canEdit: boolean;
  /** Opens the audio/GP file picker */
  onAddSong?: () => void;
  /** Opens the dummy song creation dialog */
  onCreateDummy?: () => void;
}

/**
 * Setlist content: song search with cross-setlist results, the ordered
 * song/pause list with drag & drop reordering, per-item actions
 * (rename, copy/move, delete with cross-setlist warning) and the
 * add song / add pause actions. Extracted from Sidebar (C5 split, block 3).
 */
export function SetlistItemList({ isViewer, canEdit, onAddSong, onCreateDummy }: SetlistItemListProps) {
  // Pause edit state
  const [editingPauseId, setEditingPauseId] = useState<string | null>(null);
  const [editingPauseValue, setEditingPauseValue] = useState('');
  // Drag & drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
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
  // Add song menu state
  const [showAddSongMenu, setShowAddSongMenu] = useState(false);
  const addSongRef = useRef<HTMLDivElement>(null);

  // Close dropdowns / menus on outside click
  useClickOutside(addSongRef, () => setShowAddSongMenu(false), showAddSongMenu);
  useClickOutside(songMenuRef, () => setSongMenuId(null), !!songMenuId);

  // --- Song store ---
  const songs = useSongStore((state) => state.songs);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const removeSong = useSongStore((state) => state.removeSong);
  const updateSong = useSongStore((state) => state.updateSong);

  // --- Setlist store ---
  const allSetlists = useSetlistStore((state) => state.setlists);
  const activeSetlistId = useSetlistStore((state) => state.activeSetlistId);
  const songOrder = useSetlistStore(useShallow((state) => {
    const active = state.setlists.find((s) => s.id === state.activeSetlistId);
    return active?.items ?? [];
  }));
  const moveItem = useSetlistStore((state) => state.moveItem);
  const reorderItem = useSetlistStore((state) => state.reorderItem);
  const addPause = useSetlistStore((state) => state.addPause);
  const updatePause = useSetlistStore((state) => state.updatePause);
  const removePause = useSetlistStore((state) => state.removePause);
  const switchSetlist = useSetlistStore((state) => state.switchSetlist);

  const addToast = useToastStore((state) => state.addToast);

  // Build a song lookup for rendering
  const songMap = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

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

  return (
    <>
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
                    disabled={isViewer}
                    onClick={isViewer ? undefined : async () => {
                      if (result.setlistId !== activeSetlistId) {
                        switchSetlist(result.setlistId);
                      }
                      await setActiveSongId(result.songId);
                      await useTabStore.getState().loadTabsForSong(result.songId);
                      await useTabStore.getState().loadSheetsForSong(result.songId);
                      setSearchQuery('');
                    }}
                    className={`flex flex-col px-2 py-1.5 rounded text-left transition-colors
                               ${isViewer ? 'cursor-default' : 'hover:bg-slate-800'}
                               ${result.songId === activeSongId
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

              {/* Add song / add pause actions */}
              {canEdit && (
                <div className='flex justify-center gap-2 p-3'>
                  <div className='relative' ref={addSongRef}>
                    <button
                      onClick={() => setShowAddSongMenu((v) => !v)}
                      className='px-3 py-1.5 text-xs font-mono text-slate-300
                                 bg-slate-800 border border-dashed border-slate-600
                                 hover:text-slate-200 hover:border-slate-400 rounded
                                 transition-colors'
                    >
                      + add song
                    </button>
                    {showAddSongMenu && (
                      <div className='absolute left-0 bottom-full mb-1 bg-slate-800 border
                                      border-slate-600 rounded-lg shadow-xl py-1 z-50 min-w-[180px]'>
                        <button
                          onClick={() => { setShowAddSongMenu(false); onAddSong?.(); }}
                          className='w-full text-left px-3 py-1.5 text-xs font-mono
                                     text-slate-300 hover:bg-slate-700 transition-colors'
                        >
                          Load audio / GP file
                        </button>
                        <button
                          onClick={() => { setShowAddSongMenu(false); onCreateDummy?.(); }}
                          className='w-full text-left px-3 py-1.5 text-xs font-mono
                                     text-slate-300 hover:bg-slate-700 transition-colors'
                        >
                          Create without audio
                        </button>
                      </div>
                    )}
                  </div>
                  {songOrder.length > 0 && (
                    <button
                      onClick={() => addPause(songOrder.length - 1)}
                      className='px-3 py-1.5 text-xs font-mono text-slate-300
                                 bg-slate-800 border border-dashed border-slate-600
                                 hover:text-slate-200 hover:border-slate-400 rounded
                                 transition-colors'
                    >
                      + add pause
                    </button>
                  )}
                </div>
              )}
            </div>
            )}

    </>
  );
}