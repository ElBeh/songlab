import { useMetronomeStore } from '../../stores/useMetronomeStore';
import { useSongStore } from '../../stores/useSongStore';
import { ensureAudioReady } from '../../services/clickSoundGenerator';
import { Popover } from '../Common/Popover';

interface MetronomeSplitButtonProps {
  /** Whether we're in solo mode (no song BPM) */
  isSoloMode: boolean;
  /** Whether the metronome is currently running */
  isRunning: boolean;
  /** Start solo metronome */
  onStartSolo: () => void;
  /** Stop solo metronome */
  onStopSolo: () => void;
}

/**
 * Compact metronome control for session mode. Combines a toggle (main click)
 * with a chevron that opens a popover containing volume, BPM, time signature,
 * and solo playback controls.
 *
 * BPM and time signature edit the active song directly. When the metronome is
 * running with a tempo map, live values are shown read-only.
 */
export function MetronomeSplitButton({
  isSoloMode,
  isRunning,
  onStartSolo,
  onStopSolo,
}: MetronomeSplitButtonProps) {
  const enabled = useMetronomeStore((s) => s.enabled);
  const toggle = useMetronomeStore((s) => s.toggle);
  const volume = useMetronomeStore((s) => s.volume);
  const setVolume = useMetronomeStore((s) => s.setVolume);
  const effectiveBpm = useMetronomeStore((s) => s.effectiveBpm);
  const effectiveBeatsPerBar = useMetronomeStore((s) => s.effectiveBeatsPerBar);

  const activeSong = useSongStore((s) => s.getActiveSong)();
  const updateSong = useSongStore((s) => s.updateSong);

  const showEffective = isRunning && effectiveBpm !== null;
  const displayBpm = showEffective ? effectiveBpm : (activeSong?.bpm ?? null);
  const displayTimeSig =
    showEffective && effectiveBeatsPerBar !== null
      ? `${effectiveBeatsPerBar}/4`
      : activeSong?.timeSignature
        ? `${activeSong.timeSignature[0]}/${activeSong.timeSignature[1]}`
        : '4/4';

  const handleToggle = () => {
    if (!enabled) ensureAudioReady();
    toggle();
    if (enabled && isRunning && isSoloMode) {
      onStopSolo();
    }
  };

  const handleSoloPlayStop = () => {
    ensureAudioReady();
    if (isRunning) onStopSolo();
    else onStartSolo();
  };

  return (
    <div className='inline-flex items-stretch gap-1'>
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

      <Popover
        side='bottom'
        align='right'
        trigger={<span aria-hidden='true'>▾</span>}
        triggerAriaLabel='Metronome settings'
        triggerClassName='px-3 py-1 rounded font-mono text-xs
                          bg-slate-700 hover:bg-slate-600
                          text-slate-300 hover:text-white transition-colors'
        panelClassName='bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl'
      >
        <div className='flex flex-col gap-3 min-w-56'>
          {/* Volume */}
          <div className='flex items-center gap-2'>
            <span className='text-slate-400 text-xs font-mono w-14'>Volume</span>
            <input
              type='range'
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className='flex-1 h-1 accent-indigo-500 cursor-pointer'
              aria-label='Metronome volume'
            />
            <span className='text-[10px] font-mono text-slate-500 w-8 text-right'>
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* BPM */}
          {activeSong && (
            <div className='flex items-center gap-2'>
              <span className='text-slate-400 text-xs font-mono w-14'>BPM</span>
              {showEffective ? (
                <span
                  className='w-20 text-xs font-mono text-indigo-400 text-center'
                  title='Current BPM (from GP file tempo map)'
                >
                  {Math.round(displayBpm!)}
                </span>
              ) : (
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
                  className='w-20 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1
                             border border-slate-600 focus:border-indigo-500 outline-none
                             font-mono text-center'
                  aria-label='Song BPM'
                />
              )}
            </div>
          )}

          {/* Time Signature */}
          {activeSong && (
            <div className='flex items-center gap-2'>
              <span className='text-slate-400 text-xs font-mono w-14'>Time</span>
              {showEffective ? (
                <span
                  className='text-xs font-mono text-indigo-400'
                  title='Current time signature (from GP file)'
                >
                  {displayTimeSig}
                </span>
              ) : (
                <select
                  value={displayTimeSig}
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
              )}
            </div>
          )}

          {/* Solo Play/Stop */}
          {enabled && isSoloMode && (
            <>
              <div className='h-px bg-slate-700' />
              <div className='flex items-center gap-2'>
                <span className='text-slate-400 text-xs font-mono w-14'>Solo</span>
                <button
                  onClick={handleSoloPlayStop}
                  className='px-3 py-0.5 rounded font-mono text-xs text-white
                             transition-colors'
                  style={{
                    backgroundColor: isRunning ? '#ef4444' : '#22c55e',
                  }}
                  aria-label={isRunning ? 'Stop metronome' : 'Start metronome'}
                >
                  {isRunning ? 'Stop' : 'Start'}
                </button>
              </div>
            </>
          )}
        </div>
      </Popover>
    </div>
  );
}