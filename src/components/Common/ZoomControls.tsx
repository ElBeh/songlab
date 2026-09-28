import { Minus, Plus } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';

interface ZoomControlsProps {
  /** Current zoom factor, 1 = 100% */
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const BUTTON_CLASS = `px-1.5 py-0.5 text-xs font-mono rounded transition-colors
                      bg-slate-700 hover:bg-slate-600 text-slate-300`;

/** Zoom out / percentage / zoom in, as used by the notation and songbook panels */
export function ZoomControls({ scale, onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div className='flex items-center gap-1'>
      <button onClick={onZoomOut} className={BUTTON_CLASS} title='Zoom out'>
        <Minus size={ICON_SIZE.ACTION} />
      </button>
      <span className='text-xs font-mono text-slate-400 min-w-8 text-center'>
        {Math.round(scale * 100)}%
      </span>
      <button onClick={onZoomIn} className={BUTTON_CLASS} title='Zoom in'>
        <Plus size={ICON_SIZE.ACTION} />
      </button>
    </div>
  );
}