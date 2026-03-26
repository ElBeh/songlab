import { useState } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { useSyncStore } from '../../stores/useSyncStore';
import { useTempoStore } from '../../stores/useTempoStore';
import { useTabStore } from '../../stores/useTabStore';
import {
  emitControlCommand,
  emitControllerRequest,
  emitControllerRelease,
} from '../../services/syncEmitter';

type Tab = 'setlist' | 'sections';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RemoteControlView() {
  const [activeTab, setActiveTab] = useState<Tab>('setlist');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  // --- Store data ---
  const activeSong = useSongStore((s) => s.getActiveSong)();
  const markers = useSongStore((s) => s.getActiveMarkers)();
  const songOrder = useSongStore((s) => s.songOrder);
  const songs = useSongStore((s) => s.songs);
  const activeSongId = useSongStore((s) => s.activeSongId);

  const syncedTime = useSyncStore((s) => s.syncedTime);
  const syncedIsPlaying = useSyncStore((s) => s.syncedIsPlaying);
  const isController = useSyncStore((s) => s.isController);

  const playbackRate = useTempoStore((s) => s.playbackRate);

  const activeMarkerId = useTabStore((s) => s.activeMarkerId);

  // --- Derived ---
  const duration = activeSong?.duration ?? 0;
  const sortedMarkers = [...markers].sort((a, b) => a.startTime - b.startTime);
  const activeMarker = sortedMarkers.find((m) => m.id === activeMarkerId);
  const activeMarkerIdx = activeMarker
    ? sortedMarkers.indexOf(activeMarker)
    : -1;
  const nextMarker = activeMarkerIdx >= 0
    ? sortedMarkers[activeMarkerIdx + 1] ?? null
    : null;

  const songMap = new Map(songs.map((s) => [s.id, s]));
  const songItems = songOrder.filter((item) => item.type === 'song');

  // --- Handlers ---
  const handleToggleController = () => {
    if (isController) {
      emitControllerRelease();
    } else {
      emitControllerRequest();
    }
  };

  const handlePlayPause = () => {
    emitControlCommand({ type: syncedIsPlaying ? 'pause' : 'play' });
  };

    const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(syncedTime);
  };

  const handleSeekChange = (value: number) => {
    setSeekValue(value);
  };

  const handleSeekEnd = (value: number) => {
    emitControlCommand({ type: 'seek', value: Math.max(0, Math.min(duration, value)) });
    setIsSeeking(false);
  };

  const handleSeekButton = (offset: number) => {
    const target = Math.max(0, Math.min(duration, syncedTime + offset));
    emitControlCommand({ type: 'seek', value: target });
  };

  const handlePrevSong = () => {
    emitControlCommand({ type: 'prevSong' });
  };

  const handleNextSong = () => {
    emitControlCommand({ type: 'nextSong' });
  };

  const handleTempoChange = (delta: number) => {
    const newRate = Math.min(1.5, Math.max(0.5, playbackRate + delta));
    emitControlCommand({ type: 'tempoChange', value: newRate });
  };

  const handleSectionJump = (startTime: number) => {
    emitControlCommand({ type: 'seek', value: startTime });
  };

  const handleSongJump = (songId: string) => {
    emitControlCommand({ type: 'songSelect', songId });
  };

  return (
    <div className='flex flex-col h-full bg-slate-900 text-slate-200 select-none'>

      {/* Controller toggle */}
      <div className='px-4 pt-3 pb-2'>
        <button
          onClick={handleToggleController}
          className='w-full py-2 rounded-lg font-mono text-sm transition-colors'
          style={{
            backgroundColor: isController ? '#dc2626' : '#6366f1',
            color: '#fff',
          }}
        >
          {isController ? 'Release Control' : 'Take Control'}
        </button>
      </div>

      {/* Song info header */}
      <div className='px-4 py-2 border-b border-slate-700'>
        <div className='flex items-center justify-between'>
          <span className='font-mono text-sm text-slate-200 truncate flex-1'>
            {activeSong?.title ?? 'No song loaded'}
          </span>
          <span className='font-mono text-sm text-slate-400 ml-2 whitespace-nowrap'>
            {formatTime(syncedTime)} / {formatTime(duration)}
          </span>
        </div>
        <div className='flex items-center gap-2 mt-1 text-xs font-mono'>
          {activeMarker ? (
            <>
              <span style={{ color: activeMarker.color }}>▸ {activeMarker.label}</span>
              {nextMarker && (
                <span className='text-slate-500'>→ {nextMarker.label}</span>
              )}
            </>
          ) : (
            <span className='text-slate-500'>No active section</span>
          )}
        </div>
      </div>

      {/* Scrub slider + seek buttons */}
      <div className='px-4 py-3 border-b border-slate-700'>
        <div className='flex items-center gap-3'>
          <button
            onClick={() => handleSeekButton(-5)}
            disabled={!isController}
            className='font-mono text-xs text-slate-400 hover:text-white
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors min-w-[32px]'
          >
            −5s
          </button>
          <input
            type='range'
            min={0}
            max={duration || 1}
            step={0.1}
            value={isSeeking ? seekValue : syncedTime}
            onPointerDown={handleSeekStart}
            onInput={(e) => handleSeekChange(parseFloat((e.target as HTMLInputElement).value))}
            onPointerUp={(e) => handleSeekEnd(parseFloat((e.target as HTMLInputElement).value))}
            disabled={!isController}
            className='flex-1 accent-indigo-500 h-2 disabled:opacity-30'
          />
          <button
            onClick={() => handleSeekButton(5)}
            disabled={!isController}
            className='font-mono text-xs text-slate-400 hover:text-white
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors min-w-[32px]'
          >
            +5s
          </button>
        </div>
      </div>

      {/* Transport: Prev / Play-Pause / Next */}
      <div className='px-4 py-3 border-b border-slate-700'>
        <div className='flex items-center justify-center gap-6'>
          <button
            onClick={handlePrevSong}
            disabled={!isController}
            className='w-12 h-12 flex items-center justify-center rounded-full
                       bg-slate-700 hover:bg-slate-600 text-xl
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
          >
            ⏮
          </button>
          <button
            onClick={handlePlayPause}
            disabled={!isController}
            className='w-14 h-14 flex items-center justify-center rounded-full
                       bg-indigo-500 hover:bg-indigo-400 text-white text-2xl
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
          >
            {syncedIsPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={handleNextSong}
            disabled={!isController}
            className='w-12 h-12 flex items-center justify-center rounded-full
                       bg-slate-700 hover:bg-slate-600 text-xl
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
          >
            ⏭
          </button>
        </div>

        {/* Tempo */}
        <div className='flex items-center justify-center gap-3 mt-3'>
          <span className='font-mono text-xs text-slate-400'>Tempo</span>
          <button
            onClick={() => handleTempoChange(-0.05)}
            disabled={!isController}
            className='w-8 h-8 flex items-center justify-center rounded
                       bg-slate-700 hover:bg-slate-600 font-mono text-sm
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
          >
            −
          </button>
          <span className='font-mono text-sm text-slate-200 w-12 text-center'>
            {Math.round(playbackRate * 100)}%
          </span>
          <button
            onClick={() => handleTempoChange(0.05)}
            disabled={!isController}
            className='w-8 h-8 flex items-center justify-center rounded
                       bg-slate-700 hover:bg-slate-600 font-mono text-sm
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
          >
            +
          </button>
        </div>
      </div>

      {/* Tab bar: Setlist / Sections */}
      <div className='flex bg-slate-800 border-b border-slate-700'>
        {(['setlist', 'sections'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className='flex-1 py-2 font-mono text-xs uppercase tracking-wider
                       transition-colors'
            style={{
              backgroundColor: activeTab === tab ? '#1e293b' : 'transparent',
              color: activeTab === tab ? '#e2e8f0' : '#64748b',
              borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* List content */}
      <div className='flex-1 overflow-y-auto'>
        {activeTab === 'setlist' ? (
          <div className='flex flex-col'>
            {songItems.map((item) => {
              if (item.type !== 'song') return null;
              const song = songMap.get(item.songId);
              if (!song) return null;
              const isActive = item.songId === activeSongId;
              return (
                <button
                  key={item.songId}
                  onClick={() => isController && handleSongJump(item.songId)}
                  disabled={!isController}
                  className='flex items-center gap-2 px-4 py-3 text-left
                             border-b border-slate-800 transition-colors
                             disabled:cursor-not-allowed'
                  style={{
                    backgroundColor: isActive ? '#1e293b' : 'transparent',
                  }}
                >
                  {isActive && (
                    <span className='text-indigo-400 text-xs'>▸</span>
                  )}
                  <span
                    className='font-mono text-sm truncate flex-1'
                    style={{ color: isActive ? '#e2e8f0' : '#94a3b8' }}
                  >
                    {song.title}
                  </span>
                  <span className='font-mono text-xs text-slate-600'>
                    {formatTime(song.duration)}
                  </span>
                </button>
              );
            })}
            {songItems.length === 0 && (
              <div className='px-4 py-6 text-center font-mono text-xs text-slate-600'>
                No songs in setlist
              </div>
            )}
          </div>
        ) : (
          <div className='flex flex-col'>
            {sortedMarkers.map((marker) => {
              const isActive = marker.id === activeMarkerId;
              return (
                <button
                  key={marker.id}
                  onClick={() => isController && handleSectionJump(marker.startTime)}
                  disabled={!isController}
                  className='flex items-center gap-2 px-4 py-3 text-left
                             border-b border-slate-800 transition-colors
                             disabled:cursor-not-allowed'
                  style={{
                    backgroundColor: isActive ? '#1e293b' : 'transparent',
                  }}
                >
                  <span
                    className='w-2 h-2 rounded-full shrink-0'
                    style={{ backgroundColor: marker.color }}
                  />
                  <span
                    className='font-mono text-sm truncate flex-1'
                    style={{ color: isActive ? '#e2e8f0' : '#94a3b8' }}
                  >
                    {marker.label}
                  </span>
                  <span className='font-mono text-xs text-slate-600'>
                    {formatTime(marker.startTime)}
                  </span>
                </button>
              );
            })}
            {sortedMarkers.length === 0 && (
              <div className='px-4 py-6 text-center font-mono text-xs text-slate-600'>
                No sections marked
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}