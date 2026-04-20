// MIDI controller settings dialog.
// Shows connected devices, command mappings with MIDI Learn, and reset option.

import { useMidiStore } from '../../stores/useMidiStore';
import type { MidiCommand, MidiMessageType } from '../../services/midiService';

interface MidiSettingsDialogProps {
  onClose: () => void;
}

const COMMAND_LABELS: Record<MidiCommand, string> = {
  TRANSPORT_TOGGLE: 'Play / Pause',
  SECTION_PREV: 'Previous Section',
  SECTION_NEXT: 'Next Section',
  LOOP_TOGGLE: 'Loop On/Off',
  SONG_PREV: 'Previous Song',
  SONG_NEXT: 'Next Song',
  TEMPO_DOWN: 'Tempo Down',
  TEMPO_UP: 'Tempo Up',
};

function formatMessageType(type: MidiMessageType): string {
  switch (type) {
    case 'cc': return 'CC';
    case 'note_on': return 'Note On';
    case 'note_off': return 'Note Off';
  }
}

export function MidiSettingsDialog({ onClose }: MidiSettingsDialogProps) {
  const devices = useMidiStore((s) => s.devices);
  const mappings = useMidiStore((s) => s.mappings);
  const learnTarget = useMidiStore((s) => s.learnTarget);
  const setLearnTarget = useMidiStore((s) => s.setLearnTarget);
  const resetMappings = useMidiStore((s) => s.resetMappings);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (learnTarget) {
        setLearnTarget(null);
      } else {
        onClose();
      }
    }
  };

  const handleLearnClick = (command: MidiCommand) => {
    setLearnTarget(learnTarget === command ? null : command);
  };

  const handleReset = async () => {
    await resetMappings();
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
      onClick={() => {
        setLearnTarget(null);
        onClose();
      }}
    >
      <div
        className='bg-slate-800 border border-slate-700 rounded-xl p-6 w-[420px]
                   flex flex-col gap-4 shadow-2xl'
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 className='text-sm font-mono text-slate-200 uppercase tracking-widest'>
          MIDI Controller
        </h2>

        {/* Device list */}
        <div className='flex flex-col gap-1'>
          <span className='text-[10px] font-mono text-slate-500 uppercase'>
            Devices
          </span>
          {devices.length > 0 ? (
            devices.map((d) => (
              <div key={d.id} className='flex items-center gap-2 text-xs font-mono'>
                <span className='w-1.5 h-1.5 rounded-full bg-green-500' />
                <span className='text-slate-300 truncate'>
                  {d.name}
                  {d.manufacturer ? ` (${d.manufacturer})` : ''}
                </span>
              </div>
            ))
          ) : (
            <span className='text-xs font-mono text-slate-600'>
              No MIDI devices detected
            </span>
          )}
        </div>

        {/* Mapping table */}
        <div className='flex flex-col gap-1'>
          <span className='text-[10px] font-mono text-slate-500 uppercase'>
            Mappings
          </span>
          <div className='flex flex-col gap-1 max-h-72 overflow-y-auto'>
            {mappings.map((mapping) => {
              const isLearning = learnTarget === mapping.command;
              return (
                <div
                  key={mapping.command}
                  className='flex items-center gap-2 px-2 py-1.5 rounded'
                  style={{
                    backgroundColor: isLearning ? '#312e81' : '#0f172a',
                  }}
                >
                  {/* Command label */}
                  <span className='text-xs font-mono text-slate-300 w-36 shrink-0'>
                    {COMMAND_LABELS[mapping.command]}
                  </span>

                  {/* Current mapping display */}
                  <span className='text-xs font-mono text-slate-500 flex-1 truncate'>
                    {isLearning ? (
                      <span className='text-indigo-400 animate-pulse'>
                        Press a button on your controller…
                      </span>
                    ) : (
                      <>
                        <span className='text-slate-400'>
                          {formatMessageType(mapping.type)}
                        </span>
                        {' #'}{mapping.note}
                        <span className='text-slate-600'>
                          {' '}{mapping.channel === -1 ? 'any ch' : `ch ${mapping.channel + 1}`}
                        </span>
                      </>
                    )}
                  </span>

                  {/* Learn button */}
                  <button
                    onClick={() => handleLearnClick(mapping.command)}
                    aria-label={`Learn MIDI mapping for ${COMMAND_LABELS[mapping.command]}`}
                    className='px-2 py-0.5 text-[10px] font-mono rounded transition-colors shrink-0'
                    style={{
                      backgroundColor: isLearning ? '#4f46e5' : '#1e293b',
                      color: isLearning ? '#fff' : '#64748b',
                    }}
                  >
                    {isLearning ? 'Cancel' : 'Learn'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
        <div className='flex justify-between mt-2'>
          <button
            onClick={handleReset}
            className='px-3 py-1.5 text-xs font-mono text-slate-500 hover:text-slate-300
                       transition-colors'
            aria-label='Reset MIDI mappings to defaults'
          >
            Reset defaults
          </button>
          <button
            onClick={() => {
              setLearnTarget(null);
              onClose();
            }}
            className='px-4 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600
                       text-slate-200 rounded-lg transition-colors'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}