import { useState } from 'react';
import type { ImportConflictResolution } from '../../types';

interface ImportConflictDialogProps {
  /** Name of the imported setlist that clashes with an existing one */
  setlistName: string;
  /** Name the setlist would get when both are kept, e.g. "Gig (2)" */
  keepBothName: string;
  /** 1-based position of this conflict and total number of conflicts */
  conflictIndex: number;
  conflictCount: number;
  /** `applyToAll` is only true when more conflicts follow and the box was checked */
  onResolve: (resolution: ImportConflictResolution, applyToAll: boolean) => void;
}

const BUTTON_BASE = `w-full px-3 py-2.5 text-xs font-mono rounded transition-colors
                     text-left flex flex-col gap-0.5`;

/**
 * Asks how to handle an imported setlist whose name already exists
 * (analogous to a file manager's paste conflict). Shown once per conflict.
 * The backdrop does not close the dialog to avoid accidental taps on touch devices.
 */
export function ImportConflictDialog({
  setlistName,
  keepBothName,
  conflictIndex,
  conflictCount,
  onResolve,
}: ImportConflictDialogProps) {
  const [applyToAll, setApplyToAll] = useState(false);
  const remaining = conflictCount - conflictIndex;

  const resolve = (resolution: ImportConflictResolution) => {
    onResolve(resolution, remaining > 0 && applyToAll);
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
      onKeyDown={(e) => {
        if (e.key === 'Escape') resolve('skip');
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='import-conflict-title'
        className='bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-5
                   w-full max-w-sm flex flex-col gap-4'
      >
        <div className='flex flex-col gap-1'>
          <h2 id='import-conflict-title' className='text-sm font-semibold text-slate-200'>
            Setlist already exists
          </h2>
          {conflictCount > 1 && (
            <span className='text-[10px] font-mono text-slate-500'>
              Conflict {conflictIndex} of {conflictCount}
            </span>
          )}
        </div>

        <p className='text-xs font-mono text-slate-400'>
          A setlist named <span className='text-slate-200'>"{setlistName}"</span> already
          exists. What do you want to do?
        </p>

        <div className='flex flex-col gap-2'>
          <button
            onClick={() => resolve('replace')}
            autoFocus
            className={`${BUTTON_BASE} bg-indigo-600 hover:bg-indigo-500 text-white`}
          >
            <span>Replace</span>
            <span className='text-[10px] text-indigo-200'>
              Overwrite the existing setlist with the imported one
            </span>
          </button>
          <button
            onClick={() => resolve('keepBoth')}
            className={`${BUTTON_BASE} bg-slate-700 hover:bg-slate-600 text-slate-200`}
          >
            <span>Keep both</span>
            <span className='text-[10px] text-slate-400'>
              Import as "{keepBothName}"
            </span>
          </button>
          <button
            onClick={() => resolve('skip')}
            className={`${BUTTON_BASE} bg-slate-700 hover:bg-slate-600 text-slate-200`}
          >
            <span>Skip</span>
            <span className='text-[10px] text-slate-400'>
              Discard this setlist from the import
            </span>
          </button>
        </div>

        {remaining > 0 && (
          <label className='flex items-center gap-2 py-1 text-xs font-mono text-slate-400
                            cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className='w-4 h-4 accent-indigo-500'
            />
            Apply to the remaining {remaining} conflict{remaining > 1 ? 's' : ''}
          </label>
        )}
      </div>
    </div>
  );
}