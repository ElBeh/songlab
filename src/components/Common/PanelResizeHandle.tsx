/** Height change per arrow key press, in px */
const KEYBOARD_STEP = 24;

interface PanelResizeHandleProps {
  /** Accessible name, e.g. "Resize notation panel height" */
  label: string;
  /** True while dragging, for the active style */
  isResizing: boolean;
  /** Starts a drag (startResize from useResizablePanelHeight) */
  onResizeStart: (e: React.PointerEvent) => void;
  /** Changes the height by a delta (adjustHeight from useResizablePanelHeight) */
  onAdjust: (delta: number) => void;
}

/** Horizontal bar below a panel: drag to change its height, arrow keys when focused */
export function PanelResizeHandle({ label, isResizing, onResizeStart, onAdjust }: PanelResizeHandleProps) {
  return (
    <div
      role='separator'
      aria-orientation='horizontal'
      aria-label={label}
      tabIndex={0}
      onPointerDown={onResizeStart}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          onAdjust(-KEYBOARD_STEP);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          onAdjust(KEYBOARD_STEP);
        }
      }}
      className={`mt-1 h-2 flex items-center justify-center rounded cursor-row-resize touch-none
                  select-none transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400
                  ${isResizing ? 'bg-slate-500' : 'bg-slate-700 hover:bg-slate-600'}`}
    >
      <div className='w-10 h-1 rounded bg-slate-400' />
    </div>
  );
}