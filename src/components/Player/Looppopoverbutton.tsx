import { Popover } from '../Common/Popover';
import { LoopControls } from './LoopControls';

interface LoopPopoverButtonProps {
  songLoop: boolean;
}

/**
 * Compact loop controls for session mode. The song-loop toggle stays separate;
 * this button opens a popover with A/B mode, loop toggle, loop info, counter,
 * target, and clear actions.
 */
export function LoopPopoverButton({ songLoop }: LoopPopoverButtonProps) {
  return (
    <Popover
      side='bottom'
      align='right'
      trigger={
          <span aria-hidden='true'>▾</span>
      }
      triggerAriaLabel='Loop settings'
      triggerClassName='px-3 py-1 rounded font-mono text-xs
                        bg-slate-700 hover:bg-slate-600
                        text-slate-300 hover:text-white transition-colors'
      panelClassName='bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl'
    >
      <div className='flex items-center gap-2 flex-wrap max-w-md'>
        <LoopControls songLoop={songLoop} />
      </div>
    </Popover>
  );
}