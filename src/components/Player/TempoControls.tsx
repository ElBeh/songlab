import { useTempoStore } from '../../stores/useTempoStore';

const PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
];

export function TempoControls() {
  const playbackRate = useTempoStore((state) => state.playbackRate);
  const preservePitch = useTempoStore((state) => state.preservePitch);
  const setPlaybackRate = useTempoStore((state) => state.setPlaybackRate);
  const togglePreservePitch = useTempoStore((state) => state.togglePreservePitch);

  return (
    <div className='flex items-center gap-3 flex-wrap'>
      <span className='text-xs font-mono text-slate-400'>Speed</span>

      {/* Presets */}
      {PRESETS.map((preset) => (
        <button
          key={preset.value}
          onClick={() => setPlaybackRate(preset.value)}
          className='px-2 py-1 rounded font-mono text-xs transition-colors'
          style={{
            backgroundColor: playbackRate === preset.value ? '#6366f1' : '#334155',
            color: playbackRate === preset.value ? '#fff' : '#94a3b8',
          }}
        >
          {preset.label}
        </button>
      ))}

      {/* Slider */}
      <input
        type='range'
        min={0.5}
        max={1.5}
        step={0.05}
        value={playbackRate}
        onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
        className='w-32 accent-indigo-500'
      />

      {/* Current value */}
      <span className='text-xs font-mono text-slate-300 w-10'>
        {Math.round(playbackRate * 100)}%
      </span>

      {/* Divider */}
      <div className='w-px h-6 bg-slate-600 mx-1' />

      {/* Pitch correction */}
      <button
        onClick={togglePreservePitch}
        className='px-3 py-1 rounded font-mono text-xs transition-colors'
        style={{
          backgroundColor: preservePitch ? '#22c55e' : '#334155',
          color: preservePitch ? '#fff' : '#94a3b8',
        }}
        title='Preserve pitch when changing speed'
      >
        🎵 pitch lock
      </button>
    </div>
  );
}