import { useRef, useEffect } from 'react';
import { useTabStore } from '../../stores/useTabStore';
import { SheetBar } from './SheetBar';
import type { SectionMarker } from '../../types';
import { resolveTab } from '../../utils/tabScope';

interface TabViewerProps {
  /** Active marker, null shows the whole-song tab */
  marker: SectionMarker | null;
  songId: string;
  currentTime: number;
  isPlaying: boolean;
  /** End of the active marker's section in seconds */
  sectionEnd: number;
  /** Song duration in seconds, used for whole-song tab scrolling */
  songDuration: number;
  isViewer?: boolean;
}

export function TabViewer({
  marker,
  songId,
  currentTime,
  isPlaying,
  sectionEnd,
  songDuration,
  isViewer = false,
}: TabViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSheetId = useTabStore((state) => state.activeSheetId);
  const tabs = useTabStore((state) => state.tabs);

  const resolved = activeSheetId
    ? resolveTab(tabs, songId, marker?.id ?? null, activeSheetId)
    : null;
  const tab = resolved?.tab ?? null;

  // A marker tab scrolls across its section, a whole-song tab across the song
  const isSectionTab = resolved !== null && marker !== null && resolved.scopeId === marker.id;
  const scrollStart = isSectionTab ? marker.startTime : 0;
  const scrollEnd = isSectionTab ? sectionEnd : songDuration;

  // Auto-scroll during playback
  useEffect(() => {
    if (!isPlaying || !scrollRef.current || !tab?.content) return;
    const el = scrollRef.current;
    const range = scrollEnd - scrollStart;
    if (range <= 0) return;
    const progress = Math.min(Math.max((currentTime - scrollStart) / range, 0), 1);
    const scrollMax = el.scrollHeight - el.clientHeight;
    el.scrollTop = progress * scrollMax;
  }, [currentTime, isPlaying, scrollStart, scrollEnd, tab?.content]);

  return (
    <div className='flex flex-col gap-2 flex-1'>
      {/* Sheet bar */}
      <SheetBar songId={songId} isViewer={isViewer} />

      <div
        ref={scrollRef}
        className='flex-1 min-h-48 bg-slate-900 rounded-lg p-4 border border-slate-700
                   overflow-y-auto'
      >
        {tab?.content ? (
          <pre className='font-mono text-sm text-slate-200 leading-relaxed whitespace-pre'>
            {tab.content}
          </pre>
        ) : (
          <div className='flex items-center justify-center h-full text-slate-600 font-mono text-sm'>
            {activeSheetId
              ? 'No tab for this song yet'
              : 'Add a sheet above to view tabs'}
          </div>
        )}
      </div>
    </div>
  );
}