import { useState } from 'react';
import { Popover } from '../Common/Popover';
import { FretboardEditor } from '../Tools/FretboardEditor';
import {
  SECTION_KINDS,
  insertChord,
  insertComment,
  insertDirectiveLine,
  nextSectionLabel,
  setChordDefinition,
  setMetaDirective,
  wrapInSection,
  type DefineVoicing,
  type MetaDirective,
  type TextEdit,
} from '../../utils/chordProEdit';
import type { ChordDefinition } from '../../utils/chordSheetParser';
import { TOOLBAR_BUTTON_CLASS, TOOLBAR_GROUP_CLASS, TOOLBAR_SELECT_CLASS } from './toolbarStyles';

/** Builds an edit from the textarea's current text and selection; null = no change */
export type EditBuilder = (text: string, selectionStart: number, selectionEnd: number) => TextEdit | null;

export type SheetMeta = Record<MetaDirective, string>;

interface SongbookInsertBarProps {
  /** Applies an edit to the textarea (keeps its undo history) */
  onEdit: (build: EditBuilder) => void;
  /** Current metadata of the sheet, prefills the info fields */
  meta: SheetMeta;
  /** {define} voicings of the sheet, shown as hint in the fretboard editor */
  definitions: Record<string, ChordDefinition>;
}

const META_FIELDS: { name: MetaDirective; label: string; placeholder: string }[] = [
  { name: 'title', label: 'Title', placeholder: 'Bad Moon Rising' },
  { name: 'artist', label: 'Artist', placeholder: 'CCR' },
  { name: 'key', label: 'Key', placeholder: 'D' },
  { name: 'capo', label: 'Capo', placeholder: '0' },
];

/** Metadata form inside the info popover; mounted on open, so it starts from the current values */
function InfoForm({ meta, onApply }: { meta: SheetMeta; onApply: (values: SheetMeta) => void }) {
  const [values, setValues] = useState<SheetMeta>(meta);

  return (
    <form
      className='flex flex-col gap-2 w-64 p-3 rounded-lg bg-slate-800 border border-slate-600 shadow-lg'
      onSubmit={(e) => {
        e.preventDefault();
        onApply(values);
      }}
    >
      {META_FIELDS.map(({ name, label, placeholder }) => (
        <label key={name} className='flex items-center gap-2 text-xs font-mono text-slate-400'>
          <span className='w-12'>{label}</span>
          <input
            value={values[name]}
            onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
            placeholder={placeholder}
            inputMode={name === 'capo' ? 'numeric' : 'text'}
            className='flex-1 min-w-0 px-2 py-1 rounded bg-slate-900 border border-slate-700
                       text-slate-200 focus:border-indigo-500 outline-none'
          />
        </label>
      ))}
      <button type='submit' className={`${TOOLBAR_BUTTON_CLASS} self-end`}>apply</button>
    </form>
  );
}

/** Insert group of the songbook editor toolbar: sections, repeats, comments, tab blocks, info, chords */
export function SongbookInsertBar({ onEdit, meta, definitions }: SongbookInsertBarProps) {
  const [showFretboard, setShowFretboard] = useState(false);

  // Chord at the cursor first, then its {define} (added, replaced or removed) in the header.
  // The textarea keeps its selection while the dialog has focus.
  const handleInsertChord = (name: string, definition: DefineVoicing | null) => {
    onEdit((_text, start, end) => insertChord(start, end, name));
    onEdit((text, start, end) => setChordDefinition(text, name, definition, start, end));
  };

  const insertSection = (kind: string, base: string) => {
    onEdit((text, start, end) => wrapInSection(text, start, end, kind, nextSectionLabel(text, base)));
  };

  const applyMeta = (values: SheetMeta) => {
    // One edit per changed field; each builder sees the text after the previous edit
    for (const { name } of META_FIELDS) {
      if (values[name].trim() === meta[name].trim()) continue;
      onEdit((text, start, end) => setMetaDirective(text, name, values[name], start, end));
    }
  };

  return (
    <div className={TOOLBAR_GROUP_CLASS} role='group' aria-label='Insert'>
      <select
        value=''
        onChange={(e) => {
          const entry = SECTION_KINDS.find((k) => k.kind === e.target.value);
          if (entry) insertSection(entry.kind, entry.label);
        }}
        className={TOOLBAR_SELECT_CLASS}
        title='Wrap the selected lines in a section, or insert an empty one below the cursor'
        aria-label='Insert section'
      >
        <option value='' disabled>section</option>
        {SECTION_KINDS.map(({ kind, label }) => (
          <option key={kind} value={kind}>{label}</option>
        ))}
      </select>

      <button
        onClick={() => onEdit((text, start) =>
          insertDirectiveLine(text, start, `{chorus: ${nextSectionLabel(text, 'Chorus')}}`))}
        className={TOOLBAR_BUTTON_CLASS}
        title='Insert a chorus repeat below the cursor line'
      >
        repeat
      </button>

      <button
        onClick={() => onEdit(insertComment)}
        className={TOOLBAR_BUTTON_CLASS}
        title='Insert a comment line, e.g. a playing hint (uses the selected text)'
      >
        comment
      </button>

      <button
        onClick={() => onEdit((text, start, end) => wrapInSection(text, start, end, 'tab', null))}
        className={TOOLBAR_BUTTON_CLASS}
        title='Wrap the selected lines in a tab block (shown as typed)'
      >
        tab
      </button>

      <Popover
        trigger='info'
        triggerClassName={TOOLBAR_BUTTON_CLASS}
        triggerAriaLabel='Edit song info (title, artist, key, capo)'
        align='left'
      >
        {(close) => (
          <InfoForm
            meta={meta}
            onApply={(values) => {
              close();
              applyMeta(values);
            }}
          />
        )}
      </Popover>

      <button
        onClick={() => setShowFretboard(true)}
        className={TOOLBAR_BUTTON_CLASS}
        title='Insert a chord at the cursor (fretboard editor)'
      >
        chord
      </button>
      {showFretboard && (
        <FretboardEditor
          onClose={() => setShowFretboard(false)}
          onInsert={handleInsertChord}
          definitions={definitions}
        />
      )}
    </div>
  );
}