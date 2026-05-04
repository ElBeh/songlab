import { useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { LoopControls } from './LoopControls';
import { SkipBack, Rewind, Play, Pause, FastForward, Repeat } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';

interface TransportControlsProps {
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
  onSeek?: (time: number) => void;    
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
  onSeek,
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

  const seekTo = (time: number) => {
    const clamped = Math.max(0, Math.min(duration, time));
    if (wavesurferRef.current) {
      wavesurferRef.current.setTime(clamped);
    } else {
      onSeek?.(clamped);
    }
  };

  const handleSeekBack = () => seekTo(currentTime - 1);
  const handleSeekForward = () => seekTo(currentTime + 1);

  const handleTimeCommit = () => {
    const seconds = parseTimeInput(inputValue);
    if (seconds !== null) seekTo(seconds);
    setEditing(false);
  };

  const handleTimeClick = () => {
    setInputValue(formatTime(currentTime));
    setEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleTimeCommit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className='flex items-center gap-3 flex-wrap'>
      {/* Seek controls */}
      <button onClick={onReset} className='text-slate-300 hover:text-white transition-colors' title='Reset to start'><SkipBack size={ICON_SIZE.TRANSPORT} /></button>
      <button onClick={handleSeekBack} className='text-slate-300 hover:text-white transition-colors' title='Back 1s'><Rewind size={ICON_SIZE.TRANSPORT} /></button>
      <button
        onClick={onPlayPause}
        className='w-10 h-10 flex items-center justify-center rounded-full
                   bg-indigo-500 hover:bg-indigo-400 text-white transition-colors'
      >
        {isPlaying ? <Pause key='pause' size={ICON_SIZE.TRANSPORT} /> : <Play key='play' size={ICON_SIZE.TRANSPORT} />}
      </button>
      <button onClick={handleSeekForward} className='text-slate-300 hover:text-white transition-colors' title='Forward 1s'><FastForward size={ICON_SIZE.TRANSPORT} /></button>

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
        <Repeat size={ICON_SIZE.ACTION} className='inline-block' /> song
      </button>

      <LoopControls songLoop={songLoop} />
    </div>
  );
}