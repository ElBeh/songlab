// Click sound generator using Web Audio API OscillatorNode.
// Shared infrastructure for count-in and future metronome feature.
// All timing uses AudioContext.currentTime for sample-accurate scheduling.

const ACCENT_FREQ = 1000;  // Hz – beat 1 (accent)
const NORMAL_FREQ = 800;   // Hz – other beats
const CLICK_DURATION = 0.04; // seconds (40ms burst)
const ACCENT_GAIN = 0.7;
const NORMAL_GAIN = 0.5;

let audioCtx: AudioContext | null = null;

/**
 * Eagerly create and resume the AudioContext.
 * Call this from a user gesture (e.g. toggling count-in on) so the context
 * is warm by the time scheduleBar is called.
 */
export function ensureAudioReady(): void {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/** Get or create AudioContext (synchronous, call ensureAudioReady first) */
export function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Schedule a single click at the given AudioContext time, return nodes for cancellation */
export function scheduleClick(
  ctx: AudioContext,
  time: number,
  accent: boolean,
  destination?: AudioNode,
): { osc: OscillatorNode; gain: GainNode } {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = accent ? ACCENT_FREQ : NORMAL_FREQ;

  gain.gain.setValueAtTime(accent ? ACCENT_GAIN : NORMAL_GAIN, time);
  // Quick fade-out to avoid click artifacts
  gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION);

  osc.connect(gain);
  gain.connect(destination ?? ctx.destination);

  osc.start(time);
  osc.stop(time + CLICK_DURATION);

  return { osc, gain };
}

export interface ScheduledBar {
  /** Cancel all scheduled clicks */
  cancel: () => void;
}

/**
 * Schedule one bar of clicks and invoke callbacks for each beat.
 *
 * @param bpm        - Tempo in beats per minute
 * @param beats      - Number of beats in the bar (e.g. 4 for 4/4)
 * @param onBeat     - Called on each beat (1-based index)
 * @param onComplete - Called after the last beat's duration has elapsed
 * @param audible    - Whether to play the click sound (false for viewers)
 * @returns Handle with cancel() to abort early
 */
export function scheduleBar(
  bpm: number,
  beats: number,
  onBeat: (beat: number) => void,
  onComplete: () => void,
  audible = true,
): ScheduledBar {
  const ctx = getAudioContext();
  const beatInterval = 60 / bpm; // seconds per beat
  const startTime = ctx.currentTime + 0.15; // buffer to ensure first beat is not in the past

  const timeouts: number[] = [];
  const nodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  let cancelled = false;

  for (let i = 0; i < beats; i++) {
    const clickTime = startTime + i * beatInterval;

    // Schedule audio click
    if (audible) {
      nodes.push(scheduleClick(ctx, clickTime, i === 0));
    }

    // Schedule visual callback via setTimeout (synced to AudioContext timeline)
    const delay = (clickTime - ctx.currentTime) * 1000;
    const tid = window.setTimeout(() => {
      if (!cancelled) onBeat(i + 1); // 1-based beat number
    }, delay);
    timeouts.push(tid);
  }

  // Schedule completion callback after last beat
  const completeDelay = (startTime + beats * beatInterval - ctx.currentTime) * 1000;
  const completeTid = window.setTimeout(() => {
    if (!cancelled) onComplete();
  }, completeDelay);
  timeouts.push(completeTid);

  return {
    cancel: () => {
      cancelled = true;
      timeouts.forEach((tid) => window.clearTimeout(tid));
      // Stop and disconnect all scheduled audio nodes
      for (const { osc, gain } of nodes) {
        try { osc.stop(); } catch { /* already stopped */ }
        osc.disconnect();
        gain.disconnect();
      }
    },
  };
}