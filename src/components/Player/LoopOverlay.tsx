import type { WaveformDragState } from '../../hooks/useWaveformInteraction';
import type { LoopRange } from '../../types';

const START_COLOR = '#fbbf24';
const END_COLOR = '#f87171';
const REGION_COLOR = '#6366f1';

interface LoopOverlayProps {
  /** Active loop range, null when no loop is set */
  loop: LoopRange | null;
  /** Whether the loop is currently armed (affects opacity only) */
  loopEnabled: boolean;
  /** Pending A point while the user is setting an A/B loop */
  abStart: number | null;
  /** Song duration in seconds */
  duration: number;
  /** Current drag state from useWaveformInteraction */
  drag: WaveformDragState | null;
  onHandleMouseDown: (e: React.MouseEvent, type: 'loopStart' | 'loopEnd') => void;
}

interface LoopHandleProps {
  percent: number;
  color: string;
  label: string;
  ariaLabel: string;
  onMouseDown: (e: React.MouseEvent) => void;
}

function LoopHandle({ percent, color, label, ariaLabel, onMouseDown }: LoopHandleProps) {
  return (
    <div
      role='slider'
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className='absolute top-0 h-full'
      style={{
        left: `${percent}%`,
        width: '8px',
        transform: 'translateX(-4px)',
        cursor: 'ew-resize',
        zIndex: 4,
        pointerEvents: 'auto',
      }}
      onMouseDown={onMouseDown}
    >
      <div className='absolute top-0 h-full w-px' style={{ left: '4px', backgroundColor: color }} />
      <span
        className='absolute bottom-1 left-1 text-xs font-mono px-1 rounded'
        style={{ backgroundColor: color, color: '#000' }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Loop region plus draggable A and B handles, rendered on top of a waveform.
 * Shared by WaveformPlayer (audio) and DummyWaveform (no audio file), so both
 * behave and look identical.
 */
export function LoopOverlay({
  loop,
  loopEnabled,
  abStart,
  duration,
  drag,
  onHandleMouseDown,
}: LoopOverlayProps) {
  if (duration <= 0) return null;

  const abPreview = abStart !== null ? (
    <div
      className='absolute top-0 h-full w-px pointer-events-none'
      style={{ left: `${(abStart / duration) * 100}%`, backgroundColor: START_COLOR, zIndex: 4 }}
    >
      <span
        className='absolute bottom-1 left-1 text-xs font-mono px-1 rounded'
        style={{ backgroundColor: START_COLOR, color: '#000' }}
      >
        A
      </span>
    </div>
  ) : null;

  if (!loop) return abPreview;

  const startPercent = drag?.type === 'loopStart'
    ? drag.previewPercent * 100
    : (loop.start / duration) * 100;
  const endPercent = drag?.type === 'loopEnd'
    ? drag.previewPercent * 100
    : (loop.end / duration) * 100;

  return (
    <>
      <div
        className='absolute top-0 h-full pointer-events-none'
        style={{
          left: `${startPercent}%`,
          width: `${Math.max(0, endPercent - startPercent)}%`,
          backgroundColor: REGION_COLOR,
          opacity: loopEnabled ? 0.25 : 0.1,
          border: `1px solid ${loopEnabled ? REGION_COLOR : '#475569'}`,
        }}
      />
      <LoopHandle
        percent={startPercent}
        color={START_COLOR}
        label='A'
        ariaLabel='Loop start'
        onMouseDown={(e) => onHandleMouseDown(e, 'loopStart')}
      />
      <LoopHandle
        percent={endPercent}
        color={END_COLOR}
        label='B'
        ariaLabel='Loop end'
        onMouseDown={(e) => onHandleMouseDown(e, 'loopEnd')}
      />
      {abPreview}
    </>
  );
}