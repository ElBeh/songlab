import { useState } from 'react';
import { useLoopStore } from '../../stores/useLoopStore';

interface LoopControlsProps {
  songLoop: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * A/B mode, loop toggle, loop info, counter, target input, and clear loop.
 * Shared between Practice and Band mode.
 */
export function LoopControls({ songLoop }: LoopControlsProps) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetValue, setTargetValue] = useState('');

  const loop = useLoopStore((state) => state.loop);
  const loopEnabled = useLoopStore((state) => state.loopEnabled);
  const abMode = useLoopStore((state) => state.abMode);
  const abStart = useLoopStore((state) => state.abStart);
  const toggleLoop = useLoopStore((state) => state.toggleLoop);
  const toggleAbMode = useLoopStore((state) => state.toggleAbMode);
  const clearLoop = useLoopStore((state) => state.clearLoop);
  const loopCount = useLoopStore((state) => state.loopCount);
  const loopTarget = useLoopStore((state) => state.loopTarget);
  const setLoopTarget = useLoopStore((state) => state.setLoopTarget);

  return (
    <>
      {/* A/B Mode toggle */}
      <button
        onClick={toggleAbMode}
        className='px-3 py-1 rounded font-mono text-xs transition-colors'
        style={{
          backgroundColor: abMode ? '#f59e0b' : '#334155',
          color: abMode ? '#000' : '#94a3b8',
        }}
        title='Toggle A/B mode'
      >
        {abMode ? (abStart === null ? '▸ click A' : '▸ click B') : 'A/B'}
      </button>

      {/* Loop toggle */}
      <button
        onClick={toggleLoop}
        disabled={!loop}
        className='px-3 py-1 rounded font-mono text-xs transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed'
        style={{
          backgroundColor: loopEnabled ? '#6366f1' : '#334155',
          color: loopEnabled ? '#fff' : '#94a3b8',
        }}
        title='Toggle loop (L)'
      >
        ↺ Loop
      </button>

      {/* Active loop info */}
      {loop && (
        <span className='text-xs font-mono text-slate-400'>
          {loop.label && (
            <span className='mr-1.5 px-1.5 py-0.5 rounded text-white text-xs'
              style={{ backgroundColor: '#6366f1' }}>
              {loop.label}
            </span>
          )}
          {formatTime(loop.start)} – {formatTime(loop.end)}
        </span>
      )}

      {/* Loop counter – shows for section loops AND song loops */}
      {(loop || songLoop) && loopCount > 0 && (
        <span className='text-xs font-mono px-1.5 py-0.5 rounded bg-slate-700 text-indigo-300'>
          {loopTarget !== null
            ? `${loopCount} / ${loopTarget}`
            : `×${loopCount}`}
        </span>
      )}

      {/* Loop target input – click to set how many times to loop */}
      {(loop || songLoop) && (
        editingTarget ? (
          <input
            autoFocus
            type='number'
            min={1}
            max={999}
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            onBlur={() => {
              const val = parseInt(targetValue, 10);
              setLoopTarget(val > 0 ? val : null);
              setEditingTarget(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = parseInt(targetValue, 10);
                setLoopTarget(val > 0 ? val : null);
                setEditingTarget(false);
              }
              if (e.key === 'Escape') setEditingTarget(false);
            }}
            className='w-12 bg-slate-700 text-slate-100 font-mono text-xs
                       rounded px-1 py-0.5 border border-indigo-500 outline-none
                       text-center'
            placeholder='∞'
          />
        ) : (
          <button
            onClick={() => {
              setTargetValue(loopTarget !== null ? String(loopTarget) : '');
              setEditingTarget(true);
            }}
            className='px-1.5 py-0.5 rounded font-mono text-xs transition-colors
                       bg-slate-700 text-slate-400 hover:text-slate-200'
            title='Set loop target count (click to edit, empty = infinite)'
          >
            {loopTarget !== null ? `${loopTarget} loops` : 'set loops'}
          </button>
        )
      )}

      {/* Clear loop */}
      {loop && (
        <button
          onClick={clearLoop}
          className='px-3 py-1 rounded font-mono text-xs bg-slate-700
                     hover:bg-red-900 text-slate-400 hover:text-red-300 transition-colors'
        >
          ✕ clear loop
        </button>
      )}
    </>
  );
}