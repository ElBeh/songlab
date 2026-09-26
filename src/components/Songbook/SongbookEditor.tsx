import { useRef, useState } from 'react';
import { Upload, Download, X } from 'lucide-react';
import { useSongStore } from '../../stores/useSongStore';
import { useToastStore } from '../../stores/useToastStore';
import { ICON_SIZE } from '../../utils/iconSizes';
import { chordsOverWordsToChordPro, looksLikeChordsOverWords } from '../../utils/chordSheetParser';
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

Or paste a chords-over-words sheet, it is converted automatically.`;

/** Convert pasted or imported text to ChordPro if it is a chords-over-words sheet */
function toChordPro(text: string): { text: string; converted: boolean } {
  return looksLikeChordsOverWords(text)
    ? { text: chordsOverWordsToChordPro(text), converted: true }
    : { text, converted: false };
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

  // Paste: convert chords-over-words sheets and insert at the cursor
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text/plain');
    const result = toChordPro(pasted);
    if (!result.converted) return; // default paste

    e.preventDefault();
    const el = e.currentTarget;
    const next = localContent.slice(0, el.selectionStart) + result.text + localContent.slice(el.selectionEnd);
    setLocalContent(next);
    addToast('Converted chords-over-words to ChordPro', 'info');
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
        const result = toChordPro(reader.result as string);
        setLocalContent(result.text);
        if (result.converted) addToast('Converted chords-over-words to ChordPro', 'info');
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
    setLocalContent(chordsOverWordsToChordPro(localContent));
    textareaRef.current?.focus();
  };

  const canConvert = looksLikeChordsOverWords(localContent);

  return (
    <div className='flex flex-col gap-2 flex-1'>
      {/* Toolbar */}
      <div className='flex items-center gap-2'>
        <button
          onClick={handleImport}
          className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-slate-600
                     text-slate-300 rounded transition-colors'
          title='Import ChordPro or text file'
        >
          <Upload size={ICON_SIZE.ACTION} className='inline-block' /> import
        </button>
        <button
          onClick={handleExport}
          disabled={!localContent}
          className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-slate-600
                     text-slate-300 rounded transition-colors disabled:opacity-30'
          title='Export as .cho (ChordPro)'
        >
          <Download size={ICON_SIZE.ACTION} className='inline-block' /> export
        </button>
        {canConvert && (
          <button
            onClick={handleConvert}
            className='px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-slate-600
                       text-slate-300 rounded transition-colors'
            title='Convert chords-over-words text to ChordPro'
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