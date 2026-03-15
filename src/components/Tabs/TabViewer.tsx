import { useRef, useEffect } from 'react';
import { useTabStore } from '../../stores/useTabStore';
import { SheetBar } from './SheetBar';
import type { SectionMarker } from '../../types';

interface TabViewerProps {
  marker: SectionMarker;
  currentTime: number;
  isPlaying: boolean;
  sectionEnd: number;
  isViewer?: boolean;
}

export function TabViewer({ marker, currentTime, isPlaying, sectionEnd, isViewer = false }: TabViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSheetId = useTabStore((state) => state.activeSheetId);
  const getTabForMarkerAndSheet = useTabStore((state) => state.getTabForMarkerAndSheet);

  const tab = activeSheetId
    ? getTabForMarkerAndSheet(marker.id, activeSheetId)
    : null;

  // Auto-scroll during playback
  useEffect(() => {
    if (!isPlaying || !scrollRef.current || !tab?.content) return;
    const el = scrollRef.current;
    const sectionDuration = sectionEnd - marker.startTime;
    if (sectionDuration <= 0) return;
    const progress = (currentTime - marker.startTime) / sectionDuration;
    const scrollMax = el.scrollHeight - el.clientHeight;
    el.scrollTop = progress * scrollMax;
  }, [currentTime, isPlaying, marker.startTime, sectionEnd, tab?.content]);

  return (
    <div className='flex flex-col gap-2 flex-1'>
      {/* Sheet bar */}
      <SheetBar songId={marker.songId} isViewer={isViewer} />

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
              ? `No tab for ${marker.label ?? marker.type} yet`
              : 'Add a sheet above to view tabs'}
          </div>
        )}
      </div>
    </div>
  );
}