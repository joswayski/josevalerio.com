/**
 * Tiny Web Audio sound board: every effect and the music loop are
 * synthesized, so the site ships no audio files. Browsers only allow audio
 * after a user gesture, so the first sound plays from a click.
 */

type ToneOptions = {
  type?: OscillatorType;
  vol?: number;
  /** Slide the pitch to this frequency over the note. */
  to?: number;
  delay?: number;
  attack?: number;
  vibrato?: number;
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
  osc.connect(envelope(c, start, o.vol ?? 0.12, o.attack ?? 0.005, dur)).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise(dur: number, freq: number, vol: number) {
  const c = audio();
  if (!c || !master || !noiseBuffer || state.muted) return;
  const start = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = freq;
  src
    .connect(filter)
    .connect(envelope(c, start, vol, 0.003, dur))
    .connect(master);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.05);
}

let stepCount = 0;

const SOUNDS = {
  tick: () => tone(1800, 0.025, { vol: 0.025 }),
  pop: () => tone(500, 0.09, { type: "sine", to: 1200, vol: 0.18 }),
  close: () => tone(900, 0.1, { type: "sine", to: 300, vol: 0.15 }),
  step: () => tone(stepCount++ % 2 ? 520 : 440, 0.05, { type: "triangle", vol: 0.08 }),
  boing: () => tone(220, 0.35, { type: "sine", to: 880, vol: 0.18, vibrato: 12 }),
  go: () => [523, 659, 784, 1046].forEach((f, k) => tone(f, 0.18, { vol: 0.06, delay: k * 0.07 })),
  coin: () => {
    tone(988, 0.08, { vol: 0.06 });
    tone(1319, 0.3, { vol: 0.06, delay: 0.08 });
  },
};

export type SoundName = keyof typeof SOUNDS;

export function play(name: SoundName) {
  SOUNDS[name]();
}

// An original 32-step chiptune loop: melody in eighth notes, bass every half bar.
const MELODY = [
  72, 0, 76, 79, 77, 0, 76, 74, 72, 0, 74, 76, 74, 0, 67, 0, 72, 0, 76, 79, 81, 0, 79, 77, 76, 74,
  72, 74, 72, 0, 0, 0,
];
const BASS = [48, 48, 55, 55, 53, 53, 50, 50];
const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStep = 0;

function musicTick() {
  const note = MELODY[musicStep % MELODY.length];
  if (note) tone(midi(note), 0.16, { vol: 0.035 });
  if (musicStep % 4 === 0) {
    tone(midi(BASS[(musicStep / 4) % BASS.length]), 0.3, { type: "triangle", vol: 0.08 });
  }
  if (musicStep % 2 === 1) noise(0.03, 6000, 0.03);
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
    musicTimer = setInterval(musicTick, 150);
  }
  setState({ music: musicTimer !== null });
}
