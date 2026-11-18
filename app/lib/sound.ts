/**
 * Tiny Web Audio sound board: every effect and the music loop are
 * synthesized, so the site ships no audio files. Browsers only allow audio
 * after a user gesture, so the first sound plays from a click.
 */

import type { SoundKey } from "../data/town";

type ToneOptions = {
  type?: OscillatorType;
  vol?: number;
  /** Slide the pitch to this frequency over the note. */
  to?: number;
  delay?: number;
  attack?: number;
  vibrato?: number;
  /** Low-pass cutoff in Hz, to soften bright waveforms. */
  filter?: number;
};

type NoiseOptions = {
  type?: BiquadFilterType;
  freq?: number;
  vol?: number;
  delay?: number;
  attack?: number;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function envelope(c: AudioContext, start: number, vol: number, attack: number, dur: number) {
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  return gain;
}

function tone(freq: number, dur: number, o: ToneOptions = {}) {
  const c = audio();
  if (!c || !master || state.muted) return;
  const start = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? "square";
  osc.frequency.setValueAtTime(freq, start);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, start + dur);
  if (o.vibrato) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = o.vibrato;
    depth.gain.value = freq * 0.04;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + dur + 0.05);
  }
  let node: AudioNode = osc;
  if (o.filter) {
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = o.filter;
    node = node.connect(filter);
  }
  node.connect(envelope(c, start, o.vol ?? 0.12, o.attack ?? 0.005, dur)).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise(dur: number, o: NoiseOptions = {}) {
  const c = audio();
  if (!c || !master || !noiseBuffer || state.muted) return;
  const start = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = o.type ?? "lowpass";
  filter.frequency.value = o.freq ?? 1200;
  src
    .connect(filter)
    .connect(envelope(c, start, o.vol ?? 0.1, o.attack ?? 0.003, dur))
    .connect(master);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.05);
}

/** One selection sound per building type, like the game's building acknowledgements. */
const BUILDING_SOUNDS: Record<SoundKey, () => void> = {
  horn: () => {
    tone(196, 0.9, { type: "sawtooth", vol: 0.1, filter: 900, attack: 0.08, vibrato: 5 });
    tone(294, 0.7, { type: "sawtooth", vol: 0.07, filter: 900, attack: 0.08, delay: 0.25 });
  },
  tavern: () => {
    tone(2200, 0.25, { type: "triangle", vol: 0.08 });
    tone(2900, 0.3, { type: "triangle", vol: 0.06, delay: 0.07 });
    noise(0.4, { type: "bandpass", freq: 900, vol: 0.05, delay: 0.1 });
  },
  shutter: () => {
    noise(0.03, { type: "highpass", freq: 2500, vol: 0.3 });
    noise(0.05, { type: "highpass", freq: 1800, vol: 0.25, delay: 0.09 });
  },
  coins: () =>
    [0, 0.06, 0.13, 0.19].forEach((delay, k) => tone(1800 + k * 300, 0.12, { vol: 0.04, delay })),
  chimes: () =>
    [523, 659, 784, 1047, 1319].forEach((f, k) =>
      tone(f, 0.5, { type: "sine", vol: 0.06, delay: k * 0.07 }),
    ),
  chop: () => {
    for (const delay of [0, 0.32]) {
      noise(0.06, { freq: 2200, vol: 0.3, delay });
      tone(110, 0.18, { type: "sine", to: 55, vol: 0.3, delay });
    }
  },
  bell: () => {
    tone(523, 1.6, { type: "sine", vol: 0.12 });
    tone(1046, 1.2, { type: "sine", vol: 0.05 });
    tone(1568, 0.8, { type: "sine", vol: 0.03 });
  },
  coo: () => {
    tone(420, 0.22, { type: "sine", to: 340, vol: 0.12, vibrato: 18 });
    tone(380, 0.35, { type: "sine", to: 300, vol: 0.1, vibrato: 18, delay: 0.26 });
  },
};

const SOUNDS = {
  hover: () => tone(1400, 0.03, { type: "triangle", vol: 0.03 }),
  click: () => {
    noise(0.08, { freq: 400, vol: 0.25 });
    tone(160, 0.12, { type: "sine", to: 70, vol: 0.25 });
  },
  button: () => tone(660, 0.05, { vol: 0.05 }),
  step: () => noise(0.05, { freq: 500 + Math.random() * 300, vol: 0.1 }),
  fanfare: () =>
    (
      [
        [392, 0],
        [392, 0.18],
        [523, 0.36],
        [659, 0.62],
      ] as const
    ).forEach(([f, delay]) =>
      tone(f, delay === 0.62 ? 0.9 : 0.2, { type: "sawtooth", vol: 0.09, filter: 1400, delay }),
    ),
};

export type SoundName = keyof typeof SOUNDS;

export function play(name: SoundName) {
  SOUNDS[name]();
}

export function playBuilding(key: SoundKey) {
  BUILDING_SOUNDS[key]();
}

// An original lute-and-drone loop in D Dorian: one plucked note per step,
// a low drone every bar, and a soft frame-drum hit on the downbeat.
const MELODY = [
  62, 0, 65, 67, 69, 0, 67, 65, 64, 0, 62, 64, 65, 0, 0, 0, 69, 0, 72, 71, 69, 0, 67, 65, 67, 69,
  65, 64, 62, 0, 0, 0,
];
const DRONE = [50, 50, 48, 50];
const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStep = 0;

function musicTick() {
  const note = MELODY[musicStep % MELODY.length];
  if (note) tone(midi(note), 0.5, { type: "triangle", vol: 0.06, filter: 1800 });
  if (musicStep % 8 === 0) {
    const drone = midi(DRONE[(musicStep / 8) % DRONE.length]);
    tone(drone, 2.2, { type: "sawtooth", vol: 0.025, filter: 500, attack: 0.3 });
    noise(0.25, { freq: 180, vol: 0.12 });
  }
  musicStep++;
}

// Shared state so every sound and music toggle on the page stays in sync.
type SoundState = { muted: boolean; music: boolean };
const SERVER_STATE: SoundState = { muted: false, music: false };
let state: SoundState = SERVER_STATE;
const listeners = new Set<() => void>();

function setState(next: Partial<SoundState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export const soundStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
  getServerSnapshot: () => SERVER_STATE,
};

export function toggleMuted() {
  setState({ muted: !state.muted });
}

export function toggleMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  } else {
    audio();
    musicTimer = setInterval(musicTick, 260);
  }
  setState({ music: musicTimer !== null });
}
