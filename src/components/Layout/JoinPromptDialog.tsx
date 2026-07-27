import { useState } from 'react';
import type { SyncRole } from '../../../shared/syncProtocol';

interface JoinPromptDialogProps {
  /** Role the user will join as (from the QR join parameter) */
  role: SyncRole;
  /** Called with the entered display name to start the connection */
  onJoin: (displayName: string) => void;
  onClose: () => void;
}

/**
 * Minimal join flow after scanning a Band Sync QR code:
 * server URL and role are preset, only a display name is required.
 */
export function JoinPromptDialog({ role, onJoin, onClose }: JoinPromptDialogProps) {
  const [displayName, setDisplayName] = useState('');

  const handleJoin = () => {
    if (!displayName.trim()) return;
    onJoin(displayName.trim());
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
      onClick={onClose}
    >
      <div
        className='bg-slate-800 border border-slate-700 rounded-xl p-6 w-80
                   flex flex-col gap-4 shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='text-sm font-mono font-bold text-slate-200'>
          Join Band Sync as {role === 'viewer' ? 'Viewer' : role}
        </h2>

        <p className='text-xs font-mono text-slate-400'>
          Enter your name or instrument so the band knows who joined.
        </p>

        <label className='flex flex-col gap-1'>
          <span className='text-[10px] font-mono text-slate-500 uppercase'>Name</span>
          <input
            type='text'
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoin();
              if (e.key === 'Escape') onClose();
            }}
            placeholder='e.g. Guitar, Bass, Keys…'
            autoFocus
            className='bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5
                       border border-slate-600 focus:border-indigo-500 outline-none
                       font-mono'
          />
        </label>

        <div className='flex gap-2'>
          <button
            onClick={onClose}
            className='flex-1 px-3 py-1.5 text-xs font-mono rounded transition-colors
                       bg-slate-700 hover:bg-slate-600 text-slate-300'
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={!displayName.trim()}
            className='flex-1 px-3 py-1.5 text-xs font-mono rounded transition-colors
                       bg-indigo-500 hover:bg-indigo-400 text-white
                       disabled:opacity-40 disabled:cursor-not-allowed'
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}