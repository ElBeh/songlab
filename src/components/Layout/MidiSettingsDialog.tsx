// MIDI controller settings dialog.
// Shows connected devices, command mappings with MIDI Learn, and reset option.

import { useRef } from 'react';
import { useMidiStore } from '../../stores/useMidiStore';
import { useToastStore } from '../../stores/useToastStore';
import type { MidiCommand, MidiMapping, MidiMessageType } from '../../services/midiService';

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
  SEEK_BACK: 'Seek Back 5s',
  SEEK_FORWARD: 'Seek Forward 5s',
  LOOP_SET_A: 'Set Loop Point A',
  LOOP_SET_B: 'Set Loop Point B',
};

function formatMessageType(type: MidiMessageType): string {
  switch (type) {
    case 'cc': return 'CC';
    case 'note_on': return 'Note On';
    case 'note_off': return 'Note Off';
    case 'program_change': return 'PC';
  }
}

export function MidiSettingsDialog({ onClose }: MidiSettingsDialogProps) {
  const devices = useMidiStore((s) => s.devices);
  const mappings = useMidiStore((s) => s.mappings);
  const learnTarget = useMidiStore((s) => s.learnTarget);
  const setLearnTarget = useMidiStore((s) => s.setLearnTarget);
  const resetMappings = useMidiStore((s) => s.resetMappings);
  const setMappings = useMidiStore((s) => s.setMappings);
  const addToast = useToastStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify(mappings, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'midi-mappings.songlab.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as MidiMapping[];

      // Validate structure
      if (!Array.isArray(data) || data.length === 0) {
        addToast('Invalid mapping file: expected a non-empty array', 'error');
        return;
      }

      const isValid = data.every(
        (m) => m.command && m.type && typeof m.note === 'number',
      );
      if (!isValid) {
        addToast('Invalid mapping file: entries are missing required fields', 'error');
        return;
      }

      setMappings(data);
      await import('../../services/db').then(
        (db) => db.setConfig('midiMappings', data),
      );
      addToast('MIDI mappings imported', 'success');
    } catch (error) {
      console.error('Failed to import MIDI mappings:', error);
      addToast('Failed to import MIDI mappings', 'error');
    }

    // Reset file input so the same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        <div className='flex items-center justify-between mt-2'>
          <div className='flex gap-2'>
            <button
              onClick={handleReset}
              className='px-4 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600
                         text-slate-200 rounded-lg transition-colors'
              aria-label='Reset MIDI mappings to defaults'
            >
              Reset
            </button>
            <button
              onClick={handleExport}
              className='px-4 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600
                         text-slate-200 rounded-lg transition-colors'
              aria-label='Export MIDI mappings'
            >
              Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className='px-4 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600
                         text-slate-200 rounded-lg transition-colors'
              aria-label='Import MIDI mappings'
            >
              Import
            </button>
            <input
              ref={fileInputRef}
              type='file'
              accept='.json'
              onChange={handleImport}
              className='hidden'
              aria-hidden='true'
            />
          </div>
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