import { useCountInStore } from '../../stores/useCountInStore';
import { useSongStore } from '../../stores/useSongStore';
import { ensureAudioReady } from '../../services/clickSoundGenerator';

export function CountInToggle() {
  const enabled = useCountInStore((s) => s.enabled);
  const toggle = useCountInStore((s) => s.toggle);
  const activeSong = useSongStore((s) => s.getActiveSong)();
  const updateSong = useSongStore((s) => s.updateSong);

  const hasBpm = !!activeSong?.bpm;

  const handleToggle = () => {
    // Warm up AudioContext on enable (user gesture required)
    if (!enabled) ensureAudioReady();
    toggle();
  };

  return (
    <div className='flex items-center gap-3'>
      <button
        onClick={handleToggle}
        disabled={!hasBpm}
        className='px-3 py-1 rounded font-mono text-xs transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed'
        style={{
          backgroundColor: enabled && hasBpm ? '#6366f1' : '#334155',
          color: enabled && hasBpm ? '#fff' : '#94a3b8',
        }}
        title={hasBpm ? 'Toggle count-in before playback' : 'Set BPM to enable count-in'}
        aria-pressed={enabled && hasBpm}
      >
        Count-in
      </button>

      {activeSong && (
        <>
          <div className='w-px h-6 bg-slate-600' />
          <input
            type='number'
            min={20}
            max={300}
            placeholder='BPM'
            value={activeSong.bpm ?? ''}
            onChange={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value);
              updateSong({ ...activeSong, bpm: val });
            }}
            className='w-16 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1
                       border border-slate-600 focus:border-indigo-500 outline-none
                       font-mono text-center'
            aria-label='Song BPM'
          />
          <select
            value={activeSong.timeSignature
              ? `${activeSong.timeSignature[0]}/${activeSong.timeSignature[1]}`
              : '4/4'}
            onChange={(e) => {
              const [num, den] = e.target.value.split('/').map(Number);
              updateSong({ ...activeSong, timeSignature: [num, den] });
            }}
            className='bg-slate-700 text-slate-200 text-xs rounded px-2 py-1
                       border border-slate-600 focus:border-indigo-500 outline-none
                       font-mono'
            aria-label='Time signature'
          >
            <option value='2/4'>2/4</option>
            <option value='3/4'>3/4</option>
            <option value='4/4'>4/4</option>
            <option value='5/4'>5/4</option>
            <option value='6/8'>6/8</option>
            <option value='7/8'>7/8</option>
          </select>
        </>
      )}
    </div>
  );
}