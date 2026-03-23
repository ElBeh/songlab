import type { GpRehearsalMark } from '../../utils/gpMarkerImport';

interface GpMarkerImportDialogProps {
  marks: GpRehearsalMark[];
  hasExistingSections: boolean;
  onReplace: () => void;
  onMerge: () => void;
  onCancel: () => void;
}

export function GpMarkerImportDialog({
  marks,
  hasExistingSections,
  onReplace,
  onMerge,
  onCancel,
}: GpMarkerImportDialogProps) {
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
          Import GP Markers
        </h2>

        <p className='text-xs font-mono text-slate-400'>
          Found {marks.length} rehearsal mark{marks.length !== 1 ? 's' : ''} in the Guitar Pro file:
        </p>

        {/* Preview list */}
        <div className='max-h-48 overflow-y-auto flex flex-col gap-1'>
          {marks.map((mark, i) => (
            <div key={i} className='flex items-center gap-2 px-2 py-1 rounded bg-slate-900/50'>
              <div
                className='w-2 h-2 rounded-full shrink-0'
                style={{ backgroundColor: mark.color }}
              />
              <span className='text-xs font-mono text-slate-300 flex-1 truncate'>
                {mark.name}
              </span>
              <span className='text-[10px] font-mono text-slate-500'>
                {formatTime(mark.timeSeconds)}
              </span>
              <span className='text-[10px] font-mono text-slate-600'>
                {mark.type}
              </span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        {hasExistingSections ? (
          <div className='flex flex-col gap-2'>
            <p className='text-xs font-mono text-amber-400'>
              This song already has sections.
            </p>
            <div className='flex gap-2'>
              <button
                onClick={onMerge}
                className='flex-1 px-3 py-2 text-xs font-mono rounded transition-colors
                           bg-indigo-600 hover:bg-indigo-500 text-white'
              >
                Merge
              </button>
              <button
                onClick={onReplace}
                className='flex-1 px-3 py-2 text-xs font-mono rounded transition-colors
                           bg-slate-700 hover:bg-red-900 text-slate-300 hover:text-red-200'
              >
                Replace
              </button>
              <button
                onClick={onCancel}
                className='flex-1 px-3 py-2 text-xs font-mono rounded transition-colors
                           bg-slate-700 hover:bg-slate-600 text-slate-400'
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className='flex gap-2'>
            <button
              onClick={onMerge}
              className='flex-1 px-3 py-2 text-xs font-mono rounded transition-colors
                         bg-indigo-600 hover:bg-indigo-500 text-white'
            >
              Import
            </button>
            <button
              onClick={onCancel}
              className='flex-1 px-3 py-2 text-xs font-mono rounded transition-colors
                         bg-slate-700 hover:bg-slate-600 text-slate-400'
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}