import { useState } from 'react';
import type { SectionMarker, SectionTab } from '../../types';
import { useTabStore } from '../../stores/useTabStore';

interface TabEditorProps {
  marker: SectionMarker;
  songId: string;
}

export function TabEditor({ marker, songId }: TabEditorProps) {
  const tabs = useTabStore((state) => state.tabs);
  const saveTab = useTabStore((state) => state.saveTab);
  const deleteTab = useTabStore((state) => state.deleteTab);

  const existing = tabs[marker.id];

  // Local draft – initialized from store, reset when marker changes
  const [localContent, setLocalContent] = useState(() => existing?.content ?? '');
  const [lastMarkerId, setLastMarkerId] = useState(marker.id);
  const [dirty, setDirty] = useState(false);

  // Reset when switching to a different marker – no useEffect needed
  if (marker.id !== lastMarkerId) {
    setLastMarkerId(marker.id);
    setLocalContent(tabs[marker.id]?.content ?? '');
    setDirty(false);
  }

  const handleSave = async () => {
    const tab: SectionTab = {
      id: marker.id,
      songId,
      markerId: marker.id,
      content: localContent,
      updatedAt: Date.now(),
    };
    await saveTab(tab);
    setDirty(false);
  };

  const handleDelete = async () => {
    await deleteTab(marker.id);
    setLocalContent('');
    setDirty(false);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setLocalContent(reader.result as string);
        setDirty(true);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExport = () => {
    const blob = new Blob([localContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${marker.label}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className='flex flex-col gap-2 h-full'>
      {/* Header */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2'>
          <span
            className='w-2 h-2 rounded-full'
            style={{ backgroundColor: marker.color }}
          />
          <span className='text-sm font-mono text-slate-300'>{marker.label}</span>
          {dirty && (
            <span className='text-xs font-mono text-amber-400'>unsaved</span>
          )}
        </div>

        {/* Actions – left aligned */}
        <div className='flex items-center gap-2'>
          <button
            onClick={handleImport}
            className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-slate-600
                       text-slate-300 rounded transition-colors'
            title='Import .txt'
          >
            ↑ import
          </button>
          <button
            onClick={handleExport}
            disabled={!localContent}
            className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-slate-600
                       text-slate-300 rounded transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed'
            title='Export .txt'
          >
            ↓ export
          </button>
          {existing && (
            <button
              onClick={handleDelete}
              className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-red-900
                         text-slate-400 hover:text-red-300 rounded transition-colors'
              title='Delete tab'
            >
              ✕
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty}
            className='px-2 py-1 text-xs font-mono bg-indigo-500 hover:bg-indigo-400
                       text-white rounded transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed'
          >
            Save
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={localContent}
        onChange={(e) => {
          setLocalContent(e.target.value);
          setDirty(true);
        }}
        placeholder={`ASCII tab for "${marker.label}"...\n\ne|-----------------------|\nB|-----------------------|\nG|-----------------------|\nD|-----------------------|\nA|-----------------------|\nE|-----------------------|`}
        className='flex-1 w-full bg-slate-900 text-slate-200 font-mono text-sm
                   rounded p-3 outline-none border border-slate-700
                   focus:border-indigo-500 resize-none leading-relaxed'
        spellCheck={false}
      />
    </div>
  );
}