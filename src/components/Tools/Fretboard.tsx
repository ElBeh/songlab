import { Note } from 'tonal';
import { STANDARD_TUNING, tuningToMidi, type Tuning } from '../../utils/fretboard';

interface FretboardProps {
  /** Absolute fret per string from low to high; null = muted, 0 = open */
  frets: (number | null)[];
  onChange: (frets: (number | null)[]) => void;
  tuning?: Tuning;
}

/** Frets 1..FRET_COUNT are shown; must match the grid template below */
const FRET_COUNT = 15;
const FRET_NUMBERS = Array.from({ length: FRET_COUNT }, (_, i) => i + 1);
const INLAY_FRETS = new Set([3, 5, 7, 9, 12, 15]);

// Columns: string label, nut (open/muted), frets 1-15
const GRID_CLASS = 'grid grid-cols-[1.5rem_2rem_repeat(15,minmax(2.25rem,1fr))]';

/** Pitch class without octave, sharps as on guitar charts */
function noteName(midi: number): string {
  return Note.pitchClass(Note.fromMidiSharps(midi));
}

/**
 * Clickable guitar fretboard, drawn like a tab: highest string on top.
 * One note per string. Clicking a fret sets it, clicking it again mutes the
 * string; the nut column toggles between open and muted.
 */
export function Fretboard({ frets, onChange, tuning = STANDARD_TUNING }: FretboardProps) {
  const openMidi = tuningToMidi(tuning);
  const stringIndices = openMidi.map((_, i) => i).reverse();

  // Tab labels: the highest string is lowercase if it shares the lowest string's name
  const labels = openMidi.map(noteName);
  const lastIndex = labels.length - 1;
  if (lastIndex > 0 && labels[lastIndex] === labels[0]) {
    labels[lastIndex] = labels[lastIndex].toLowerCase();
  }

  const setFret = (stringIndex: number, fret: number | null) => {
    const next = [...frets];
    next[stringIndex] = fret;
    onChange(next);
  };

  const handleFretClick = (stringIndex: number, fret: number) => {
    setFret(stringIndex, frets[stringIndex] === fret ? null : fret);
  };

  const handleNutClick = (stringIndex: number) => {
    setFret(stringIndex, frets[stringIndex] === 0 ? null : 0);
  };

  return (
    <div className='overflow-x-auto font-mono text-xs select-none'>
      <div className='min-w-max' role='group' aria-label='Fretboard'>
        {stringIndices.map((stringIndex) => {
          const current = frets[stringIndex] ?? null;
          const open = openMidi[stringIndex];
          return (
            <div key={stringIndex} className={`${GRID_CLASS} h-8`}>
              <span className='flex items-center justify-center text-slate-500'>
                {labels[stringIndex]}
              </span>

              <button
                type='button'
                onClick={() => handleNutClick(stringIndex)}
                aria-label={`String ${labels[stringIndex]}: ${current === 0 ? 'open' : 'muted'}`}
                aria-pressed={current === 0}
                className='flex items-center justify-center border-r-4 border-slate-300
                           hover:bg-slate-700/40 transition-colors'
              >
                {current === 0 && (
                  <span className='flex items-center justify-center w-6 h-6 rounded-full
                                   border-2 border-indigo-400 text-indigo-200 text-[10px]'>
                    {noteName(open)}
                  </span>
                )}
                {current === null && <span className='text-slate-500'>x</span>}
              </button>

              {FRET_NUMBERS.map((fret) => {
                const active = current === fret;
                return (
                  <button
                    key={fret}
                    type='button'
                    onClick={() => handleFretClick(stringIndex, fret)}
                    aria-label={`String ${labels[stringIndex]}, fret ${fret}`}
                    aria-pressed={active}
                    className='relative flex items-center justify-center border-r
                               border-slate-500 hover:bg-slate-700/40
                               transition-colors'
                  >
                    {/* The string itself */}
                    <span className='absolute inset-x-0 top-1/2 h-px bg-slate-500' />
                    {active && (
                      <span className='relative flex items-center justify-center w-6 h-6
                                       rounded-full bg-indigo-400 text-slate-900 text-[10px]
                                       font-bold'>
                        {noteName(open + fret)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Fret numbers at the usual inlay positions */}
        <div className={`${GRID_CLASS} h-5 text-[10px] text-slate-500`}>
          <span />
          <span />
          {FRET_NUMBERS.map((fret) => (
            <span key={fret} className='flex items-center justify-center'>
              {INLAY_FRETS.has(fret) ? fret : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}