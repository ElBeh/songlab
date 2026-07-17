import { useState, useRef } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useSetlistStore } from '../../stores/useSetlistStore';
import { useOrderedSetlist } from '../../hooks/useOrderedSetlist';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useModeStore } from '../../stores/useModeStore';
import { useTabStore } from '../../stores/useTabStore';
import { useToastStore } from '../../stores/useToastStore';
import { exportSong, exportSetlist, exportGig, importFile } from '../../services/exportService';
import { UrlImportDialog } from './UrlImportDialog';
import { ChevronRight, Download, Upload } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';
import { useShallow } from 'zustand/shallow';

/**
 * Import/Export menu pinned to the sidebar bottom (practice mode only),
 * including the URL import dialog. Extracted from Sidebar (C5 split, block 1).
 */
export function ImportExportPanel() {
  const [showImportExport, setShowImportExport] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const importExportRef = useRef<HTMLDivElement>(null);

  useClickOutside(
    importExportRef,
    () => {
      setShowImportExport(false);
      setShowExportOptions(false);
    },
    showImportExport,
  );

  // --- Song store ---
  const songs = useSongStore((state) => state.songs);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const setActiveSongId = useSongStore((state) => state.setActiveSongId);
  const addSong = useSongStore((state) => state.addSong);
  const activeSong = songs.find((s) => s.id === activeSongId) ?? null;

  // --- Setlist store ---
  const allSetlists = useSetlistStore((state) => state.setlists);
  const activeSetlistId = useSetlistStore((state) => state.activeSetlistId);
  const activeSetlist = allSetlists.find((s) => s.id === activeSetlistId);
  const songOrder = useSetlistStore(useShallow((state) => {
    const active = state.setlists.find((s) => s.id === state.activeSetlistId);
    return active?.items ?? [];
  }));
  const switchSetlist = useSetlistStore((state) => state.switchSetlist);
  const createSetlist = useSetlistStore((state) => state.createSetlist);

  const { orderedSongs } = useOrderedSetlist();
  const addToast = useToastStore((state) => state.addToast);
  const isSession = useModeStore((state) => state.mode) === 'session';

  const closeMenus = () => {
    setShowImportExport(false);
    setShowExportOptions(false);
  };

  const handleExportSong = async () => {
    if (!activeSong) return;
    try {
      await exportSong(activeSong);
      addToast(`Exported "${activeSong.title}"`, 'success');
    } catch (error) {
      console.error('Song export failed:', error);
      addToast('Export failed', 'error');
    }
  };

  const handleExportSetlist = async () => {
    const name = activeSetlist?.name ?? 'Setlist';
    try {
      await exportSetlist(name, songOrder, orderedSongs);
      addToast(`Exported "${name}"`, 'success');
    } catch (error) {
      console.error('Setlist export failed:', error);
      addToast('Export failed', 'error');
    }
  };

  const handleExportGig = async () => {
    const allItems = allSetlists.map((sl) => ({
      name: sl.name,
      items: sl.items,
    }));
    try {
      await exportGig(allItems, songs);
      addToast('Exported gig', 'success');
    } catch (error) {
      console.error('Gig export failed:', error);
      addToast('Export failed', 'error');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const result = await importFile(file);

        if (result.type === 'song') {
          // Single song import
          await addSong(result.song);
          await useSetlistStore.getState().addSongToActiveSetlist(result.song.id);
          await setActiveSongId(result.song.id);
          await useTabStore.getState().loadTabsForSong(result.song.id);
          await useTabStore.getState().loadSheetsForSong(result.song.id);
          addToast(`Imported "${result.song.title}"`, 'success');
        } else {
          // Gig / setlist import (one or more setlists)
          for (const song of result.songs) {
            await addSong(song);
          }

          let firstSetlistId: string | null = null;
          for (const sl of result.setlists) {
            const id = await createSetlist(sl.name);
            await useSetlistStore.getState().setActiveItems(sl.items);
            if (!firstSetlistId) firstSetlistId = id;
          }

          if (firstSetlistId) {
            switchSetlist(firstSetlistId);
          }
          if (result.songs.length > 0) {
            await setActiveSongId(result.songs[0].id);
            await useTabStore.getState().loadTabsForSong(result.songs[0].id);
            await useTabStore.getState().loadSheetsForSong(result.songs[0].id);
          }

          const setlistCount = result.setlists.length;
          const importedSongCount = result.songs.length;
          const label = setlistCount > 1
            ? `Imported ${setlistCount} setlists with ${importedSongCount} song(s)`
            : `Imported ${importedSongCount} song(s)`;
          addToast(label, 'success');
        }
      } catch (err) {
        console.error('Import failed:', err);
        addToast('Import failed', 'error');
      }
    };
    input.click();
  };

  // Import/Export is available in practice mode only
  if (isSession) return null;

  return (
    <>
      <div className='mt-auto border-t border-slate-700 p-3' ref={importExportRef}>
        <div className='relative'>
          <button
            onClick={() => {
              setShowImportExport((v) => !v);
            }}
            className='w-full px-2 py-1.5 text-xs font-mono rounded transition-colors
                       bg-slate-700 hover:bg-slate-600 text-slate-300'
          >
            Import / Export
          </button>
          {showImportExport && (
            <div className='absolute left-0 right-0 bottom-full mb-1 bg-slate-800 border
                            border-slate-600 rounded-lg shadow-xl py-1 z-50'>
              <button
                onClick={() => {
                  handleImport();
                  closeMenus();
                }}
                className='w-full text-left px-3 py-1.5 text-xs font-mono
                           text-slate-300 hover:bg-slate-700 transition-colors'
              >
                <Upload size={ICON_SIZE.ACTION} className='inline-block' /> Import
              </button>
              <button
                onClick={() => {
                  setShowUrlImport(true);
                  closeMenus();
                }}
                className='w-full text-left px-3 py-1.5 text-xs font-mono
                           text-slate-300 hover:bg-slate-700 transition-colors'
              >
                <Upload size={ICON_SIZE.ACTION} className='inline-block' /> Import from URL
              </button>
              <div className='border-t border-slate-700 my-1' />
              <button
                onClick={() => setShowExportOptions((v) => !v)}
                className='w-full text-left px-3 py-1.5 text-xs font-mono
                           text-slate-300 hover:bg-slate-700 transition-colors
                           flex items-center justify-between'
              >
                <span><Download size={ICON_SIZE.ACTION} className='inline-block' /> Export</span>
                <ChevronRight
                  size={ICON_SIZE.ACTION}
                  className={`transition-transform ${showExportOptions ? 'rotate-90' : ''}`}
                />
              </button>
              {showExportOptions && (
                <>
                  {activeSong && (
                    <button
                      onClick={() => {
                        handleExportSong();
                        closeMenus();
                      }}
                      className='w-full text-left pl-6 pr-3 py-1.5 text-xs font-mono
                                 text-slate-400 hover:text-slate-300 hover:bg-slate-700
                                 transition-colors'
                    >
                      Song
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleExportSetlist();
                      closeMenus();
                    }}
                    disabled={songOrder.length === 0}
                    className='w-full text-left pl-6 pr-3 py-1.5 text-xs font-mono
                               text-slate-400 hover:text-slate-300 hover:bg-slate-700
                               transition-colors
                               disabled:opacity-30 disabled:cursor-not-allowed'
                  >
                    Setlist
                  </button>
                  <button
                    onClick={() => {
                      handleExportGig();
                      closeMenus();
                    }}
                    disabled={allSetlists.length === 0}
                    className='w-full text-left pl-6 pr-3 py-1.5 text-xs font-mono
                               text-slate-400 hover:text-slate-300 hover:bg-slate-700
                               transition-colors
                               disabled:opacity-30 disabled:cursor-not-allowed'
                  >
                    Gig
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* URL Import Dialog */}
      {showUrlImport && (
        <UrlImportDialog
          onClose={() => setShowUrlImport(false)}
          onImported={async (result) => {
            try {
              for (const song of result.songs) {
                await addSong(song);
              }
              await createSetlist(result.name);
              await useSetlistStore.getState().setActiveItems(result.items);
              if (result.songs.length > 0) {
                await setActiveSongId(result.songs[0].id);
                await useTabStore.getState().loadTabsForSong(result.songs[0].id);
                await useTabStore.getState().loadSheetsForSong(result.songs[0].id);
              }
            } catch (error) {
              console.error('URL import failed:', error);
              addToast('Import failed', 'error');
            }
          }}
        />
      )}
    </>
  );
}