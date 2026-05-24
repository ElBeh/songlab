import { useModeStore } from '../../stores/useModeStore';

export function ModeMenu() {
  const mode = useModeStore((state) => state.mode);
  const isSession = mode === 'session';

  return (
    <div className='flex bg-slate-800 rounded-lg p-0.5 font-mono text-xs'>
      <button
        onClick={() => useModeStore.getState().setMode('edit')}
        className={`px-3 py-1 rounded-md transition-colors ${
          !isSession
            ? 'bg-indigo-500 text-white'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        Edit
      </button>
      <button
        onClick={() => useModeStore.getState().setMode('session')}
        className={`px-3 py-1 rounded-md transition-colors ${
          isSession
            ? 'bg-indigo-500 text-white'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        Session
      </button>
    </div>
  );
}