import { useRef, useEffect } from 'react';
import type { SectionMarker } from '../../types';
import { useTabStore } from '../../stores/useTabStore';

interface TabViewerProps {
  marker: SectionMarker;
  currentTime: number;
  isPlaying: boolean;
  sectionEnd: number;
}

export function TabViewer({ marker, currentTime, isPlaying, sectionEnd }: TabViewerProps) {
  const tabs = useTabStore((state) => state.tabs);
  const containerRef = useRef<HTMLDivElement>(null);

  const tab = tabs[marker.id];
  const content = tab?.content ?? '';

  // Auto-scroll during playback
  useEffect(() => {
    if (!isPlaying || !containerRef.current || !content || !sectionEnd) return;

    const progress = (currentTime - marker.startTime) / (sectionEnd - marker.startTime);
    const container = containerRef.current;
    const scrollMax = container.scrollHeight - container.clientHeight;
    container.scrollTop = Math.max(0, Math.min(scrollMax, progress * scrollMax));
  }, [currentTime, isPlaying, content, marker, sectionEnd]);

  if (!content) {
    return (
      <div className='flex items-center justify-center h-full'>
        <p className='text-sm text-slate-600 font-mono'>No tab for "{marker.label}" yet.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className='h-full overflow-y-auto bg-slate-900 rounded p-3
                 border border-slate-700 font-mono text-sm text-slate-200
                 leading-relaxed whitespace-pre'
    >
      {content}
    </div>
  );
}