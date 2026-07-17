import { useState, useRef } from 'react';
import { useSetlistStore } from '../../stores/useSetlistStore';
import { useOrderedSetlist } from '../../hooks/useOrderedSetlist';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatTime } from '../../utils/formatTime';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';

interface SetlistSelectorProps {
  /** Whether setlist management actions (create, rename, delete, reorder) are allowed */
  canEdit: boolean;
}

/**
 * Setlist selector row with total duration and the management dropdown
 * (switch, create, rename, duplicate, delete, reorder setlists).
 * Extracted from Sidebar (C5 split, block 2).
 */
export function SetlistSelector({ canEdit }: SetlistSelectorProps) {
  const [showSetlistMenu, setShowSetlistMenu] = useState(false);
  const [renamingSetlist, setRenamingSetlist] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteSetlist, setConfirmDeleteSetlist] = useState(false);
  const [creatingSetlist, setCreatingSetlist] = useState(false);
  const [newSetlistName, setNewSetlistName] = useState('');
  const setlistMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(
    setlistMenuRef,
    () => {
      setShowSetlistMenu(false);
      setConfirmDeleteSetlist(false);
    },
    showSetlistMenu,
  );

  // --- Setlist store ---
  const allSetlists = useSetlistStore((state) => state.setlists);
  const activeSetlistId = useSetlistStore((state) => state.activeSetlistId);
  const activeSetlist = allSetlists.find((s) => s.id === activeSetlistId);
  const switchSetlist = useSetlistStore((state) => state.switchSetlist);
  const createSetlist = useSetlistStore((state) => state.createSetlist);
  const renameSetlist = useSetlistStore((state) => state.renameSetlist);
  const duplicateSetlist = useSetlistStore((state) => state.duplicateSetlist);
  const deleteSetlist = useSetlistStore((state) => state.deleteSetlist);
  const moveSetlist = useSetlistStore((state) => state.moveSetlist);

  const { totalDuration } = useOrderedSetlist();

  const commitRename = () => {
    if (renameValue.trim() && activeSetlistId) {
      renameSetlist(activeSetlistId, renameValue.trim());
    }
    setRenamingSetlist(false);
  };

  return (
    <div className='relative' ref={setlistMenuRef}>
      <div className='flex items-center gap-2'>
        {renamingSetlist ? (
          <input
            type='text'
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenamingSetlist(false);
            }}
            autoFocus
            aria-label='Rename setlist'
            className='flex-1 bg-slate-900 text-slate-200 text-xs rounded px-2 py-1
                       border border-indigo-500 outline-none font-mono'
          />
        ) : (
          <button
            onClick={() => setShowSetlistMenu((v) => !v)}
            className='flex-1 flex items-center gap-1.5 px-2 py-1 text-xs font-mono
                       text-slate-300 bg-slate-800 hover:bg-slate-700 rounded
                       transition-colors text-left'
          >
            <span className='flex-1 truncate'>
              {activeSetlist?.name ?? 'No setlist'}
            </span>
            <ChevronDown size={12} className='text-slate-500 shrink-0' />
          </button>
        )}
        {totalDuration > 0 && !renamingSetlist && (
          <span className='text-[10px] font-mono text-slate-600 whitespace-nowrap'>
            {formatTime(totalDuration)}
          </span>
        )}
      </div>

      {/* Setlist dropdown menu */}
      {showSetlistMenu && (
        <div className='absolute left-0 right-0 top-full mt-1 bg-slate-800 border
                        border-slate-600 rounded-lg shadow-xl py-1 z-50'>
          {allSetlists.map((sl, index) => (
            <div
              key={sl.id}
              className={`flex items-center px-3 py-1.5 text-xs font-mono
                         transition-colors ${
                           sl.id === activeSetlistId
                             ? 'text-indigo-400 bg-slate-700/50'
                             : 'text-slate-300 hover:bg-slate-700'
                         }`}
            >
              <button
                onClick={() => {
                  switchSetlist(sl.id);
                  setShowSetlistMenu(false);
                }}
                className='flex-1 text-left truncate'
              >
                {sl.name}
              </button>
              {canEdit && allSetlists.length > 1 && (
                <span className='flex gap-0.5 ml-2 shrink-0'>
                  <button
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSetlist(sl.id, 'up');
                    }}
                    className='text-slate-500 hover:text-slate-300 disabled:opacity-20
                               disabled:cursor-not-allowed transition-colors'
                    aria-label={`Move ${sl.name} up`}
                  >
                    <ChevronUp size={ICON_SIZE.ACTION} />
                  </button>
                  <button
                    disabled={index === allSetlists.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSetlist(sl.id, 'down');
                    }}
                    className='text-slate-500 hover:text-slate-300 disabled:opacity-20
                               disabled:cursor-not-allowed transition-colors'
                    aria-label={`Move ${sl.name} down`}
                  >
                    <ChevronDown size={ICON_SIZE.ACTION} />
                  </button>
                </span>
              )}
            </div>
          ))}

          {canEdit && (
            <>
              <div className='border-t border-slate-700 my-1' />

              {creatingSetlist ? (
                <div className='px-3 py-1.5'>
                  <input
                    type='text'
                    placeholder='Setlist name...'
                    value={newSetlistName}
                    onChange={(e) => setNewSetlistName(e.target.value)}
                    onBlur={() => setCreatingSetlist(false)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && newSetlistName.trim()) {
                        await createSetlist(newSetlistName.trim());
                        setNewSetlistName('');
                        setCreatingSetlist(false);
                        setShowSetlistMenu(false);
                      }
                      if (e.key === 'Escape') setCreatingSetlist(false);
                    }}
                    autoFocus
                    className='w-full bg-slate-900 text-slate-200 text-xs rounded px-2
                               py-1 border border-slate-600 focus:border-indigo-500
                               outline-none font-mono'
                  />
                </div>
              ) : (
                <button
                  onClick={() => setCreatingSetlist(true)}
                  className='w-full text-left px-3 py-1.5 text-xs font-mono
                             text-slate-400 hover:bg-slate-700 transition-colors'
                >
                  + New Setlist
                </button>
              )}

              <button
                onClick={() => {
                  setRenameValue(activeSetlist?.name ?? '');
                  setRenamingSetlist(true);
                  setShowSetlistMenu(false);
                }}
                className='w-full text-left px-3 py-1.5 text-xs font-mono
                           text-slate-400 hover:bg-slate-700 transition-colors'
              >
                Rename
              </button>

              <button
                onClick={async () => {
                  if (activeSetlistId) {
                    await duplicateSetlist(activeSetlistId);
                    setShowSetlistMenu(false);
                  }
                }}
                className='w-full text-left px-3 py-1.5 text-xs font-mono
                           text-slate-400 hover:bg-slate-700 transition-colors'
              >
                Duplicate
              </button>

              {allSetlists.length > 0 && (
                confirmDeleteSetlist ? (
                  <button
                    onClick={async () => {
                      if (activeSetlistId) {
                        await deleteSetlist(activeSetlistId);
                        setConfirmDeleteSetlist(false);
                        setShowSetlistMenu(false);
                      }
                    }}
                    className='w-full text-left px-3 py-1.5 text-xs font-mono
                               text-red-400 hover:bg-slate-700 transition-colors'
                  >
                    Confirm delete?
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteSetlist(true)}
                    className='w-full text-left px-3 py-1.5 text-xs font-mono
                               text-slate-400 hover:bg-slate-700 transition-colors'
                  >
                    Delete
                  </button>
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}