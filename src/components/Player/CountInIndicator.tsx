import { useCountInStore } from '../../stores/useCountInStore';

/**
 * Full-area overlay that shows the current count-in beat as a large
 * pulsing number (4 → 3 → 2 → 1). Renders on top of the main content
 * area and disappears when count-in finishes.
 */
export function CountInIndicator() {
  const isCountingIn = useCountInStore((s) => s.isCountingIn);
  const currentBeat = useCountInStore((s) => s.currentBeat);
  const totalBeats = useCountInStore((s) => s.totalBeats);

  if (!isCountingIn || currentBeat === null) return null;

  // Count down: display (totalBeats - currentBeat + 1) so 1st beat shows "4" in 4/4
  const display = totalBeats - currentBeat + 1;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center
                 bg-slate-900/70 pointer-events-none'
      aria-live='assertive'
      aria-label={`Count-in beat ${currentBeat} of ${totalBeats}`}
    >
      <span
        key={currentBeat}
        className='text-8xl font-mono font-bold text-white select-none'
        style={{ animation: 'countInPulse 0.3s ease-out' }}
      >
        {display}
      </span>
      <style>{`
        @keyframes countInPulse {
          0% { transform: scale(1.4); opacity: 0.6; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}