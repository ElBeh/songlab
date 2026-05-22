import { useState, useRef, useEffect } from 'react';
import { useModeStore, type AppMode } from '../../stores/useModeStore';

export function ModeMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const mode = useModeStore((state) => state.mode);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const options: { value: AppMode; label: string }[] = [
    { value: 'edit', label: 'Edit' },
    { value: 'session', label: 'Session' },
  ];

  const handleSelect = (value: AppMode) => {
    useModeStore.getState().setMode(value);
    setOpen(false);
  };

  const activeLabel = options.find((o) => o.value === mode)?.label ?? 'Mode';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1 rounded-md text-xs font-mono transition-colors
                   bg-slate-800 hover:bg-slate-700 text-slate-300"
      >
        {"Mode: " + activeLabel} ▾
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 bg-slate-800 border
                     border-slate-600 rounded-lg shadow-xl py-1 z-50 min-w-[120px]"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono
                         transition-colors ${
                           mode === opt.value
                             ? 'text-indigo-400 bg-slate-700'
                             : 'text-slate-300 hover:bg-slate-700'
                         }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}