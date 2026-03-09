interface WaveformTimelineProps {
  duration: number;
  currentTime: number;
}

function formatLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function WaveformTimeline({ duration, currentTime }: WaveformTimelineProps) {
  if (!duration) return null;

  const ticks: number[] = [];
  for (let i = 0; i <= Math.floor(duration); i++) {
    ticks.push(i);
  }

  const progressPercent = (currentTime / duration) * 100;

  return (
    <div className='relative w-full h-7 mt-1 select-none'>
      {/* Playhead */}
      <div
        className='absolute top-0 h-full w-px bg-white opacity-60 pointer-events-none'
        style={{ left: `${progressPercent}%`, zIndex: 2 }}
      />

      {ticks.map((sec) => {
        const leftPercent = (sec / duration) * 100;
        const isPrimary = sec % 30 === 0;
        const isSecondary = sec % 10 === 0 && !isPrimary;
        const isFive = sec % 5 === 0 && !isSecondary && !isPrimary;

        const tickHeight = isPrimary ? 8 : isSecondary ? 6 : isFive ? 5 : 3;
        const tickColor = isPrimary ? '#cbd5e1' : isSecondary ? '#64748b' : isFive ? '#475569' : '#334155';
        const showLabel = isPrimary || isSecondary;

        return (
          <div key={sec}>
            {/* Tick line – always at exact leftPercent */}
            <div
              className='absolute top-0 w-px'
              style={{
                left: `${leftPercent}%`,
                height: `${tickHeight}px`,
                backgroundColor: tickColor,
              }}
            />
            {/* Label – centered under tick via translateX */}
            {showLabel && (
              <span
                className='absolute font-mono whitespace-nowrap'
                style={{
                  left: `${leftPercent}%`,
                  top: '10px',
                  transform: 'translateX(-50%)',
                  color: isPrimary ? '#cbd5e1' : '#64748b',
                  fontSize: isPrimary ? '11px' : '10px',
                }}
              >
                {formatLabel(sec)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}