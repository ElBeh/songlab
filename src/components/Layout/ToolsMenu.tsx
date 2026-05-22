import { useState, useRef, useEffect } from 'react';

interface ToolsMenuProps {
  onOpenMetronome: () => void;
}

export function ToolsMenu({ onOpenMetronome }: ToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1 rounded-md text-xs font-mono transition-colors
                   bg-slate-800 hover:bg-slate-700 text-slate-300"
      >
        Tools ▾
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 bg-slate-800 border
                     border-slate-600 rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
        >
          <button
            onClick={() => {
              onOpenMetronome();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 text-xs font-mono
                       text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Metronome
          </button>
          <button
            disabled
            className="w-full text-left px-3 py-1.5 text-xs font-mono
                       text-slate-500 cursor-not-allowed"
          >
            Fretboard Editor
          </button>
        </div>
      )}
    </div>
  );
}