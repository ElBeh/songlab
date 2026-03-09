import { useState } from 'react';
import type { SectionType, SectionMarker } from '../../types';
import { SECTION_COLORS } from '../../utils/sectionColors';

interface MarkerEditFormProps {
  marker: SectionMarker;
  onSave: (updated: SectionMarker) => void;
  onCancel: () => void;
}

const SECTION_TYPES: SectionType[] = [
  'intro', 'verse', 'pre-chorus', 'chorus',
  'bridge', 'solo', 'interlude', 'outro', 'custom',
];

export function MarkerEditForm({ marker, onSave, onCancel }: MarkerEditFormProps) {
  const [type, setType] = useState<SectionType>(marker.type);
  const [label, setLabel] = useState(marker.label);
  const [color, setColor] = useState(marker.color);

  const handleTypeChange = (t: SectionType) => {
    setType(t);
    setColor(SECTION_COLORS[t]);
  };

  const handleSave = () => {
    onSave({ ...marker, type, label: label.trim() || type, color });
  };

  return (
    <div className='flex flex-col gap-3 mt-2 pt-2 border-t border-slate-700'>
      {/* Section type selector */}
      <div className='flex flex-wrap gap-1'>
        {SECTION_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => handleTypeChange(t)}
            className='px-2 py-0.5 rounded text-xs font-mono transition-all'
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

      {/* Label */}
      <input
        type='text'
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={`Label (default: "${type}")`}
        className='bg-slate-900 text-slate-200 text-sm rounded px-3 py-1.5 outline-none
                   border border-slate-600 focus:border-indigo-500 font-mono'
      />

      {/* Color */}
      <div className='flex items-center gap-3'>
        <span className='text-xs text-slate-400 font-mono'>Color</span>
        <input
          type='color'
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className='w-8 h-8 rounded cursor-pointer bg-transparent border-0'
        />
        <span className='text-xs text-slate-500 font-mono'>{color}</span>
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
          className='px-3 py-1 text-xs text-slate-400 hover:text-white font-mono transition-colors'
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className='px-3 py-1 text-xs bg-indigo-500 hover:bg-indigo-400
                     text-white rounded font-mono transition-colors'
        >
          Save
        </button>
      </div>
    </div>
  );
}