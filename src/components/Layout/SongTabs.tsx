import { useSongStore } from '../../stores/useSongStore';

interface SongTabsProps {
  onAddSong: () => void;
}

export function SongTabs({ onAddSong }: SongTabsProps) {
  const songs = useSongStore((state) => state.songs);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const removeSong = useSongStore((state) => state.removeSong);

  return (
    <div className='flex items-center gap-1 overflow-x-auto'>
      {songs.map((song) => {
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
            onClick={() => setActiveSongId(song.id)}
          >
            <span className='max-w-36 truncate'>{song.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeSong(song.id);
              }}
              className='text-slate-600 hover:text-red-400 transition-colors text-xs'
              title='Remove song'
            >
              ✕
            </button>
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