import { useState } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useSetlistStore } from '../../stores/useSetlistStore';
import { useModeStore } from '../../stores/useModeStore';
import { MarkerList } from '../Markers/MarkerList';
import { ImportExportPanel } from './ImportExportPanel';
import { SetlistSelector } from './SetlistSelector';
import { SetlistItemList } from './SetlistItemList';
import { useTabStore } from '../../stores/useTabStore';
import { ChevronsRight, ChevronsLeft, ChevronRight } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';
import { useShallow } from 'zustand/shallow';

interface SidebarProps {
  onSeekTo: (time: number) => void;
  duration: number;
  currentTime: number;
  isViewer?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onAddMarker?: () => void;
  onAddSong?: () => void;
  onCreateDummy?: () => void;
}

export function Sidebar({ onSeekTo, duration, currentTime, isViewer = false, collapsed = false, onToggleCollapse, onAddMarker, onAddSong, onCreateDummy }: SidebarProps) {
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [setlistOpen, setSetlistOpen] = useState(true);
  // --- Song store ---
  const songs = useSongStore((state) => state.songs);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const markersBySong = useSongStore((state) => state.markersBySong);

  // --- Setlist store ---
  const songOrder = useSetlistStore(useShallow((state) => {
    const active = state.setlists.find((s) => s.id === state.activeSetlistId);
    return active?.items ?? [];
  }));

  // Derived from the subscribed songs/activeSongId state (reactive)
  const activeSong = songs.find((s) => s.id === activeSongId) ?? null;
  // Reactive join of setlist order + song library (replaces non-reactive getters)
  const isSession = useModeStore((state) => state.mode) === 'session';
  const canEdit = !isViewer && !isSession;

  const markerCount = activeSongId ? (markersBySong[activeSongId] ?? []).length : 0;
  const songCount = songOrder.filter((i) => i.type === 'song').length;

  // --- Collapsed: thin vertical strip with expand button ---
  if (collapsed) {
    return (
      <aside className='w-10 border-r border-slate-700 flex flex-col items-center
                         py-2 gap-2 transition-all'>
        <button
          onClick={onToggleCollapse}
          className='w-8 h-8 flex items-center justify-center rounded
                     text-slate-400 hover:text-white hover:bg-slate-700
                     transition-colors text-sm'
          title='Expand sidebar'
        >
          <ChevronsRight size={ICON_SIZE.ACTION} />
        </button>
      </aside>
    );
  }

  return (
    <aside className={`${isSession ? 'w-48' : 'w-64'} border-r border-slate-700 flex flex-col overflow-y-auto transition-all`}>

      {/* Collapse button */}
      <button
        onClick={onToggleCollapse}
        className='flex items-center justify-center py-1.5 border-b border-slate-700
                   text-slate-500 hover:text-white hover:bg-slate-800/50
                   transition-colors text-sm'
        title='Collapse sidebar'
      >
        <ChevronsLeft size={ICON_SIZE.ACTION} />
      </button>

      {/* ── Sections accordion ── */}
      {!isSession && (
        <div className='flex flex-col'>
          {/* Header */}
          <button
            onClick={() => setSectionsOpen((v) => !v)}
            className='flex items-center gap-2 px-4 py-2.5 border-b border-slate-700
                       hover:bg-slate-800/50 transition-colors text-left'
          >
            <span className='text-slate-500 transition-transform'
                  style={{ transform: sectionsOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <ChevronRight size={ICON_SIZE.ACCORDION} />
            </span>
            <span className='text-xs font-mono uppercase tracking-widest text-slate-400 flex-1'>
              Sections
            </span>
            {markerCount > 0 && (
              <span className='text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5
                               rounded-full'>
                {markerCount}
              </span>
            )}
          </button>

          {/* Content */}
          {sectionsOpen && (
            <div className='flex flex-col'>
              <div className='p-4'>
                <MarkerList
                  onSeekTo={onSeekTo}
                  duration={duration}
                  currentTime={currentTime}
                  onMarkerSelect={(id) => useTabStore.getState().setActiveMarker(id)}
                />
              </div>

              {/* Add marker button */}
              {activeSong && onAddMarker && (
                <div className='p-3 flex justify-center'>
                  <button
                    onClick={onAddMarker}
                    className='px-3 py-1.5 text-xs font-mono text-slate-300
                              bg-slate-800 border border-dashed border-slate-600
                              hover:text-slate-200 hover:border-slate-400 rounded
                              transition-colors'
                  >
                    + add marker
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* ── Setlist accordion ── */}
      <div className='flex flex-col border-t border-slate-400'>
        {/* Header */}
        <button
          onClick={() => setSetlistOpen((v) => !v)}
          className='flex items-center gap-2 px-4 py-2.5 border-b border-slate-700
                     hover:bg-slate-800/50 transition-colors text-left'
        >
          <span className='text-slate-500 transition-transform'
                style={{ transform: setlistOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <ChevronRight size={ICON_SIZE.ACCORDION} />
          </span>
          <span className='text-xs font-mono uppercase tracking-widest text-slate-400 flex-1'>
            Setlist
          </span>
          {songCount > 0 && (
            <span className='text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5
                             rounded-full'>
              {songCount}
            </span>
          )}
        </button>

        {/* Content */}
        {setlistOpen && (
          <div className='flex flex-col p-4 gap-4'>
            {/* Setlist selector row + management dropdown */}
            <SetlistSelector canEdit={canEdit} />

            {/* Search, ordered song/pause list, add actions */}
            <SetlistItemList
              isViewer={isViewer}
              canEdit={canEdit}
              onAddSong={onAddSong}
              onCreateDummy={onCreateDummy}
            />
          </div>
        )}
      </div>

      {/* Import / Export menu + URL import dialog (practice mode only) */}
      <ImportExportPanel />

    </aside>
  );
}