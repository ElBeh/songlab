import { useEffect, useMemo, useRef } from 'react';
import { ChordOverview } from './ChordOverview';
import { parseChordPro, type SheetLine, type SheetSection } from '../../utils/chordSheetParser';
import { findSectionForMarker } from '../../utils/songbookSectionMatch';
import { scrollWithLookahead } from '../../utils/scrollLookahead';
import { useResizablePanelHeight } from '../../hooks/useResizablePanelHeight';
import { PanelResizeHandle } from '../Common/PanelResizeHandle';
import { ZoomControls } from '../Common/ZoomControls';
import { usePersistedScale } from '../../hooks/usePersistedScale';
import type { SectionMarker } from '../../types';

/** Elements of the next section kept in view: its heading plus two lines */
const LOOKAHEAD_ELEMENTS = 3;

/** Same default as the notation panel */
const DEFAULT_PANEL_HEIGHT = 400;

interface SongbookViewProps {
  /** Raw ChordPro text of the song */
  chordSheet: string;
  /** Active section marker, used to highlight and scroll to its section */
  activeMarker: SectionMarker | null;
}

function LyricsLine({ line }: { line: Extract<SheetLine, { type: 'lyrics' }> }) {
  const hasChords = line.segments.some((seg) => seg.chord !== null);

  if (!hasChords) {
    return <div className='whitespace-pre-wrap text-slate-200'>{line.segments.map((s) => s.lyric).join('')}</div>;
  }

  // Each segment is a column (chord above lyric). Columns wrap as a unit, so a
  // chord always stays above its syllable, even on narrow screens.
  return (
    <div className='flex flex-wrap items-end'>
      {line.segments.map((seg, i) => (
        <span key={i} className='inline-flex flex-col'>
          <span className='font-mono text-[0.875em] font-bold text-indigo-300 pr-2 min-h-[1.25em]'>
            {seg.chord ?? ' '}
          </span>
          <span className='whitespace-pre text-slate-200'>{seg.lyric || ' '}</span>
        </span>
      ))}
    </div>
  );
}

function SheetLineView({ line }: { line: SheetLine }) {
  switch (line.type) {
    case 'lyrics':
      return <LyricsLine line={line} />;
    case 'comment':
      return <div className='italic text-slate-400'>{line.text}</div>;
    case 'raw':
      return <pre className='font-mono text-[0.875em] text-slate-300 leading-snug'>{line.text}</pre>;
    case 'empty':
      return <div className='h-[0.75em]' />;
  }
}

function SectionView({ section, isActive }: { section: SheetSection; isActive: boolean }) {
  return (
    <section
      className='flex flex-col gap-1 pl-3 py-1 border-l-2 rounded-r transition-colors'
      style={{
        borderColor: isActive ? '#6366f1' : 'transparent',
        backgroundColor: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
      }}
    >
      {section.label && (
        <h4 className='text-[0.75em] font-mono uppercase tracking-widest'
            style={{ color: isActive ? '#a5b4fc' : '#64748b' }}>
          {section.label}
        </h4>
      )}
      {section.isReference && <div className='italic text-slate-400'>(repeat)</div>}
      {section.lines.map((line, i) => <SheetLineView key={i} line={line} />)}
    </section>
  );
}

/**
 * Read-only songbook: title and chord overview stay fixed on top, the sections
 * scroll in a resizable panel below (like the notation panel)
 */
export function SongbookView({ chordSheet, activeMarker }: SongbookViewProps) {
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // Own height once resized; until then the notation panel's height (page mode)
  const { height, isResizing, startResize, adjustHeight } = useResizablePanelHeight({
    configKey: 'songbookPanelHeight',
    fallbackConfigKey: 'notationPanelHeightPage',
    defaultHeight: DEFAULT_PANEL_HEIGHT,
  });

  // Text zoom persisted per device (config store, not exported)
  const { scale, zoomIn, zoomOut } = usePersistedScale({
    configKey: 'songbookScale',
    defaultScale: 1,
    min: 0.7,
    max: 2,
  });

  // Parsing is cheap but runs on every playback tick otherwise
  const sheet = useMemo(() => parseChordPro(chordSheet), [chordSheet]);
  const activeIndex = findSectionForMarker(sheet.sections, activeMarker);

  // Scroll the active section into view when it changes (playback or marker click)
  // Scroll the active section into view together with the heading and first
  // two lines of the next section, so the end of the current part is visible.
  // Runs only when the active section changes (playback or marker click).
  useEffect(() => {
    const active = sectionRefs.current[activeIndex];
    if (!active) return;
    const nextSection = sectionRefs.current[activeIndex + 1]?.querySelector('section');
    const nextLines = nextSection?.children;
    const lookahead = nextLines && nextLines.length > 0
      ? (nextLines[Math.min(LOOKAHEAD_ELEMENTS, nextLines.length) - 1] as HTMLElement)
      : active;
    scrollWithLookahead(active, lookahead);
  }, [activeIndex]);

  const meta = [
    sheet.key && `Key: ${sheet.key}`,
    sheet.capo && `Capo: ${sheet.capo}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className='flex flex-col gap-2'>
      {/* Controls bar, styled like the notation panel's */}
      <div className='flex items-center gap-3'>
        <div className='bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3'>
          <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} />
        </div>
      </div>

      <div className='bg-slate-900 rounded-lg p-4 border border-slate-700 flex flex-col gap-3'>
        {(sheet.title || sheet.artist || meta) && (
          <div className='flex flex-wrap items-baseline gap-x-3'>
            {sheet.title && <span className='text-lg font-semibold text-slate-100'>{sheet.title}</span>}
            {sheet.artist && <span className='text-sm text-slate-400'>{sheet.artist}</span>}
            {meta && <span className='text-xs font-mono text-slate-500'>{meta}</span>}
          </div>
        )}

        <ChordOverview chords={sheet.chords} definitions={sheet.definitions} />

        {/* Scroll container of the auto-scroll (found via overflow-y-auto).
            Text sizes inside are em-based, so the zoom scales all of them. */}
        <div className='overflow-y-auto flex flex-col gap-3' style={{ height, fontSize: `${scale}rem` }}>
          {sheet.sections.map((section, i) => (
            <div key={i} ref={(el) => { sectionRefs.current[i] = el; }}>
              <SectionView section={section} isActive={i === activeIndex} />
            </div>
          ))}
        </div>
      </div>
      <PanelResizeHandle
        label='Resize songbook panel height'
        isResizing={isResizing}
        onResizeStart={startResize}
        onAdjust={adjustHeight}
      />
    </div>
  );
}