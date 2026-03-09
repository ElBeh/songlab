import { useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';

interface TransportControlsProps {
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Parse "m:ss" or "ss" input → seconds, returns null if invalid
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
}: TransportControlsProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

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
      const clamped = Math.max(0, Math.min(duration, seconds));
      wavesurferRef.current?.setTime(clamped);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleTimeCommit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className='flex items-center gap-4 px-4 py-3 bg-slate-800 rounded-lg'>
      {/* Seek back 1s */}
      <button
        onClick={handleSeekBack}
        className='text-slate-300 hover:text-white transition-colors'
        title='Back 1s'
      >
        ⏪
      </button>

      {/* Play / Pause */}
      <button
        onClick={onPlayPause}
        className='w-10 h-10 flex items-center justify-center rounded-full
                   bg-indigo-500 hover:bg-indigo-400 text-white transition-colors'
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Seek forward 1s */}
      <button
        onClick={handleSeekForward}
        className='text-slate-300 hover:text-white transition-colors'
        title='Forward 1s'
      >
        ⏩
      </button>

      {/* Time display – click to edit */}
      <div className='ml-2 font-mono text-sm text-slate-300'>
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
          <button
            onClick={handleTimeClick}
            className='hover:text-white transition-colors'
            title='Click to seek to time'
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </button>
        )}
      </div>
    </div>
  );
}