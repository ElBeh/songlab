import { useState } from 'react';
import { useSongStore } from '../../stores/useSongStore';
import { MarkerEditForm } from './MarkerEditForm';
import { useLoopStore } from '../../stores/useLoopStore';

interface MarkerListProps {
  onSeekTo: (time: number) => void;
  duration: number;
  currentTime: number;
  onMarkerSelect: (id: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MarkerList({ onSeekTo, duration, currentTime, onMarkerSelect }: MarkerListProps) {
  const markers = useSongStore((state) => state.markers);
  const removeMarker = useSongStore((state) => state.removeMarker);
  const updateMarker = useSongStore((state) => state.updateMarker);
  const setLoop = useLoopStore((state) => state.setLoop);
  const loop = useLoopStore((state) => state.loop);
  const loopEnabled = useLoopStore((state) => state.loopEnabled);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);

  const sortedMarkers = [...markers].sort((a, b) => a.startTime - b.startTime);

  const activeMarkerId = [...sortedMarkers]
    .reverse()
    .find((m) => m.startTime <= currentTime + 0.1)?.id ?? null;

  const handleColorChange = async (markerId: string, newColor: string) => {
    const marker = markers.find((m) => m.id === markerId);
    if (!marker) return;
    const sameType = markers.filter((m) => m.type === marker.type);
    for (const m of sameType) {
      await updateMarker({ ...m, color: newColor });
    }
  };

  const handleColorCommit = () => setEditingColorId(null);

  if (markers.length === 0) {
    return (
      <p className='text-sm text-slate-500 font-mono px-2'>
        No markers yet. Press "Add Marker" during playback.
      </p>
    );
  }

  return (
    <ul className='flex flex-col gap-1'>
      {sortedMarkers.map((marker) => {
        const endTime = sortedMarkers.find(
          (m) => m.startTime > marker.startTime
        )?.startTime ?? duration;
        const isActive = marker.id === activeMarkerId;
        const isEditingColor = editingColorId === marker.id;

        return (
          <li
            key={marker.id}
            className='flex flex-col px-3 py-2 rounded-lg transition-colors group'
            style={{
              backgroundColor: isActive ? `${marker.color}33` : undefined,
            }}
          >
            <div className='flex items-center gap-3'>
              {/* Active indicator */}
              <div
                className='w-1 shrink-0 rounded-full transition-all'
                style={{
                  height: isActive ? '24px' : '8px',
                  backgroundColor: isActive ? marker.color : 'transparent',
                  outline: isActive ? 'none' : `1px solid ${marker.color}`,
                  outlineOffset: '1px',
                }}
              />

              {/* Color dot */}
              <button
                onClick={() => setEditingColorId(isEditingColor ? null : marker.id)}
                className='w-3 h-3 rounded-full shrink-0 ring-offset-slate-800
                           hover:ring-2 hover:ring-white transition-all'
                style={{ backgroundColor: marker.color }}
                title='Change color for this section type'
              />

              {/* Label + times */}
              <button
                onClick={() => {
                  onSeekTo(marker.startTime);
                  onMarkerSelect(marker.id);
                }}
                className='flex-1 flex flex-col text-left'
              >
                <span
                  className='text-sm font-mono transition-colors'
                  style={{ color: isActive ? '#f1f5f9' : '#cbd5e1' }}
                >
                  {marker.label}
                </span>
                <span className='text-xs text-slate-500 font-mono'>
                  {formatTime(marker.startTime)}
                  {duration > 0 && ` – ${formatTime(endTime)}`}
                </span>
              </button>

              {/* Loop */}
              <button
                onClick={() => {
                  setLoop({ start: marker.startTime, end: endTime, label: marker.label });
                }}
                className='text-slate-600 hover:text-indigo-400 transition-colors
                           opacity-0 group-hover:opacity-100 text-xl font-mono'
                style={{
                  color: loop?.label === marker.label && loopEnabled ? '#6366f1' : undefined,
                }}
                title='Loop this section'
              >
                ↺
              </button>

              {/* Edit */}
              <button
                onClick={() => setEditingMarkerId(editingMarkerId === marker.id ? null : marker.id)}
                className='text-slate-600 hover:text-indigo-400 transition-colors
                           opacity-0 group-hover:opacity-100 text-xl font-mono'
                title='Edit marker'
              >
                ✎
              </button>

              {/* Delete */}
              <button
                onClick={() => removeMarker(marker.id)}
                className='text-slate-600 hover:text-red-400 transition-colors
                           opacity-0 group-hover:opacity-100 text-xl font-mono'
                title='Delete marker'
              >
                ✕
              </button>
            </div>

            {/* Inline color picker */}
            {isEditingColor && (
              <div className='flex items-center gap-3 mt-2 pt-2 border-t border-slate-700'>
                <span className='text-xs text-slate-400 font-mono'>
                  All "{marker.type}" markers
                </span>
                <input
                  type='color'
                  defaultValue={marker.color}
                  onChange={(e) => handleColorChange(marker.id, e.target.value)}
                  onBlur={handleColorCommit}
                  autoFocus
                  className='w-8 h-8 rounded cursor-pointer bg-transparent border-0'
                />
                <button
                  onClick={handleColorCommit}
                  className='text-xs text-slate-400 hover:text-white font-mono transition-colors'
                >
                  done
                </button>
              </div>
            )}

            {/* Edit form */}
            {editingMarkerId === marker.id && (
              <MarkerEditForm
                marker={marker}
                onSave={async (updated) => {
                  if (updated.type === marker.type && updated.color !== marker.color) {
                    const sameType = markers.filter(
                      (m) => m.type === updated.type && m.id !== updated.id
                    );
                    for (const m of sameType) {
                      await updateMarker({ ...m, color: updated.color });
                    }
                  }
                  await updateMarker(updated);
                  setEditingMarkerId(null);
                }}
                onCancel={() => setEditingMarkerId(null)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}