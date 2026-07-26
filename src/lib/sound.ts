/**
 * Tiny synthesised UI sounds (first-run intro).
 *
 * Synthesised, not sampled, on purpose: the CSP in `index.html` declares no
 * `media-src`, so it falls back to `default-src 'self'` and any bundled or
 * `data:` audio source would be blocked. WebAudio oscillators are not.
 *
 * Voicing rules that keep it from being shrill: pure sines only (no triangle
 * harmonics), nothing above ~660 Hz, slow attacks, a low-pass that opens
 * gradually instead of starting bright, and a generated room tail so notes
 * bloom rather than stop.
 */

const MUTED_KEY = "beide.sound.muted.v1";

let ctx: AudioContext | null = null;
let tail: AudioBuffer | null = null;

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    /* ignore — sound preference is best-effort */
  }
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") {
    return null;
  }
  try {
    ctx ??= new AudioContext();
  } catch {
    return null;
  }
  // Electron defaults to `no-user-gesture-required`, but a suspended context
  // is still possible (locked profile, remote debugging) — nudge it awake.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Noise burst with an exponential decay — a cheap stand-in for a room. */
function reverbTail(audio: AudioContext): AudioBuffer {
  if (tail) return tail;
  const seconds = 2.8;
  const len = Math.floor(audio.sampleRate * seconds);
  const buf = audio.createBuffer(2, len, audio.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i += 1) {
      const t = i / len;
      // Slight pre-delay ramp so the very front stays dry and defined.
      const swell = Math.min(1, t * 26);
      data[i] = (Math.random() * 2 - 1) * swell * (1 - t) ** 2.6;
    }
  }
  tail = buf;
  return tail;
}

interface Voice {
  freq: number;
  /** start offset from the gesture, seconds */
  at: number;
  attack: number;
  hold: number;
  release: number;
  gain: number;
}

interface Shape {
  voices: Voice[];
  /** low-pass sweep, Hz */
  filterFrom: number;
  filterTo: number;
  filterSweep: number;
  wet: number;
}

function play({ voices, filterFrom, filterTo, filterSweep, wet }: Shape): boolean {
  const audio = getContext();
  if (!audio) return false;

  const bus = audio.createGain();
  bus.gain.value = 1;

  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  // Q below 0.7 keeps the cutoff from ringing at the corner frequency.
  filter.Q.value = 0.5;

  const dry = audio.createGain();
  dry.gain.value = 1 - wet;

  const wetGain = audio.createGain();
  wetGain.gain.value = wet;

  const room = audio.createConvolver();
  room.buffer = reverbTail(audio);

  bus.connect(filter);
  filter.connect(dry);
  filter.connect(room);
  room.connect(wetGain);
  dry.connect(audio.destination);
  wetGain.connect(audio.destination);

  const t0 = audio.currentTime + 0.03;

  filter.frequency.setValueAtTime(filterFrom, t0);
  filter.frequency.linearRampToValueAtTime(filterTo, t0 + filterSweep);

  for (const v of voices) {
    const start = t0 + v.at;
    const end = start + v.attack + v.hold + v.release;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(v.gain, start + v.attack);
    gain.gain.setValueAtTime(v.gain, start + v.attack + v.hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(bus);

    // Two sines a few cents apart: the slow beating reads as warmth and stops
    // a lone sine from sounding like a test tone.
    for (const cents of [-4, 4]) {
      const osc = audio.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(v.freq, start);
      osc.detune.setValueAtTime(cents, start);
      osc.connect(gain);
      osc.start(start);
      osc.stop(end + 0.05);
      osc.onended = () => osc.disconnect();
    }

    window.setTimeout(() => gain.disconnect(), (end - t0 + 0.5) * 1000);
  }

  const last = voices.reduce(
    (m, v) => Math.max(m, v.at + v.attack + v.hold + v.release),
    0,
  );
  window.setTimeout(
    () => {
      bus.disconnect();
      filter.disconnect();
      dry.disconnect();
      room.disconnect();
      wetGain.disconnect();
    },
    (last + 3.2) * 1000,
  );

  return true;
}

/**
 * Slow D-major bloom under the intro: a low pad swells first, then D4 · F#4 ·
 * A4 arrive a beat apart and ring out over the animation.
 */
export function playIntroChime(): boolean {
  if (isSoundMuted()) return false;
  return play({
    voices: [
      // pad
      { freq: 73.42, at: 0.0, attack: 0.9, hold: 1.4, release: 2.6, gain: 0.05 },
      { freq: 146.83, at: 0.0, attack: 0.8, hold: 1.5, release: 2.4, gain: 0.045 },
      { freq: 220.0, at: 0.35, attack: 0.7, hold: 1.2, release: 2.2, gain: 0.03 },
      // arpeggio
      { freq: 293.66, at: 0.55, attack: 0.14, hold: 0.1, release: 2.6, gain: 0.07 },
      { freq: 369.99, at: 1.15, attack: 0.14, hold: 0.1, release: 2.4, gain: 0.055 },
      { freq: 440.0, at: 1.75, attack: 0.16, hold: 0.1, release: 2.8, gain: 0.05 },
      { freq: 587.33, at: 2.35, attack: 0.22, hold: 0.1, release: 3.0, gain: 0.032 },
    ],
    filterFrom: 520,
    filterTo: 2100,
    filterSweep: 2.6,
    wet: 0.34,
  });
}

/** Soft low confirmation when the intro CTA is pressed. */
export function playConfirm(): boolean {
  if (isSoundMuted()) return false;
  return play({
    voices: [
      { freq: 293.66, at: 0.0, attack: 0.05, hold: 0.04, release: 0.9, gain: 0.05 },
      { freq: 440.0, at: 0.09, attack: 0.06, hold: 0.04, release: 1.1, gain: 0.038 },
    ],
    filterFrom: 900,
    filterTo: 1700,
    filterSweep: 0.5,
    wet: 0.28,
  });
}
