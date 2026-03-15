import { useState, useRef, useEffect } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useTabStore } from '../../stores/useTabStore';
import { useToastStore } from '../../stores/useToastStore';

interface SongTabsProps {
  onAddSong: () => void;
  onCreateDummy: () => void;
}

export function SongTabs({ onAddSong, onCreateDummy }: SongTabsProps) {
  const getOrderedSongs = useSongStore((state) => state.getOrderedSongs);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const removeSong = useSongStore((state) => state.removeSong);

  // Subscribe to songOrder so tabs re-render on reorder
  useSongStore((state) => state.songOrder);

  const orderedSongs = getOrderedSongs();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const addToast = useToastStore((state) => state.addToast);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  return (
    <div className='flex items-center gap-1 overflow-x-auto'>
      {orderedSongs.map((song) => {
        const isActive = song.id === activeSongId;
        return (
          <div
            key={song.id}
            className='flex items-center gap-2 px-3 py-1.5 rounded-t-lg font-mono
                       text-sm cursor-pointer transition-colors shrink-0'
            style={{
              backgroundColor: isActive ? '#1e293b' : '#0f172a',
              color: isActive ? '#f1f5f9' : '#64748b',
              borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
            }}
            onClick={async () => {
              await setActiveSongId(song.id);
              await useTabStore.getState().loadTabsForSong(song.id);
              await useTabStore.getState().loadSheetsForSong(song.id); // neu
            }}
          >
            {song.isDummy && (
              <span className='text-[10px] text-slate-600' title='No audio file'>📝</span>
            )}
            <span className='max-w-36 truncate'>{song.title}</span>
            {confirmDeleteId === song.id ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToast(`Removed "${song.title}"`, 'info');
                  removeSong(song.id);
                  setConfirmDeleteId(null);
                }}
                onBlur={() => setConfirmDeleteId(null)}
                className='text-red-400 hover:text-red-300 transition-colors text-xs
                           font-mono'
                autoFocus
                title='Confirm delete'
              >
                sure?
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(song.id);
                }}
                className='text-slate-600 hover:text-red-400 transition-colors text-xs'
                title='Remove song'
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {/* Add song dropdown */}
      <div className='shrink-0'>
        <button
          ref={btnRef}
          onClick={() => {
            if (btnRef.current) {
              const rect = btnRef.current.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, left: rect.left });
            }
            setShowMenu((v) => !v);
          }}
          className='px-3 py-1.5 rounded-t-lg font-mono text-lg text-slate-500
                     hover:text-slate-300 transition-colors'
          title='Add song'
        >
          +
        </button>
      </div>
      {showMenu && (
        <div
          ref={menuRef}
          className='fixed bg-slate-800 border border-slate-700
                     rounded-lg shadow-xl py-1 z-50 min-w-44'
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <button
            onClick={() => { setShowMenu(false); onAddSong(); }}
            className='w-full text-left px-4 py-2 text-sm font-mono text-slate-300
                       hover:bg-slate-700 hover:text-white transition-colors'
          >
            🎵 Load audio file
          </button>
          <button
            onClick={() => { setShowMenu(false); onCreateDummy(); }}
            className='w-full text-left px-4 py-2 text-sm font-mono text-slate-300
                       hover:bg-slate-700 hover:text-white transition-colors'
          >
            📝 Create without audio
          </button>
        </div>
      )}
    </div>
  );
}