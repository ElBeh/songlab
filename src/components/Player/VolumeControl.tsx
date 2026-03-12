import { useState } from 'react';
import { useSongStore } from '../../stores/useSongStore';

export function VolumeControl() {
  const activeSongId = useSongStore((state) => state.activeSongId);
  const songs = useSongStore((state) => state.songs);
  const updateSong = useSongStore((state) => state.updateSong);

  const activeSong = songs.find((s) => s.id === activeSongId) ?? null;
  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [lastSongId, setLastSongId] = useState<string | null>(activeSongId);

  if (activeSongId !== lastSongId) {
  setLocalVolume(null);
  setLastSongId(activeSongId);
  }

  if (!activeSong) return null;

  const displayVolume = localVolume ?? activeSong.volume ?? 1;
  const isNormalized = activeSong.normalizationGain !== 1.0;
  const isNormalizationActive = activeSong.normalizationEnabled ?? true;

  const handleVolumeCommit = async (value: number) => {
    setLocalVolume(null);
    await updateSong({ ...activeSong, volume: value });
  };

  const handleNormalizationToggle = async () => {
    await updateSong({ ...activeSong, normalizationEnabled: !isNormalizationActive });
  };

  return (
    <div className='flex items-center gap-3 font-mono text-xs'>
      <span className='text-slate-400'>🔊</span>

      <input
        type='range'
        min={0}
        max={1}
        step={0.01}
        value={displayVolume}
        onChange={(e) => setLocalVolume(parseFloat(e.target.value))}
        onMouseUp={(e) => handleVolumeCommit(parseFloat((e.target as HTMLInputElement).value))}
        className='w-24 accent-indigo-500'
        title={`Volume: ${Math.round(displayVolume * 100)}%`}
      />

      <span className='text-slate-400 w-8'>
        {Math.round(displayVolume * 100)}%
      </span>

      {isNormalized && (
        <button
          onClick={handleNormalizationToggle}
          className='px-1.5 py-0.5 rounded text-xs transition-colors'
          style={{
            backgroundColor: isNormalizationActive ? '#6366f1' : '#334155',
            color: isNormalizationActive ? '#fff' : '#64748b',
          }}
          title='Toggle loudness normalization'
        >
          normalized
        </button>
      )}
    </div>
  );
}