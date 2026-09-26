import { useState } from 'react';
import { useTabStore } from '../../stores/useTabStore';
import { SheetBar } from './SheetBar';
import type { SectionMarker } from '../../types';
import { Upload, Download, X } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';
import { resolveTab, isSongScope } from '../../utils/tabScope';

interface TabEditorProps {
  /** Active marker, null edits the whole-song tab */
  marker: SectionMarker | null;
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
  const tabs = useTabStore((state) => state.tabs);
  const saveTab = useTabStore((state) => state.saveTab);
  const deleteTab = useTabStore((state) => state.deleteTab);

  const markerId = marker?.id ?? null;
  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
  const resolved = activeSheetId ? resolveTab(tabs, songId, markerId, activeSheetId) : null;

  // "Create section tab" switches a fallback view to the marker's own scope.
  // The new section tab starts as a copy of the whole-song tab.
  const [forceSectionScope, setForceSectionScope] = useState(false);
  const sectionScopeActive = forceSectionScope && markerId !== null;
  const scopeId = sectionScopeActive ? markerId : (resolved?.scopeId ?? null);
  const existingTab = sectionScopeActive ? null : (resolved?.tab ?? null);
  const isFallback = !sectionScopeActive && (resolved?.isFallback ?? false);

  const [localContent, setLocalContent] = useState(existingTab?.content ?? '');
  const [lastKey, setLastKey] = useState(`${markerId}-${activeSheetId}`);

  // Reset content and scope when marker or sheet changes – no useEffect needed
  const currentKey = `${markerId}-${activeSheetId}`;
  if (currentKey !== lastKey) {
    // Use the resolved tab directly: the section-scope flag belongs to the old key
    setLocalContent(resolved?.tab?.content ?? '');
    setForceSectionScope(false);
    setLastKey(currentKey);
  }

  const dirty = localContent !== (existingTab?.content ?? '');

  const handleSave = async () => {
    if (!activeSheetId || !scopeId) return;
    await saveTab({
      id: existingTab?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      songId,
      markerId: scopeId,
      sheetId: activeSheetId,
      content: localContent,
      updatedAt: Date.now(),
    });
    // The section tab now exists and is found by resolveTab directly
    setForceSectionScope(false);
  };

  const handleCreateSectionTab = () => {
    setForceSectionScope(true);
  };

  const scopeLabel = scopeId && !isSongScope(scopeId) && marker
    ? (marker.label ?? marker.type)
    : 'whole-song';

  const handleDelete = async () => {
    if (!existingTab || !activeSheetId) return;
    await deleteTab(existingTab.id);
    // Deleting a section tab reveals the whole-song tab again: load its content,
    // otherwise saving would overwrite the whole-song tab with an empty text
    const next = resolveTab(useTabStore.getState().tabs, songId, markerId, activeSheetId);
    setLocalContent(next.tab?.content ?? '');
  };

  const handleExport = () => {
    if (!activeSheet) return;
    const blob = new Blob([localContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scopeLabel}-${activeSheet.name}.txt`;
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

          {/* Scope hint: marker without own tab edits the whole-song tab */}
          {isFallback && marker && (
            <div className='flex items-center gap-2 text-xs font-mono text-slate-400'>
              <span>Editing whole-song tab ({marker.label ?? marker.type} has no own tab)</span>
              <button
                onClick={handleCreateSectionTab}
                className='px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300
                           rounded transition-colors'
              >
                Create section tab
              </button>
            </div>
          )}
          {sectionScopeActive && marker && (
            <div className='text-xs font-mono text-slate-400'>
              New section tab for {marker.label ?? marker.type} (unsaved)
            </div>
          )}

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