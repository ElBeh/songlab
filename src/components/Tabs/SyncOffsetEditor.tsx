import { useCallback } from 'react';

interface SyncOffsetEditorProps {
  /** Current sync offset in ms (null = not set) */
  syncOffset: number | null;
  /** Additive BPM correction (null = not set, 0 = no correction) */
  bpmAdjust: number | null;
  /** Current audio position in seconds (from wavesurfer) */
  currentTime: number;
  onSyncOffsetChange: (offset: number) => void;
  onBpmAdjustChange: (adjust: number) => void;
}

/** Format milliseconds as M:SS.mmm */
function formatMs(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

export function SyncOffsetEditor({
  syncOffset,
  bpmAdjust,
  currentTime,
  onSyncOffsetChange,
  onBpmAdjustChange,
}: SyncOffsetEditorProps) {
  const offset = syncOffset ?? 0;
  const adjust = bpmAdjust ?? 0;

  const handleSetAtCurrent = useCallback(() => {
    onSyncOffsetChange(Math.round(currentTime * 1000));
  }, [currentTime, onSyncOffsetChange]);

  const handleNudgeOffset = useCallback((deltaMs: number) => {
    onSyncOffsetChange(Math.max(0, offset + deltaMs));
  }, [offset, onSyncOffsetChange]);

  const handleResetOffset = useCallback(() => {
    onSyncOffsetChange(0);
  }, [onSyncOffsetChange]);

  const handleNudgeBpm = useCallback((delta: number) => {
    // Round to 1 decimal to avoid floating point drift
    onBpmAdjustChange(Math.round((adjust + delta) * 10) / 10);
  }, [adjust, onBpmAdjustChange]);

  const handleResetBpm = useCallback(() => {
    onBpmAdjustChange(0);
  }, [onBpmAdjustChange]);

  return (
    <div className='flex items-center gap-3 flex-wrap'>
      {/* --- Offset section --- */}
      <div className='flex items-center gap-1.5'>
        <span className='text-xs font-mono text-slate-400'>⚓ Offset:</span>

        <span className='text-xs font-mono text-slate-200 bg-slate-700 px-2 py-0.5 rounded
                         min-w-20 text-center'>
          {formatMs(offset)}
        </span>

        <div className='flex items-center gap-0.5'>
          <button
            onClick={() => handleNudgeOffset(-100)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='-100ms'
          >
            ⏪
          </button>
          <button
            onClick={() => handleNudgeOffset(-10)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='-10ms'
          >
            ◀
          </button>
          <button
            onClick={() => handleNudgeOffset(10)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='+10ms'
          >
            ▶
          </button>
          <button
            onClick={() => handleNudgeOffset(100)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='+100ms'
          >
            ⏩
          </button>
        </div>

        <button
          onClick={handleSetAtCurrent}
          className='px-2 py-0.5 text-xs font-mono rounded transition-colors
                     bg-indigo-600 hover:bg-indigo-500 text-white'
          title={`Set offset to current position: ${formatMs(currentTime * 1000)}`}
        >
          Set @ {formatMs(currentTime * 1000)}
        </button>

        {offset > 0 && (
          <button
            onClick={handleResetOffset}
            className='px-1 py-0.5 text-xs rounded text-slate-500 hover:text-red-400
                       transition-colors'
            title='Reset offset to 0ms'
          >
            ✕
          </button>
        )}
      </div>

      {/* --- BPM adjust section --- */}
      <div className='flex items-center gap-1.5'>
        <span className='text-xs font-mono text-slate-400'>BPM:</span>

        <span className='text-xs font-mono text-slate-200 bg-slate-700 px-2 py-0.5 rounded
                         min-w-14 text-center'
               style={{ color: adjust !== 0 ? '#fbbf24' : undefined }}>
          {adjust >= 0 ? '+' : ''}{adjust.toFixed(1)}
        </span>

        <div className='flex items-center gap-0.5'>
          <button
            onClick={() => handleNudgeBpm(-1)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='-1.0 BPM'
          >
            ⏪
          </button>
          <button
            onClick={() => handleNudgeBpm(-0.1)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='-0.1 BPM'
          >
            ◀
          </button>
          <button
            onClick={() => handleNudgeBpm(0.1)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='+0.1 BPM'
          >
            ▶
          </button>
          <button
            onClick={() => handleNudgeBpm(1)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='+1.0 BPM'
          >
            ⏩
          </button>
        </div>

        {adjust !== 0 && (
          <button
            onClick={handleResetBpm}
            className='px-1 py-0.5 text-xs rounded text-slate-500 hover:text-red-400
                       transition-colors'
            title='Reset BPM adjustment to 0'
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}