import { useMemo, useRef, useState } from 'react';
import { Upload, Download, X } from 'lucide-react';
import { useSongStore } from '../../stores/useSongStore';
import { useToastStore } from '../../stores/useToastStore';
import { ICON_SIZE } from '../../utils/iconSizes';
import {
  PASTED_SHEET_FORMAT_LABELS,
  convertPastedSheet,
  detectPastedSheetFormat,
  parseChordPro,
  type PastedSheetFormat,
} from '../../utils/chordSheetParser';
import { SongbookInsertBar, type EditBuilder, type SheetMeta } from './SongbookInsertBar';
import {
  TOOLBAR_BUTTON_CLASS,
  TOOLBAR_CLASS,
  TOOLBAR_DIVIDER_CLASS,
  TOOLBAR_GROUP_CLASS,
} from './toolbarStyles';
import type { SongData } from '../../types';

interface SongbookEditorProps {
  song: SongData;
}

const SONGBOOK_PLACEHOLDER = `{title: Song title}
{key: G}

{start_of_verse: Verse 1}
[G]Lyrics with [C]chords in [D]brackets
{end_of_verse}

{start_of_chorus: Chorus}
[Em]Chorus [C]line
{end_of_chorus}

Or paste a chords-over-words or stacked chord sheet, it is converted automatically.`;

function conversionMessage(format: PastedSheetFormat): string {
  return `Converted ${PASTED_SHEET_FORMAT_LABELS[format]} to ChordPro`;
}

export function SongbookEditor({ song }: SongbookEditorProps) {
  const updateSong = useSongStore((state) => state.updateSong);
  const addToast = useToastStore((state) => state.addToast);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const savedContent = song.chordSheet ?? '';
  const [localContent, setLocalContent] = useState(savedContent);
  const [lastSongId, setLastSongId] = useState(song.id);

  // Reset content when the song changes – no useEffect needed
  if (song.id !== lastSongId) {
    setLocalContent(savedContent);
    setLastSongId(song.id);
  }

  const dirty = localContent !== savedContent;

  const handleSave = async () => {
    // null clears the songbook: saveSong/updateSong skip undefined fields
    await updateSong({ ...song, chordSheet: localContent.trim() ? localContent : null });
  };

  const handleDelete = async () => {
    setLocalContent('');
    await updateSong({ ...song, chordSheet: null });
  };

  // Paste: convert plain-text chord sheets and insert at the cursor
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text/plain');
    const result = convertPastedSheet(pasted);
    if (!result.format) return; // default paste

    e.preventDefault();
    const el = e.currentTarget;
    const next = localContent.slice(0, el.selectionStart) + result.text + localContent.slice(el.selectionEnd);
    setLocalContent(next);
    addToast(conversionMessage(result.format), 'info');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.cho,.chopro,.chordpro,.crd,.pro,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = convertPastedSheet(reader.result as string);
        setLocalContent(result.text);
        if (result.format) addToast(conversionMessage(result.format), 'info');
      };
      reader.onerror = () => addToast('Could not read file', 'error');
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExport = () => {
    const blob = new Blob([localContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${song.title}.cho`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Manual conversion for text typed or pasted before (e.g. in two steps)
  const handleConvert = () => {
    setLocalContent(convertPastedSheet(localContent).text);
    textareaRef.current?.focus();
  };

  const canConvert = detectPastedSheetFormat(localContent) !== null;

  const sheet = useMemo(() => parseChordPro(localContent), [localContent]);
  const meta = useMemo<SheetMeta>(() => ({
    title: sheet.title ?? '',
    artist: sheet.artist ?? '',
    key: sheet.key ?? '',
    capo: sheet.capo ? String(sheet.capo) : '',
  }), [sheet]);

  // Apply a toolbar edit through the textarea itself, so Ctrl+Z can undo it.
  // execCommand is deprecated but the only way to keep the native undo stack;
  // setRangeText is the fallback (e.g. jsdom), without undo.
  const handleEdit = (build: EditBuilder) => {
    const el = textareaRef.current;
    if (!el) return;
    const edit = build(el.value, el.selectionStart, el.selectionEnd);
    if (!edit) return;

    el.focus();
    el.setSelectionRange(edit.from, edit.to);
    const isNoop = edit.from === edit.to && edit.insert === '';
    const command = edit.insert === '' ? 'delete' : 'insertText';
    const applied = isNoop
      || (typeof document.execCommand === 'function' && document.execCommand(command, false, edit.insert));
    if (!applied) el.setRangeText(edit.insert, edit.from, edit.to, 'end');

    setLocalContent(el.value);
    el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  };

  return (
    <div className='flex flex-col gap-2 flex-1'>
      {/* Toolbar: file group | insert group, styled like the notation controls bar */}
      <div className={TOOLBAR_CLASS}>
        <div className={TOOLBAR_GROUP_CLASS} role='group' aria-label='File'>
          <button
            onClick={handleImport}
            className={TOOLBAR_BUTTON_CLASS}
            title='Import ChordPro or text file'
          >
            <Upload size={ICON_SIZE.ACTION} className='inline-block' /> import
          </button>
          <button
            onClick={handleExport}
            disabled={!localContent}
            className={TOOLBAR_BUTTON_CLASS}
            title='Export as .cho (ChordPro)'
          >
            <Download size={ICON_SIZE.ACTION} className='inline-block' /> export
          </button>
          {canConvert && (
            <button
              onClick={handleConvert}
              className={TOOLBAR_BUTTON_CLASS}
              title='Convert chords-over-words or stacked chord text to ChordPro'
            >
              convert to ChordPro
            </button>
          )}
          {savedContent && (
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

        <div className={TOOLBAR_DIVIDER_CLASS} />

        <SongbookInsertBar onEdit={handleEdit} meta={meta} definitions={sheet.definitions} />
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={(e) => setLocalContent(e.target.value)}
        onPaste={handlePaste}
        spellCheck={false}
        placeholder={SONGBOOK_PLACEHOLDER}
        className='flex-1 min-h-48 bg-slate-900 text-slate-200 font-mono text-sm
                   rounded-lg p-4 border border-slate-700 focus:border-indigo-500
                   outline-none resize-none leading-relaxed'
      />
    </div>
  );
}