import { useState } from 'react';
import { useTabStore } from '../../stores/useTabStore';
import type { TabSheetType } from '../../types';
import { useModeStore } from '../../stores/useModeStore';

const SHEET_TYPES: TabSheetType[] = ['Guitar', 'Bass', 'Keys', 'Vocals', 'Other'];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface SheetBarProps {
  songId: string;
}

export function SheetBar({ songId }: SheetBarProps) {
  const sheets = useTabStore((state) => state.sheets);
  const activeSheetId = useTabStore((state) => state.activeSheetId);
  const setActiveSheet = useTabStore((state) => state.setActiveSheet);
  const addSheet = useTabStore((state) => state.addSheet);
  const updateSheet = useTabStore((state) => state.updateSheet);
  const removeSheet = useTabStore((state) => state.removeSheet);
  const isBand = useModeStore((state) => state.mode) === 'band';

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TabSheetType>('Guitar');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addSheet({
      id: generateId(),
      songId,
      name: newName.trim(),
      type: newType,
      order: sheets.length,
    });
    setNewName('');
    setNewType('Guitar');
    setShowAddForm(false);
  };

  const handleRenameCommit = async (sheet: typeof sheets[0]) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    await updateSheet({ ...sheet, name: editName.trim() });
    setEditingId(null);
  };

  return (
    <div className='flex items-center gap-1 overflow-x-auto pb-1'>
      {/* Sheet tabs */}
      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          className='group flex items-center gap-1 px-3 py-1 rounded-t-lg
                     font-mono text-xs cursor-pointer transition-colors shrink-0'
          style={{
            backgroundColor: sheet.id === activeSheetId ? '#1e293b' : '#0f172a',
            color: sheet.id === activeSheetId ? '#f1f5f9' : '#64748b',
            borderBottom: sheet.id === activeSheetId ? '2px solid #6366f1' : '2px solid transparent',
          }}
          onClick={() => setActiveSheet(sheet.id)}
        >
          {editingId === sheet.id ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRenameCommit(sheet)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameCommit(sheet);
                if (e.key === 'Escape') setEditingId(null);
              }}
              className='w-20 bg-slate-700 text-slate-100 font-mono text-xs
                         rounded px-1 border border-indigo-500 outline-none'
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className='max-w-24 truncate'>{sheet.name}</span>
          )}

          {/* Edit + Delete – visible on hover */}
          <span className='text-slate-600 text-xs ml-1'>({sheet.type})</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(sheet.id);
              setEditName(sheet.name);
            }}
            className='opacity-0 group-hover:opacity-100 text-slate-500
                       hover:text-slate-300 transition-opacity text-xs ml-1'
            title='Rename sheet'
          >
            ✎
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeSheet(sheet.id);
            }}
            className='opacity-0 group-hover:opacity-100 text-slate-500
                       hover:text-red-400 transition-opacity text-xs'
            title='Delete sheet'
          >
            ✕
          </button>
        </div>
      ))}

      {/* Add sheet */}
      {!isBand && (
        <>
      {showAddForm ? (
        <div className='flex items-center gap-2 px-2 py-1 bg-slate-800 rounded-lg shrink-0'>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowAddForm(false);
            }}
            placeholder='Sheet name...'
            className='w-24 bg-slate-700 text-slate-100 font-mono text-xs
                       rounded px-1 py-0.5 border border-indigo-500 outline-none'
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as TabSheetType)}
            className='bg-slate-700 text-slate-300 font-mono text-xs rounded
                       px-1 py-0.5 border border-slate-600 outline-none'
          >
            {SHEET_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            className='text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors'
          >
            add
          </button>
          <button
            onClick={() => setShowAddForm(false)}
            className='text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors'
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className='px-2 py-1 font-mono text-xs text-slate-500
                     hover:text-slate-300 transition-colors shrink-0'
          title='Add sheet'
        >
          + sheet
        </button>
      )}
      </>
      )}
    </div>
  );
}