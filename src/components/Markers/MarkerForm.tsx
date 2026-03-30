import { useState } from 'react';
import type { SectionType, SectionMarker } from '../../types';
import { SECTION_COLORS } from '../../utils/sectionColors';

interface MarkerFormProps {
  currentTime: number;
  songId: string;
  onAdd: (marker: SectionMarker) => void;
  onCancel: () => void;
}

const SECTION_TYPES: SectionType[] = [
  'intro', 'verse', 'pre-chorus', 'chorus',
  'bridge', 'solo', 'interlude', 'outro', 'custom',
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function MarkerForm({ currentTime, songId, onAdd, onCancel }: MarkerFormProps) {
  const [type, setType] = useState<SectionType>('verse');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(SECTION_COLORS['verse']);

  const handleTypeChange = (t: SectionType) => {
    setType(t);
    // Only reset color to default if user hasn't manually changed it
    setColor(SECTION_COLORS[t]);
  };

  const handleSubmit = () => {
    const resolvedLabel = label.trim() || type;
    onAdd({
      id: generateId(),
      songId,
      type,
      label: resolvedLabel,
      startTime: currentTime,
      color,
    });
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
      onClick={onCancel}
    >
      <div
        className='bg-slate-800 border border-slate-700 rounded-xl p-6 w-96
                   flex flex-col gap-4 shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='text-sm font-mono text-slate-200 font-semibold'>
          Add Marker
        </h2>

        <p className='text-xs text-slate-400 font-mono'>
          Placing at {currentTime.toFixed(2)}s
        </p>

        {/* Section type selector */}
        <div className='flex flex-wrap gap-2'>
          {SECTION_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className='px-2 py-1 rounded text-xs font-mono transition-all'
              style={{
                backgroundColor: type === t ? SECTION_COLORS[t] : '#334155',
                color: type === t ? '#fff' : '#94a3b8',
                outline: type === t ? `2px solid ${SECTION_COLORS[t]}` : 'none',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Optional custom label */}
        <input
          type='text'
          placeholder={`Label (default: "${type}")`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className='bg-slate-900 text-slate-200 text-sm rounded px-3 py-2 outline-none
                     border border-slate-600 focus:border-indigo-500 font-mono'
        />

        {/* Color picker */}
        <div className='flex items-center gap-3'>
          <span className='text-xs text-slate-400 font-mono'>Color</span>
          <input
            type='color'
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className='w-8 h-8 rounded cursor-pointer bg-transparent border-0'
            title='Pick marker color'
          />
          <span className='text-xs text-slate-500 font-mono'>{color}</span>
          {/* Reset to section default */}
          {color !== SECTION_COLORS[type] && (
            <button
              onClick={() => setColor(SECTION_COLORS[type])}
              className='text-xs text-slate-500 hover:text-slate-300 font-mono transition-colors'
            >
              reset
            </button>
          )}
        </div>

        {/* Actions */}
        <div className='flex gap-2 justify-end'>
          <button
            onClick={onCancel}
            className='flex-1 px-3 py-2 text-xs font-mono rounded transition-colors
                       bg-slate-700 hover:bg-slate-600 text-slate-400'
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className='flex-1 px-3 py-2 text-xs font-mono rounded transition-colors
                       bg-indigo-600 hover:bg-indigo-500 text-white'
          >
            Place
          </button>
        </div>
      </div>
    </div>
  );
}