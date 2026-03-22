import { useRef, useEffect, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';

interface NotationPanelProps {
  gpData: ArrayBuffer;
  songId: string;
}

export function NotationPanel({ gpData, songId }: NotationPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const layoutRef = useRef<'page' | 'horizontal'>('page');

  const [tracks, setTracks] = useState<{ index: number; name: string }[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [layout, setLayout] = useState<'page' | 'horizontal'>('page');

  // Keep ref in sync
  useEffect(() => {
  layoutRef.current = layout;
    }, [layout]);

  // Initialize alphaTab API
  useEffect(() => {
    if (!containerRef.current) return;

   const settings = new alphaTab.Settings();
    settings.core.fontDirectory = import.meta.env.BASE_URL + 'font/';
    settings.display.scale = 0.5;  
    settings.player.playerMode = alphaTab.PlayerMode.Disabled;
    settings.display.layoutMode =
      layoutRef.current === 'page' ? alphaTab.LayoutMode.Page : alphaTab.LayoutMode.Horizontal;

    const api = new alphaTab.AlphaTabApi(containerRef.current, settings);

    api.scoreLoaded.on((score) => {
      const trackList = score.tracks.map((t, i) => ({
        index: i,
        name: t.name || `Track ${i + 1}`,
      }));
      setTracks(trackList);
      setActiveTrackIndex(0);
    });

    apiRef.current = api;

    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, [songId]);

  // Load GP data into alphaTab
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !gpData) return;

    const uint8 = new Uint8Array(gpData);
    api.load(uint8);
  }, [gpData, songId]);

  // Update layout when toggled
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    api.settings.display.layoutMode =
      layout === 'page' ? alphaTab.LayoutMode.Page : alphaTab.LayoutMode.Horizontal;
    api.updateSettings();
    api.render();
  }, [layout]);

  // Switch track
  useEffect(() => {
    const api = apiRef.current;
    if (!api?.score) return;

    const track = api.score.tracks[activeTrackIndex];
    if (track) {
      api.renderTracks([track]);
    }
  }, [activeTrackIndex]);

  return (
    <div className='flex flex-col gap-2 flex-1 min-h-64'>
      {/* Controls bar */}
      <div className='flex items-center gap-3'>
        {/* Track selector */}
        {tracks.length > 1 && (
          <select
            value={activeTrackIndex}
            onChange={(e) => setActiveTrackIndex(Number(e.target.value))}
            className='bg-slate-800 text-slate-200 text-xs font-mono rounded
                       px-2 py-1 border border-slate-600 focus:border-indigo-500
                       outline-none'
          >
            {tracks.map((t) => (
              <option key={t.index} value={t.index}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {/* Layout toggle */}
        <button
          onClick={() => setLayout((l) => (l === 'page' ? 'horizontal' : 'page'))}
          className='px-2 py-1 text-xs font-mono rounded transition-colors
                     bg-slate-700 hover:bg-slate-600 text-slate-300'
        >
          {layout === 'page' ? '↔ Horizontal' : '↕ Page'}
        </button>
      </div>

      {/* alphaTab render container */}
        <div
        ref={containerRef}
        className='overflow-auto bg-white rounded'
        style={{ height: '400px' }}
        />
    </div>
  );
}