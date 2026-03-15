import { useState } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useTabStore } from '../../stores/useTabStore';
import { useToastStore } from '../../stores/useToastStore';

interface CreateDummySongDialogProps {
  onClose: () => void;
}

export function CreateDummySongDialog({ onClose }: CreateDummySongDialogProps) {
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(3);
  const [seconds, setSeconds] = useState(30);

  const addSong = useSongStore((state) => state.addSong);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const addToast = useToastStore((state) => state.addToast);

  const totalSeconds = minutes * 60 + seconds;
  const isValid = title.trim().length > 0 && totalSeconds > 0;

  const handleCreate = async () => {
    if (!isValid) return;

    const id = `dummy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const song = {
      id,
      title: title.trim(),
      fileName: '',
      fileSize: 0,
      duration: totalSeconds,
      createdAt: Date.now(),
      volume: 1.0,
      normalizationGain: 1.0,
      normalizationEnabled: false,
      isDummy: true,
    };

    await addSong(song);
    await setActiveSongId(song.id);
    await useTabStore.getState().loadTabsForSong(song.id);
    await useTabStore.getState().loadSheetsForSong(song.id);
    addToast(`Created "${song.title}" (no audio)`, 'success');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) handleCreate();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
      onClick={onClose}
    >
      <div
        className='bg-slate-800 border border-slate-700 rounded-xl p-6 w-80
                   flex flex-col gap-4 shadow-2xl'
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 className='text-sm font-mono text-slate-200 uppercase tracking-widest'>
          Create song without audio
        </h2>

        {/* Title input */}
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-mono text-slate-500'>Title</label>
          <input
            type='text'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Song title...'
            autoFocus
            className='bg-slate-900 text-slate-200 text-sm rounded px-3 py-2
                       border border-slate-600 focus:border-indigo-500 outline-none
                       font-mono'
          />
        </div>

        {/* Duration input */}
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-mono text-slate-500'>Duration</label>
          <div className='flex items-center gap-2'>
            <input
              type='number'
              min={0}
              max={99}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              className='bg-slate-900 text-slate-200 text-sm rounded px-3 py-2 w-16
                         border border-slate-600 focus:border-indigo-500 outline-none
                         font-mono text-center'
            />
            <span className='text-slate-500 font-mono text-sm'>min</span>
            <input
              type='number'
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
              className='bg-slate-900 text-slate-200 text-sm rounded px-3 py-2 w-16
                         border border-slate-600 focus:border-indigo-500 outline-none
                         font-mono text-center'
            />
            <span className='text-slate-500 font-mono text-sm'>sec</span>
          </div>
        </div>

        {/* Buttons */}
        <div className='flex justify-end gap-2 mt-2'>
          <button
            onClick={onClose}
            className='px-4 py-2 text-xs font-mono text-slate-400 hover:text-slate-200
                       transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid}
            className='px-4 py-2 text-xs font-mono bg-indigo-500 hover:bg-indigo-400
                       text-white rounded-lg transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed'
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}