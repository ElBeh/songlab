import { useState } from 'react';
import { useTabStore } from '../../stores/useTabStore';
import { SheetBar } from './SheetBar';
import type { SectionMarker } from '../../types';
import { Upload, Download, X } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';

interface TabEditorProps {
  marker: SectionMarker;
  songId: string;
}

const TAB_PLACEHOLDER = `e|-------------------------------|
B|-------------------------------|
G|-------------------------------|
D|-------------------------------|
A|-------------------------------|
E|-------------------------------|`;

export function TabEditor({ marker, songId }: TabEditorProps) {
  const sheets = useTabStore((state) => state.sheets);
  const activeSheetId = useTabStore((state) => state.activeSheetId);
  const getTabForMarkerAndSheet = useTabStore((state) => state.getTabForMarkerAndSheet);
  const saveTab = useTabStore((state) => state.saveTab);
  const deleteTab = useTabStore((state) => state.deleteTab);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
  const existingTab = activeSheetId
    ? getTabForMarkerAndSheet(marker.id, activeSheetId)
    : null;

  const [localContent, setLocalContent] = useState(existingTab?.content ?? '');
  const [lastKey, setLastKey] = useState(`${marker.id}-${activeSheetId}`);

  // Reset content when marker or sheet changes – no useEffect needed
  const currentKey = `${marker.id}-${activeSheetId}`;
  if (currentKey !== lastKey) {
    setLocalContent(existingTab?.content ?? '');
    setLastKey(currentKey);
  }

  const dirty = localContent !== (existingTab?.content ?? '');

  const handleSave = async () => {
    if (!activeSheetId) return;
    await saveTab({
      id: existingTab?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      songId,
      markerId: marker.id,
      sheetId: activeSheetId,
      content: localContent,
      updatedAt: Date.now(),
    });
  };

  const handleDelete = async () => {
    if (!existingTab) return;
    await deleteTab(existingTab.id);
    setLocalContent('');
  };

  const handleExport = () => {
    if (!activeSheet) return;
    const blob = new Blob([localContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${marker.label ?? marker.type}-${activeSheet.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setLocalContent(reader.result as string);
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className='flex flex-col gap-2 flex-1'>
      {/* Sheet bar */}
      <SheetBar songId={songId} />

      {activeSheetId ? (
        <>
          {/* Toolbar */}
          <div className='flex items-center gap-2'>
            <button
              onClick={handleImport}
              className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-slate-600
                         text-slate-300 rounded transition-colors'
              title='Import from .txt'
            >
              <Upload size={ICON_SIZE.ACTION} className='inline-block' /> import
            </button>
            <button
              onClick={handleExport}
              className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-slate-600
                         text-slate-300 rounded transition-colors'
              title='Export to .txt'
            >
              <Download size={ICON_SIZE.ACTION} className='inline-block' /> export
            </button>
            {existingTab && (
              <button
                onClick={handleDelete}
                className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-red-900
                           text-slate-400 hover:text-red-300 rounded transition-colors'
              >
                <X size={ICON_SIZE.ACTION} className='inline-block' /> delete
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!dirty}
              className='px-3 py-1 text-xs font-mono rounded transition-colors
                         disabled:opacity-30 disabled:cursor-not-allowed'
              style={{
                backgroundColor: dirty ? '#6366f1' : '#334155',
                color: dirty ? '#fff' : '#94a3b8',
              }}
            >
              {dirty ? '● save' : 'saved'}
            </button>
          </div>

          {/* Textarea */}
          <textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            spellCheck={false}
            placeholder={TAB_PLACEHOLDER}
            className='flex-1 min-h-48 bg-slate-900 text-slate-200 font-mono text-sm
                       rounded-lg p-4 border border-slate-700 focus:border-indigo-500
                       outline-none resize-none leading-relaxed'
          />
        </>
      ) : (
        <div className='flex items-center justify-center min-h-48 text-slate-600 font-mono text-sm'>
          Add a sheet above to start editing tabs
        </div>
      )}
    </div>
  );
}