import { useEffect, useMemo, useState } from 'react';
import { Fretboard } from './Fretboard';
import { ChordDiagram } from '../Songbook/ChordDiagram';
import {
  definitionForShape,
  loadGuitarChordDb,
  resolveVoicings,
  type ChordDb,
} from '../../utils/chordLookup';
import {
  STANDARD_TUNING,
  absoluteFret,
  formatChordName,
  identifyChord,
  isSameVoicing,
  positionsFromAbsolute,
  voicingToNotes,
  type FretPositions,
} from '../../utils/fretboard';
import { isChord, normalizeChord, type ChordDefinition } from '../../utils/chordSheetParser';
import type { DefineVoicing } from '../../utils/chordProEdit';

interface FretboardEditorProps {
  onClose: () => void;
  /**
   * Insert target (songbook editor). Receives the chord name and the voicing
   * to store as {define}, or null if the default voicing is meant.
   * Without it the editor is a lookup tool only.
   */
  onInsert?: (name: string, definition: DefineVoicing | null) => void;
  /** Existing {define} voicings of the sheet, used for the insert hint */
  definitions?: Record<string, ChordDefinition>;
}

/**
 * What the fretboard shows: a voicing of the searched chord (by index), or a
 * shape the user clicked. A manual shape keeps the fingers of the voicing it
 * started from only until it is changed.
 */
type Selection =
  | { kind: 'voicing'; index: number }
  | { kind: 'manual'; frets: (number | null)[]; fingers?: number[]; name: string | null };

const EMPTY_FRETS: (number | null)[] = STANDARD_TUNING.map(() => null);

function toAbsolute(shape: FretPositions): (number | null)[] {
  return shape.frets.map((f) => (f === null ? null : absoluteFret(f, shape.baseFret)));
}

function insertHint(
  name: string,
  definition: DefineVoicing | null,
  existing: ChordDefinition | undefined,
): string | null {
  if (definition && !existing) return `Adds {define} for ${name} (custom voicing, applies song-wide)`;
  if (definition && existing && !isSameVoicing(definition, existing)) {
    return `Replaces the existing {define} for ${name}`;
  }
  if (!definition && existing) return `Removes the custom {define} for ${name}`;
  return null;
}

/**
 * Chord lookup in both directions: a chord name shows its voicings, clicked
 * fretboard positions are identified as chords. Optionally inserts the chord
 * into the songbook.
 */
export function FretboardEditor({ onClose, onInsert, definitions = {} }: FretboardEditorProps) {
  const [db, setDb] = useState<ChordDb | null>(null);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection>({
    kind: 'manual', frets: EMPTY_FRETS, name: null,
  });

  useEffect(() => {
    let cancelled = false;
    loadGuitarChordDb()
      .then((loaded) => { if (!cancelled) setDb(loaded); })
      .catch((error) => console.error('Failed to load chord database:', error));
    return () => { cancelled = true; };
  }, []);

  const queryName = isChord(query.trim()) ? normalizeChord(query.trim()) : null;

  // Stable references: ChordDiagram redraws whenever its voicing object changes
  const voicings = useMemo(
    () => (queryName ? resolveVoicings(db, queryName) : []),
    [db, queryName],
  );

  // Current shape, its fingers and the chord name chosen for it
  const voicing = selection.kind === 'voicing' ? voicings[selection.index] : undefined;
  const shape: FretPositions = voicing
    ?? (selection.kind === 'manual'
      ? positionsFromAbsolute(selection.frets)
      : { frets: EMPTY_FRETS, baseFret: 1 });
  const fingers = voicing?.fingers ?? (selection.kind === 'manual' ? selection.fingers : undefined);

  const notes = voicingToNotes(shape);
  const detected = [...new Set(identifyChord(shape).map(formatChordName))];
  const chosenName = selection.kind === 'voicing'
    ? queryName
    : (selection.name ?? detected[0] ?? null);

  const definition = chosenName ? definitionForShape(db, chosenName, { ...shape, fingers }) : null;
  const hint = onInsert && chosenName
    ? insertHint(chosenName, definition, definitions[chosenName])
    : null;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelection({ kind: 'voicing', index: 0 });
  };

  const handleFretboardChange = (frets: (number | null)[]) => {
    setSelection({ kind: 'manual', frets, name: null });
  };

  const handleNameClick = (name: string) => {
    setSelection({ kind: 'manual', frets: toAbsolute(shape), fingers, name });
  };

  const handleClear = () => {
    setQuery('');
    setSelection({ kind: 'manual', frets: EMPTY_FRETS, name: null });
  };

  const handleInsert = () => {
    if (!onInsert || !chosenName) return;
    onInsert(chosenName, definition);
    onClose();
  };

  // Keep keys inside the dialog: global shortcuts listen on window (space = play)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
      onClick={onClose}
    >
      <div
        role='dialog'
        aria-label='Fretboard Editor'
        className='bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-4xl
                   max-h-full overflow-y-auto flex flex-col gap-4 shadow-2xl outline-none
                   *:shrink-0'
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <h2 className='text-sm font-mono text-slate-200 uppercase tracking-widest'>
          Fretboard Editor
        </h2>

        {/* Chord -> fretboard */}
        <div className='flex flex-col gap-1'>
          <label htmlFor='fretboard-chord' className='text-xs font-mono text-slate-500'>
            Chord
          </label>
          <input
            id='fretboard-chord'
            autoFocus
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && onInsert) handleInsert(); }}
            placeholder='e.g. Am7, D/F#'
            className='bg-slate-900 border border-slate-600 rounded px-3 py-1.5 w-48
                       text-sm font-mono text-slate-200
                       focus:outline-none focus:border-indigo-500'
          />
        </div>

        {queryName && (
          <div className='flex gap-2 overflow-x-auto p-1'>
            {voicings.length === 0 ? (
              <span className='text-xs font-mono text-slate-500'>No voicings for {queryName}</span>
            ) : voicings.map((v, i) => (
              <ChordDiagram
                key={i}
                name={queryName}
                voicing={v}
                variant={{ index: i + 1, total: voicings.length }}
                selected={selection.kind === 'voicing' && selection.index === i}
                onClick={() => setSelection({ kind: 'voicing', index: i })}
              />
            ))}
          </div>
        )}

        <Fretboard frets={toAbsolute(shape)} onChange={handleFretboardChange} />

        {/* Fretboard -> chord */}
        <div className='flex flex-wrap items-center gap-2 font-mono text-xs'>
          <span className='text-slate-500'>Notes:</span>
          <span className='text-slate-300'>{notes.length > 0 ? notes.join(' ') : '-'}</span>
          <span className='text-slate-500 ml-4'>Detected:</span>
          {detected.length === 0 && <span className='text-slate-500'>no chord</span>}
          {detected.map((name) => (
            <button
              key={name}
              type='button'
              onClick={() => handleNameClick(name)}
              aria-pressed={name === chosenName}
              className={`px-2 py-0.5 rounded transition-colors ${
                name === chosenName
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <div className='flex items-center gap-2 pt-2 border-t border-slate-700'>
          <span className='flex-1 text-[11px] font-mono text-amber-300/80'>{hint}</span>
          <button
            type='button'
            onClick={handleClear}
            className='px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400
                       hover:text-slate-200 transition-colors'
          >
            Clear
          </button>
          <button
            type='button'
            onClick={onClose}
            className='px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400
                       hover:text-slate-200 transition-colors'
          >
            Close
          </button>
          {onInsert && (
            <button
              type='button'
              onClick={handleInsert}
              disabled={!chosenName}
              className='px-4 py-1.5 rounded-lg text-xs font-mono font-semibold
                         bg-indigo-600 enabled:hover:bg-indigo-500 text-white
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
            >
              {chosenName ? `Insert ${chosenName}` : 'Insert'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}