import { useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useLoopStore } from '../../stores/useLoopStore';

interface TransportControlsProps {
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  songLoop: boolean;
  onSongLoopToggle: () => void;
  onReset: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseTimeInput(input: string): number | null {
  const parts = input.trim().split(':');
  if (parts.length === 1) {
    const s = parseFloat(parts[0]);
    return isNaN(s) ? null : s;
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseFloat(parts[1]);
    if (isNaN(m) || isNaN(s)) return null;
    return m * 60 + s;
  }
  return null;
}

export function TransportControls({
  wavesurferRef,
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  songLoop,
  onSongLoopToggle,
  onReset,
}: TransportControlsProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const loop = useLoopStore((state) => state.loop);
  const loopEnabled = useLoopStore((state) => state.loopEnabled);
  const abMode = useLoopStore((state) => state.abMode);
  const abStart = useLoopStore((state) => state.abStart);
  const toggleLoop = useLoopStore((state) => state.toggleLoop);
  const toggleAbMode = useLoopStore((state) => state.toggleAbMode);
  const clearLoop = useLoopStore((state) => state.clearLoop);

  const handleSeekBack = () => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.setTime(Math.max(0, currentTime - 1));
  };

  const handleSeekForward = () => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.setTime(Math.min(duration, currentTime + 1));
  };

  const handleTimeClick = () => {
    setInputValue(formatTime(currentTime));
    setEditing(true);
  };

  const handleTimeCommit = () => {
    const seconds = parseTimeInput(inputValue);
    if (seconds !== null) {
      wavesurferRef.current?.setTime(Math.max(0, Math.min(duration, seconds)));
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleTimeCommit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className='flex items-center gap-3 flex-wrap'>
      {/* Seek controls */}
      <button onClick={onReset} className='text-slate-300 hover:text-white transition-colors' title='Reset to start'>⏮</button>
      <button onClick={handleSeekBack} className='text-slate-300 hover:text-white transition-colors' title='Back 1s'>⏪</button>
      <button
        onClick={onPlayPause}
        className='w-10 h-10 flex items-center justify-center rounded-full
                   bg-indigo-500 hover:bg-indigo-400 text-white transition-colors'
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button onClick={handleSeekForward} className='text-slate-300 hover:text-white transition-colors' title='Forward 1s'>⏩</button>

      {/* Time display */}
      <div className='font-mono text-sm text-slate-300'>
        {editing ? (
          <input
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleTimeCommit}
            onKeyDown={handleKeyDown}
            className='w-20 bg-slate-700 text-slate-100 font-mono text-sm
                       rounded px-1 py-0.5 border border-indigo-500 outline-none'
            placeholder='m:ss'
          />
        ) : (
          <button onClick={handleTimeClick} className='hover:text-white transition-colors' title='Click to seek'>
            {formatTime(currentTime)} / {formatTime(duration)}
          </button>
        )}
      </div>

      {/* Divider */}
      <div className='w-px h-6 bg-slate-600 mx-1' />

      {/* Song loop */}
      <button
        onClick={onSongLoopToggle}
        className='px-3 py-1 rounded font-mono text-xs transition-colors'
        style={{
          backgroundColor: songLoop ? '#22c55e' : '#334155',
          color: songLoop ? '#fff' : '#94a3b8',
        }}
        title='Loop entire song'
      >
        🔁 song
      </button>

      {/* A/B Mode toggle */}
      <button
        onClick={toggleAbMode}
        className='px-3 py-1 rounded font-mono text-xs transition-colors'
        style={{
          backgroundColor: abMode ? '#f59e0b' : '#334155',
          color: abMode ? '#000' : '#94a3b8',
        }}
        title='Toggle A/B mode'
      >
        {abMode ? (abStart === null ? '▸ click A' : '▸ click B') : 'A/B'}
      </button>

      {/* Loop toggle */}
      <button
        onClick={toggleLoop}
        disabled={!loop}
        className='px-3 py-1 rounded font-mono text-xs transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed'
        style={{
          backgroundColor: loopEnabled ? '#6366f1' : '#334155',
          color: loopEnabled ? '#fff' : '#94a3b8',
        }}
        title='Toggle loop (L)'
      >
        ↺ Loop
      </button>

      {/* Active loop info */}
      {loop && (
        <span className='text-xs font-mono text-slate-400'>
          {loop.label && (
            <span className='mr-1.5 px-1.5 py-0.5 rounded text-white text-xs'
              style={{ backgroundColor: '#6366f1' }}>
              {loop.label}
            </span>
          )}
          {formatTime(loop.start)} – {formatTime(loop.end)}
        </span>
      )}

      {/* Clear loop */}
      {loop && (
        <button
          onClick={clearLoop}
          className='px-3 py-1 rounded font-mono text-xs bg-slate-700
                     hover:bg-red-900 text-slate-400 hover:text-red-300 transition-colors'
        >
          ✕ clear loop
        </button>
      )}
    </div>
  );
}