import { useTempoStore } from '../../stores/useTempoStore';
import { Popover } from '../Common/Popover';
import { TempoControls } from './TempoControls';

/**
 * Compact tempo display for session mode. Shows the current playback rate
 * as a percentage with a 'Speed' label; clicking opens a popover containing
 * the full TempoControls (presets, slider, value input).
 */
export function TempoIndicator() {
  const playbackRate = useTempoStore((state) => state.playbackRate);
  const percent = Math.round(playbackRate * 100);

  return (
    <Popover
      side='bottom'
      align='right'
      trigger={
        <span className='flex items-center gap-1.5'>
          <span className='text-slate-400'>Speed</span>
          <span className='text-slate-300 group-hover:text-white transition-colors'>
            {percent}%
          </span>
        </span>
      }
      triggerAriaLabel={`Speed: ${percent} percent. Click to adjust.`}
      triggerClassName='group px-3 py-1 rounded font-mono text-xs transition-colors'
      panelClassName='bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl'
    >
      <TempoControls />
    </Popover>
  );
}