import { useState } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useTabStore } from '../../stores/useTabStore';
import { useToastStore } from '../../stores/useToastStore';

interface CreateDummySongDialogProps {
  onClose: () => void;
}

type DurationMode = 'duration' | 'bpm';

export function CreateDummySongDialog({ onClose }: CreateDummySongDialogProps) {
  const [title, setTitle] = useState('');
  const [durationMode, setDurationMode] = useState<DurationMode>('duration');

  // Duration mode
  const [minutes, setMinutes] = useState(3);
  const [seconds, setSeconds] = useState(30);

  // BPM mode
  const [bpm, setBpm] = useState(120);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [beatUnit, setBeatUnit] = useState(4);
  const [barCount, setBarCount] = useState(16);

  const addSong = useSongStore((state) => state.addSong);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const addToast = useToastStore((state) => state.addToast);

  const totalSeconds =
    durationMode === 'duration'
      ? minutes * 60 + seconds
      : bpm > 0
        ? (barCount * beatsPerBar * 60 * 4) / (bpm * beatUnit)
        : 0;

  const isBpmValid = bpm > 0 && beatsPerBar > 0 && beatUnit > 0 && barCount > 0;
  const isValid =
    title.trim().length > 0 &&
    totalSeconds > 0 &&
    (durationMode === 'duration' || isBpmValid);

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
      gpFileName: null,
      syncOffset: null,
      bpmAdjust: null,
      syncPoints: null,
      bpm: durationMode === 'bpm' && bpm > 0 ? bpm : null,
      timeSignature: durationMode === 'bpm' && beatsPerBar > 0 && beatUnit > 0
        ? [beatsPerBar, beatUnit] as [number, number]
        : null,
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

        {/* Duration mode toggle */}
        <div className='flex flex-col gap-2'>
          <label className='text-xs font-mono text-slate-500'>Duration</label>
          <div className='flex gap-1'>
            <button
              type='button'
              onClick={() => setDurationMode('duration')}
              aria-pressed={durationMode === 'duration'}
              className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                durationMode === 'duration'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              Time
            </button>
            <button
              type='button'
              onClick={() => setDurationMode('bpm')}
              aria-pressed={durationMode === 'bpm'}
              className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                durationMode === 'bpm'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              BPM
            </button>
          </div>

          {durationMode === 'duration' ? (
            /* Manual duration input */
            <div className='flex items-center gap-2'>
              <input
                type='number'
                min={0}
                max={99}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                aria-label='Minutes'
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
                onChange={(e) =>
                  setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))
                }
                aria-label='Seconds'
                className='bg-slate-900 text-slate-200 text-sm rounded px-3 py-2 w-16
                           border border-slate-600 focus:border-indigo-500 outline-none
                           font-mono text-center'
              />
              <span className='text-slate-500 font-mono text-sm'>sec</span>
            </div>
          ) : (
            /* BPM-based duration input */
            <div className='flex flex-col gap-2'>
              <div className='flex items-center gap-2'>
                <input
                  type='number'
                  min={1}
                  max={999}
                  value={bpm}
                  onChange={(e) => setBpm(Math.max(0, parseInt(e.target.value) || 0))}
                  aria-label='BPM'
                  className='bg-slate-900 text-slate-200 text-sm rounded px-3 py-2 w-20
                             border border-slate-600 focus:border-indigo-500 outline-none
                             font-mono text-center'
                />
                <span className='text-slate-500 font-mono text-sm'>BPM</span>
              </div>
              <div className='flex items-center gap-2'>
                <input
                  type='number'
                  min={1}
                  max={32}
                  value={beatsPerBar}
                  onChange={(e) => setBeatsPerBar(Math.max(0, parseInt(e.target.value) || 0))}
                  aria-label='Beats per bar'
                  className='bg-slate-900 text-slate-200 text-sm rounded px-3 py-2 w-14
                             border border-slate-600 focus:border-indigo-500 outline-none
                             font-mono text-center'
                />
                <span className='text-slate-500 font-mono text-sm'>/</span>
                <input
                  type='number'
                  min={1}
                  max={32}
                  value={beatUnit}
                  onChange={(e) => setBeatUnit(Math.max(0, parseInt(e.target.value) || 0))}
                  aria-label='Beat unit'
                  className='bg-slate-900 text-slate-200 text-sm rounded px-3 py-2 w-14
                             border border-slate-600 focus:border-indigo-500 outline-none
                             font-mono text-center'
                />
                <span className='text-slate-500 font-mono text-sm'>time</span>
              </div>
              <div className='flex items-center gap-2'>
                <input
                  type='number'
                  min={1}
                  max={9999}
                  value={barCount}
                  onChange={(e) => setBarCount(Math.max(0, parseInt(e.target.value) || 0))}
                  aria-label='Number of bars'
                  className='bg-slate-900 text-slate-200 text-sm rounded px-3 py-2 w-20
                             border border-slate-600 focus:border-indigo-500 outline-none
                             font-mono text-center'
                />
                <span className='text-slate-500 font-mono text-sm'>bars</span>
              </div>
              {/* Calculated duration preview */}
              {totalSeconds > 0 && (
                <span className='text-xs font-mono text-indigo-400'>
                  = {Math.floor(totalSeconds / 60)}:
                  {Math.floor(totalSeconds % 60)
                    .toString()
                    .padStart(2, '0')}
                </span>
              )}
            </div>
          )}
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