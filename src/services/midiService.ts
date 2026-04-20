// MIDI input service.
// Handles Web MIDI API access, device enumeration, and message parsing.
// Module-level state pattern (like syncEmitter.ts).

import { useToastStore } from '../stores/useToastStore';

// --- Types ---

export type MidiMessageType = 'note_on' | 'note_off' | 'cc' | 'program_change';

export interface MidiMessage {
  type: MidiMessageType;
  channel: number;   // 0–15
  note: number;      // note number or CC number (0–127)
  value: number;     // velocity or CC value (0–127)
  deviceId: string;  // input device ID
}

export type MidiCommand =
  | 'TRANSPORT_TOGGLE'
  | 'SECTION_PREV'
  | 'SECTION_NEXT'
  | 'LOOP_TOGGLE'
  | 'SONG_PREV'
  | 'SONG_NEXT'
  | 'TEMPO_DOWN'
  | 'TEMPO_UP'
  | 'SEEK_BACK'
  | 'SEEK_FORWARD'
  | 'LOOP_SET_A'
  | 'LOOP_SET_B';

export interface MidiMapping {
  command: MidiCommand;
  type: MidiMessageType;
  channel: number;   // 0–15, or -1 for any channel
  note: number;      // note/CC number
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export type MidiMessageListener = (message: MidiMessage) => void;

// --- Default mapping (CC 1–8 on any channel) ---

export const DEFAULT_MAPPINGS: MidiMapping[] = [
  { command: 'TRANSPORT_TOGGLE', type: 'cc', channel: -1, note: 1 },
  { command: 'SECTION_PREV', type: 'cc', channel: -1, note: 2 },
  { command: 'SECTION_NEXT', type: 'cc', channel: -1, note: 3 },
  { command: 'LOOP_TOGGLE', type: 'cc', channel: -1, note: 4 },
  { command: 'SONG_PREV', type: 'cc', channel: -1, note: 5 },
  { command: 'SONG_NEXT', type: 'cc', channel: -1, note: 6 },
  { command: 'TEMPO_DOWN', type: 'cc', channel: -1, note: 7 },
  { command: 'TEMPO_UP', type: 'cc', channel: -1, note: 8 },
  { command: 'SEEK_BACK', type: 'cc', channel: -1, note: 9 },
  { command: 'SEEK_FORWARD', type: 'cc', channel: -1, note: 10 },
  { command: 'LOOP_SET_A', type: 'cc', channel: -1, note: 11 },
  { command: 'LOOP_SET_B', type: 'cc', channel: -1, note: 12 },
];

// --- Module-level state ---

let _access: MIDIAccess | null = null;
const _listeners = new Set<MidiMessageListener>();
const _boundHandlers = new Map<string, (e: Event) => void>();

// --- Public API ---

export function isMidiSupported(): boolean {
  return 'requestMIDIAccess' in navigator;
}

export async function requestMidiAccess(): Promise<boolean> {
  if (!isMidiSupported()) {
    console.error('Web MIDI API is not supported in this browser');
    useToastStore.getState().addToast(
      'Web MIDI API is not supported in this browser',
      'error',
    );
    return false;
  }

  try {
    _access = await navigator.requestMIDIAccess();
    _access.addEventListener('statechange', handleStateChange);
    return true;
  } catch (error) {
    console.error('Failed to request MIDI access:', error);
    useToastStore.getState().addToast(
      'MIDI access denied',
      'error',
    );
    return false;
  }
}

export function getMidiAccess(): MIDIAccess | null {
  return _access;
}

export function getInputDevices(): MidiDeviceInfo[] {
  if (!_access) return [];
  const devices: MidiDeviceInfo[] = [];
  _access.inputs.forEach((input) => {
    devices.push({
      id: input.id,
      name: input.name ?? 'Unknown device',
      manufacturer: input.manufacturer ?? '',
    });
  });
  return devices;
}

export function listenToAllInputs(): void {
  if (!_access) return;
  stopListening();
  _access.inputs.forEach((input) => {
    listenToInput(input.id);
  });
}

export function listenToInput(inputId: string): void {
  if (!_access) return;
  const input = _access.inputs.get(inputId);
  if (!input) return;

  // Avoid duplicate listeners
  if (_boundHandlers.has(inputId)) return;

  const handler = (e: Event) => {
    const midiEvent = e as MIDIMessageEvent;
    if (!midiEvent.data) return;
    const message = parseMidiMessage(midiEvent.data, inputId);
    if (message) {
      _listeners.forEach((listener) => listener(message));
    }
  };

  input.addEventListener('midimessage', handler);
  _boundHandlers.set(inputId, handler);
}

export function stopListening(): void {
  if (!_access) return;
  _boundHandlers.forEach((handler, inputId) => {
    const input = _access!.inputs.get(inputId);
    if (input) {
      input.removeEventListener('midimessage', handler);
    }
  });
  _boundHandlers.clear();
}

export function addMessageListener(listener: MidiMessageListener): void {
  _listeners.add(listener);
}

export function removeMessageListener(listener: MidiMessageListener): void {
  _listeners.delete(listener);
}

export function disconnect(): void {
  stopListening();
  if (_access) {
    _access.removeEventListener('statechange', handleStateChange);
  }
  _access = null;
  _listeners.clear();
}

// --- Mapping helpers ---

export function matchMapping(
  message: MidiMessage,
  mappings: MidiMapping[],
): MidiCommand | null {
  for (const mapping of mappings) {
    if (mapping.type !== message.type) continue;
    if (mapping.channel !== -1 && mapping.channel !== message.channel) continue;
    if (mapping.note !== message.note) continue;
    // For CC: trigger on value > 0 (button press, not release)
    // For note_on: always match (velocity > 0 is implied by type)
    if (message.type === 'cc' && message.value === 0) continue;
    return mapping.command;
  }
  return null;
}

// --- Internal helpers ---

function parseMidiMessage(
  data: Uint8Array,
  deviceId: string,
): MidiMessage | null {
  if (data.length < 2) return null;

  const status = data[0];
  const channel = status & 0x0f;
  const messageType = status & 0xf0;

  // Program Change: 2 bytes only (status + program number)
  if (messageType === 0xc0) {
    return {
      type: 'program_change',
      channel,
      note: data[1],
      value: 0,
      deviceId,
    };
  }

  // All other handled messages need 3 bytes
  if (data.length < 3) return null;

  switch (messageType) {
    case 0x90: // Note On
      // Velocity 0 = Note Off per MIDI spec
      return {
        type: data[2] > 0 ? 'note_on' : 'note_off',
        channel,
        note: data[1],
        value: data[2],
        deviceId,
      };
    case 0x80: // Note Off
      return {
        type: 'note_off',
        channel,
        note: data[1],
        value: data[2],
        deviceId,
      };
    case 0xb0: // Control Change
      return {
        type: 'cc',
        channel,
        note: data[1],
        value: data[2],
        deviceId,
      };
    default:
      return null;
  }
}

function handleStateChange(): void {
  // Re-attach listeners when devices connect/disconnect.
  // Existing listeners for removed devices are cleaned up,
  // new devices are picked up automatically.
  if (!_access) return;
  const activeIds = new Set<string>();
  _access.inputs.forEach((input) => activeIds.add(input.id));

  // Remove handlers for disconnected devices
  _boundHandlers.forEach((_handler, inputId) => {
    if (!activeIds.has(inputId)) {
      _boundHandlers.delete(inputId);
    }
  });

  // Attach to any new devices
  _access.inputs.forEach((input) => {
    if (!_boundHandlers.has(input.id)) {
      listenToInput(input.id);
    }
  });
}