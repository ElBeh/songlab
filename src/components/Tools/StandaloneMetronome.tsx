import { useState, useRef, useEffect, useCallback } from 'react';
import { startMetronome, type MetronomeHandle } from '../../services/metronomeScheduler';
import { ensureAudioReady } from '../../services/clickSoundGenerator';
import { getConfig, setConfig } from '../../services/db';

interface StandaloneMetronomeProps {
  onClose: () => void;
}

interface MetronomeConfig {
  bpm: number;
  beatsPerBar: number;
  beatUnit: number;
  volume: number;
}

const CONFIG_KEY = 'standaloneMetronome';

const DEFAULT_CONFIG: MetronomeConfig = {
  bpm: 120,
  beatsPerBar: 4,
  beatUnit: 4,
  volume: 80,
};

const TIME_SIGNATURES: { beatsPerBar: number; beatUnit: number; label: string }[] = [
  { beatsPerBar: 2, beatUnit: 4, label: '2/4' },
  { beatsPerBar: 3, beatUnit: 4, label: '3/4' },
  { beatsPerBar: 4, beatUnit: 4, label: '4/4' },
  { beatsPerBar: 5, beatUnit: 4, label: '5/4' },
  { beatsPerBar: 6, beatUnit: 8, label: '6/8' },
  { beatsPerBar: 7, beatUnit: 8, label: '7/8' },
];

export function StandaloneMetronome({ onClose }: StandaloneMetronomeProps) {
  const [bpm, setBpm] = useState(DEFAULT_CONFIG.bpm);
  const [beatsPerBar, setBeatsPerBar] = useState(DEFAULT_CONFIG.beatsPerBar);
  const [beatUnit, setBeatUnit] = useState(DEFAULT_CONFIG.beatUnit);
  const [volume, setVolume] = useState(DEFAULT_CONFIG.volume);
  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [bpmInput, setBpmInput] = useState(String(DEFAULT_CONFIG.bpm));

  const handleRef = useRef<MetronomeHandle | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load persisted config on mount
  useEffect(() => {
    getConfig<MetronomeConfig>(CONFIG_KEY).then((saved) => {
      if (saved) {
        setBpm(saved.bpm);
        setBpmInput(String(saved.bpm));
        setBeatsPerBar(saved.beatsPerBar);
        setBeatUnit(saved.beatUnit);
        setVolume(saved.volume);
      }
      setConfigLoaded(true);
    });
    panelRef.current?.focus();
  }, []);

  // Persist config on change
  useEffect(() => {
    if (!configLoaded) return;
    setConfig<MetronomeConfig>(CONFIG_KEY, { bpm, beatsPerBar, beatUnit, volume });
  }, [bpm, beatsPerBar, beatUnit, volume, configLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleRef.current?.stop();
    };
  }, []);

  // Sync volume to running metronome
  useEffect(() => {
    handleRef.current?.setVolume(volume / 100);
  }, [volume]);

  // Sync tempo to running metronome
  useEffect(() => {
    handleRef.current?.setTempo(bpm, beatsPerBar);
  }, [bpm, beatsPerBar]);

  const handleStart = useCallback(() => {
    ensureAudioReady();
    handleRef.current?.stop();

    const handle = startMetronome({
      bpm,
      beatsPerBar,
      volume: volume / 100,
      onBeat: (beat) => setCurrentBeat(beat),
    });

    handleRef.current = handle;
    setIsRunning(true);
    setCurrentBeat(0);
  }, [bpm, beatsPerBar, volume]);

  const handleStop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    setIsRunning(false);
    setCurrentBeat(0);
  }, []);

  const handleToggle = useCallback(() => {
    if (isRunning) {
      handleStop();
    } else {
      handleStart();
    }
  }, [isRunning, handleStart, handleStop]);

  const handleTimeSigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sig = TIME_SIGNATURES.find((s) => s.label === e.target.value);
    if (!sig) return;
    setBeatsPerBar(sig.beatsPerBar);
    setBeatUnit(sig.beatUnit);
  };

  const commitBpm = () => {
    const val = parseInt(bpmInput, 10);
    if (isNaN(val) || val < 20) {
      setBpm(20);
      setBpmInput('20');
    } else if (val > 300) {
      setBpm(300);
      setBpmInput('300');
    } else {
      setBpm(val);
      setBpmInput(String(val));
    }
  };

  const currentTimeSig = TIME_SIGNATURES.find(
    (s) => s.beatsPerBar === beatsPerBar && s.beatUnit === beatUnit
  )?.label ?? '4/4';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleStop();
      onClose();
    }
    if (e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => { handleStop(); onClose(); }}
    >
      <div
        ref={panelRef}
        className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-80
                   flex flex-col gap-5 shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <h2 className="text-sm font-mono text-slate-200 uppercase tracking-widest">
          Metronome
        </h2>

        {/* BPM input */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-mono text-slate-500">BPM</label>
          <input
            type="number"
            min={20}
            max={300}
            value={bpmInput}
            onChange={(e) => setBpmInput(e.target.value)}
            onBlur={commitBpm}
            onKeyDown={(e) => { if (e.key === 'Enter') commitBpm(); }}
            className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5
                      text-sm font-mono text-slate-200 w-full
                      focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Time signature */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-mono text-slate-500">Time Signature</label>
          <select
            value={currentTimeSig}
            onChange={handleTimeSigChange}
            className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5
                       text-sm font-mono text-slate-200 w-full
                       focus:outline-none focus:border-indigo-500"
          >
            {TIME_SIGNATURES.map((sig) => (
              <option key={sig.label} value={sig.label}>{sig.label}</option>
            ))}
          </select>
        </div>

        {/* Beat visualization */}
        <div className="flex justify-center gap-2 py-2">
          {Array.from({ length: beatsPerBar }, (_, i) => {
            const beatNum = i + 1;
            const isActive = currentBeat === beatNum;
            const isAccent = beatNum === 1;

            return (
              <div
                key={i}
                className={`w-6 h-6 rounded-full border-2 transition-all duration-75 ${
                  isActive
                    ? isAccent
                      ? 'bg-indigo-400 border-indigo-400 scale-125'
                      : 'bg-slate-300 border-slate-300 scale-110'
                    : 'bg-transparent border-slate-600'
                }`}
                aria-label={`Beat ${beatNum}${isAccent ? ' (accent)' : ''}`}
              />
            );
          })}
        </div>

        {/* Volume */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-mono text-slate-500">
            Volume: {volume}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(parseInt(e.target.value, 10))}
            className="w-full accent-indigo-500"
          />
        </div>

        {/* Start / Stop */}
        <button
          onClick={handleToggle}
          className={`w-full py-2 rounded-lg text-sm font-mono font-semibold
                     transition-colors ${
            isRunning
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
          aria-label={isRunning ? 'Stop metronome' : 'Start metronome'}
        >
          {isRunning ? 'Stop' : 'Start'}
        </button>

        {/* Close */}
        <button
          onClick={() => { handleStop(); onClose(); }}
          className="w-full py-1.5 rounded-lg text-xs font-mono
                     text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Close metronome"
        >
          Close
        </button>
      </div>
    </div>
  );
}