import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Rewind, ChevronLeft, ChevronRight, FastForward } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';

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

/** Format milliseconds as [−]M:SS.mmm */
function formatMs(ms: number): string {
  const sign = ms < 0 ? '−' : '';
  const abs = Math.abs(ms);
  const totalSec = abs / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${sign}${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

export function SyncOffsetEditor({
  syncOffset,
  bpmAdjust,
  currentTime,
  onSyncOffsetChange,
  onBpmAdjustChange,
}: SyncOffsetEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const offset = syncOffset ?? 0;
  const adjust = bpmAdjust ?? 0;

  // Capture currentTime at the moment of click, not reactively in the label
  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const handleSetAtCurrent = useCallback(() => {
    onSyncOffsetChange(Math.round(currentTimeRef.current * 1000));
  }, [onSyncOffsetChange]);

  const handleNudgeOffset = useCallback((deltaMs: number) => {
    onSyncOffsetChange(offset + deltaMs);
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

  const hasOffset = offset !== 0;
  const hasAdjust = adjust !== 0;

  // Collapsed: compact toggle showing current sync values as badge
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className='px-2 py-1 text-xs font-mono rounded transition-colors
                   bg-slate-700 hover:bg-slate-600 text-slate-300
                   flex items-center gap-1.5'
        title='Open sync offset editor'
      >
        Sync
        {(hasOffset || hasAdjust) && (
          <span className='text-indigo-400'>
            {hasOffset ? formatMs(offset) : ''}
            {hasOffset && hasAdjust ? ' · ' : ''}
            {hasAdjust ? `${adjust >= 0 ? '+' : ''}${adjust.toFixed(1)} BPM` : ''}
          </span>
        )}
      </button>
    );
  }

  // Expanded: full editor panel
  return (
    <div className='flex items-center gap-3 flex-wrap bg-slate-800/60 border border-slate-600
                    rounded-lg px-3 py-2'>
      {/* Collapse button */}
      <button
        onClick={() => setExpanded(false)}
        className='px-1.5 py-0.5 text-xs rounded text-slate-400 hover:text-white
                   hover:bg-slate-600 transition-colors'
        title='Close sync editor'
      >
        <X size={ICON_SIZE.ACTION} />
      </button>

      <div className='w-px h-4 bg-slate-600' />

      {/* --- Offset section --- */}
      <div className='flex items-center gap-1.5'>
        <span className='text-xs font-mono text-slate-400'>Offset:</span>

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
            <Rewind size={ICON_SIZE.ACTION} />
          </button>
          <button
            onClick={() => handleNudgeOffset(-10)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='-10ms'
          >
            <ChevronLeft size={ICON_SIZE.ACTION} />
          </button>
          <button
            onClick={() => handleNudgeOffset(10)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='+10ms'
          >
            <ChevronRight size={ICON_SIZE.ACTION} />
          </button>
          <button
            onClick={() => handleNudgeOffset(100)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='+100ms'
          >
            <FastForward size={ICON_SIZE.ACTION} />
          </button>
        </div>

        <button
          onClick={handleSetAtCurrent}
          className='px-2 py-0.5 text-xs font-mono rounded transition-colors
                     bg-indigo-600 hover:bg-indigo-500 text-white'
          title='Set offset to current playback position'
        >
          Set @ cursor
        </button>

        {hasOffset && (
          <button
            onClick={handleResetOffset}
            className='px-1 py-0.5 text-xs rounded text-slate-500 hover:text-red-400
                       transition-colors'
            title='Reset offset to 0ms'
          >
            <X size={ICON_SIZE.ACTION} />
          </button>
        )}
      </div>
      
      <div className='w-px h-4 bg-slate-600' />

      {/* --- BPM adjust section --- */}
      <div className='flex items-center gap-1.5'>
        <span className='text-xs font-mono text-slate-400'>BPM:</span>

        <span className='text-xs font-mono text-slate-200 bg-slate-700 px-2 py-0.5 rounded
                         min-w-14 text-center'
               style={{ color: hasAdjust ? '#fbbf24' : undefined }}>
          {adjust >= 0 ? '+' : ''}{adjust.toFixed(1)}
        </span>

        <div className='flex items-center gap-0.5'>
          <button
            onClick={() => handleNudgeBpm(-1)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='-1.0 BPM'
          >
            <Rewind size={ICON_SIZE.ACTION} />
          </button>
          <button
            onClick={() => handleNudgeBpm(-0.1)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='-0.1 BPM'
          >
            <ChevronLeft size={ICON_SIZE.ACTION} />
          </button>
          <button
            onClick={() => handleNudgeBpm(0.1)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='+0.1 BPM'
          >
            <ChevronRight size={ICON_SIZE.ACTION} />
          </button>
          <button
            onClick={() => handleNudgeBpm(1)}
            className='px-1 py-0.5 text-xs rounded text-slate-400 hover:text-white
                       hover:bg-slate-600 transition-colors'
            title='+1.0 BPM'
          >
            <FastForward size={ICON_SIZE.ACTION} />
          </button>
        </div>

        {hasAdjust && (
          <button
            onClick={handleResetBpm}
            className='px-1 py-0.5 text-xs rounded text-slate-500 hover:text-red-400
                       transition-colors'
            title='Reset BPM adjustment to 0'
          >
            <X size={ICON_SIZE.ACTION} />
          </button>
        )}
      </div>
    </div>
  );
}