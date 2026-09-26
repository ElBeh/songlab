import { useEffect, useRef } from 'react';
import { SVGuitarChord } from 'svguitar';
import { toDiagramData, type ChordVoicing } from '../../utils/chordLookup';

interface ChordDiagramProps {
  name: string;
  /** Voicing to draw; null shows the name with an "unknown chord" placeholder */
  voicing: ChordVoicing | null;
  /** 1-based index and total of available voicings, shown when there are several */
  variant?: { index: number; total: number };
  /** Called on click, e.g. to cycle through voicings */
  onClick?: () => void;
}

// Colors match the slate theme of the app (Tailwind slate-300 / slate-500 / slate-900)
const DIAGRAM_COLORS = {
  color: '#cbd5e1',
  stringColor: '#64748b',
  fretColor: '#64748b',
  fingerColor: '#cbd5e1',
  fingerTextColor: '#0f172a',
  fretLabelColor: '#94a3b8',
  backgroundColor: 'none',
} as const;

/**
 * Guitar chord diagram rendered by svguitar. svguitar draws imperatively into
 * a DOM node, so the component owns a container ref and redraws in an effect.
 */
export function ChordDiagram({ name, voicing, variant, onClick }: ChordDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !voicing) return;

    const { chord, frets } = toDiagramData(voicing);
    const diagram = new SVGuitarChord(container);
    diagram
      .configure({
        ...DIAGRAM_COLORS,
        strings: voicing.frets.length,
        frets,
        fingerSize: 0.75,
        fingerTextSize: 20,
        fretLabelFontSize: 32,
        fontFamily: 'ui-monospace, monospace',
      })
      .chord(chord)
      .draw();

    // Remove the SVG on redraw/unmount; svguitar appends instead of replacing
    return () => diagram.remove();
  }, [voicing]);

  const hasVariants = variant !== undefined && variant.total > 1;
  const isGenerated = voicing?.source === 'generated';

  return (
    <button
      type='button'
      onClick={onClick}
      disabled={!onClick || !hasVariants}
      title={hasVariants ? 'Click for the next voicing' : undefined}
      className='flex flex-col items-center gap-0.5 w-24 p-1 rounded transition-colors
                 enabled:hover:bg-slate-800 disabled:cursor-default'
    >
      <span className='font-mono text-sm font-bold text-indigo-300'>{name}</span>
      {voicing ? (
        <div ref={containerRef} className='w-full' />
      ) : (
        <div className='flex items-center justify-center w-full aspect-square
                        text-slate-600 font-mono text-xs border border-dashed
                        border-slate-700 rounded'>
          no diagram
        </div>
      )}
      {(hasVariants || isGenerated) && (
        <span className='font-mono text-[10px] text-slate-500'>
          {hasVariants && `${variant.index}/${variant.total}`}
          {hasVariants && isGenerated && ' · '}
          {isGenerated && (
            <span title='Computed voicing, not from the chord database'>auto</span>
          )}
        </span>
      )}
    </button>
  );
}