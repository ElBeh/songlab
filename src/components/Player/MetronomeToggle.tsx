import { useMetronomeStore } from '../../stores/useMetronomeStore';
import { ensureAudioReady } from '../../services/clickSoundGenerator';

interface MetronomeToggleProps {
  /** Whether we're in solo mode (no song BPM) */
  isSoloMode: boolean;
  /** Whether the metronome is currently running */
  isRunning: boolean;
  /** Start solo metronome */
  onStartSolo: () => void;
  /** Stop solo metronome */
  onStopSolo: () => void;
}

export function MetronomeToggle({
  isSoloMode,
  isRunning,
  onStartSolo,
  onStopSolo,
}: MetronomeToggleProps) {
  const enabled = useMetronomeStore((s) => s.enabled);
  const toggle = useMetronomeStore((s) => s.toggle);
  const volume = useMetronomeStore((s) => s.volume);
  const setVolume = useMetronomeStore((s) => s.setVolume);
  const soloBpm = useMetronomeStore((s) => s.soloBpm);
  const soloTimeSignature = useMetronomeStore((s) => s.soloTimeSignature);
  const setSoloBpm = useMetronomeStore((s) => s.setSoloBpm);
  const setSoloTimeSignature = useMetronomeStore((s) => s.setSoloTimeSignature);

  const handleToggle = () => {
    if (!enabled) ensureAudioReady();
    toggle();
    // Stop solo metronome when disabling
    if (enabled && isRunning && isSoloMode) {
      onStopSolo();
    }
  };

  const handleSoloPlayStop = () => {
    ensureAudioReady();
    if (isRunning) {
      onStopSolo();
    } else {
      onStartSolo();
    }
  };

  return (
    <div className='flex items-center gap-3'>
      <button
        onClick={handleToggle}
        className='px-3 py-1 rounded font-mono text-xs transition-colors'
        style={{
          backgroundColor: enabled ? '#6366f1' : '#334155',
          color: enabled ? '#fff' : '#94a3b8',
        }}
        title='Toggle metronome'
        aria-pressed={enabled}
      >
        Metronome
      </button>

      {enabled && (
        <>
          <input
            type='range'
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className='w-20 h-1 accent-indigo-500 cursor-pointer'
            title={`Metronome volume: ${Math.round(volume * 100)}%`}
            aria-label='Metronome volume'
          />
          <span className='text-[10px] font-mono text-slate-500 w-7 text-right'>
            {Math.round(volume * 100)}%
          </span>
        </>
      )}

      {enabled && isSoloMode && (
        <>
          <div className='w-px h-6 bg-slate-600' />
          <button
            onClick={handleSoloPlayStop}
            className='w-7 h-7 flex items-center justify-center rounded-full
                       text-white transition-colors text-xs'
            style={{
              backgroundColor: isRunning ? '#ef4444' : '#22c55e',
            }}
            title={isRunning ? 'Stop metronome' : 'Start metronome'}
            aria-label={isRunning ? 'Stop metronome' : 'Start metronome'}
          >
            {isRunning ? '⏹' : '▶'}
          </button>
          <input
            type='number'
            min={20}
            max={300}
            value={soloBpm}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) setSoloBpm(val);
            }}
            className='w-16 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1
                       border border-slate-600 focus:border-indigo-500 outline-none
                       font-mono text-center'
            aria-label='Solo BPM'
          />
          <select
            value={`${soloTimeSignature[0]}/${soloTimeSignature[1]}`}
            onChange={(e) => {
              const [num, den] = e.target.value.split('/').map(Number);
              setSoloTimeSignature([num, den]);
            }}
            className='bg-slate-700 text-slate-200 text-xs rounded px-2 py-1
                       border border-slate-600 focus:border-indigo-500 outline-none
                       font-mono'
            aria-label='Solo time signature'
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