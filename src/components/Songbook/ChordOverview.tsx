import { useEffect, useMemo, useState } from 'react';
import { ChordDiagram } from './ChordDiagram';
import {
  loadGuitarChordDb,
  resolveVoicings,
  type ChordDb,
} from '../../utils/chordLookup';
import type { ChordDefinition } from '../../utils/chordSheetParser';

interface ChordOverviewProps {
  /** Unique chords of the song in order of first appearance */
  chords: string[];
  /** Custom voicings from {define}; they take precedence over the database */
  definitions: Record<string, ChordDefinition>;
}

/** Row of chord diagrams for all chords used in the song */
export function ChordOverview({ chords, definitions }: ChordOverviewProps) {
  const [db, setDb] = useState<ChordDb | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Selected voicing per chord name; resets naturally for new chord names
  const [variantIndex, setVariantIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    loadGuitarChordDb()
      .then((loaded) => { if (!cancelled) setDb(loaded); })
      .catch((error) => {
        console.error('Failed to load chord database:', error);
        if (!cancelled) setLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Stable voicing objects: ChordDiagram redraws its SVG whenever the voicing
  // reference changes, so they must not be recreated on every playback tick
  const voicingsByChord = useMemo(
    () => Object.fromEntries(chords.map((name) => [
      name,
      resolveVoicings(db, name, { definition: definitions[name] }),
    ])),
    [db, chords, definitions],
  );

  if (chords.length === 0) return null;

  const isLoading = db === null && !loadFailed;

  return (
    <div className='flex flex-wrap gap-2 pb-3 border-b border-slate-700'>
      {chords.map((name) => {
        const voicings = voicingsByChord[name];
        const index = (variantIndex[name] ?? 0) % Math.max(voicings.length, 1);
        const cycle = () => setVariantIndex((prev) => ({ ...prev, [name]: index + 1 }));

        return isLoading ? (
          <div key={name} className='w-24 p-1 text-center font-mono text-sm text-slate-500'>
            {name}
          </div>
        ) : (
          <ChordDiagram
            key={name}
            name={name}
            voicing={voicings[index] ?? null}
            variant={{ index: index + 1, total: voicings.length }}
            onClick={cycle}
          />
        );
      })}
    </div>
  );
}