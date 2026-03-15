import { useState } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useTabStore } from '../../stores/useTabStore';

interface SongTabsProps {
  onAddSong: () => void;
}

export function SongTabs({ onAddSong }: SongTabsProps) {
  const getOrderedSongs = useSongStore((state) => state.getOrderedSongs);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const removeSong = useSongStore((state) => state.removeSong);

  // Subscribe to songOrder so tabs re-render on reorder
  useSongStore((state) => state.songOrder);

  const orderedSongs = getOrderedSongs();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
            <span className='max-w-36 truncate'>{song.title}</span>
            {confirmDeleteId === song.id ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
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

      {/* Add song button */}
      <button
        onClick={onAddSong}
        className='px-3 py-1.5 rounded-t-lg font-mono text-sm text-slate-500
                   hover:text-slate-300 transition-colors shrink-0'
        title='Load new song'
      >
        + song
      </button>
    </div>
  );
}