// All sound is synthesised: a looping London groove, an engine that follows the speed, and effects.
// Nothing plays until the first tap or key press; if audio is unavailable the game carries on silently.
import type { CityId } from './config/cities.ts';
import type { BodyStyle } from './config/vehicles.ts';
import type { SoundName } from './game/drive.ts';

interface Groove {
  readonly bpm: number;
  /** 16-step patterns: 1 = hit. */
  readonly kick: string;
  readonly snare: string;
  readonly hat: string;
  /** Bass notes per step as semitone offsets from the chord root, '.' for rest. */
  readonly bass: string;
  /** Chord stabs. */
  readonly stab: string;
  /** Chord roots (MIDI) per bar, and minor/major. */
  readonly chords: readonly (readonly [number, 'min' | 'maj'])[];
  readonly bassWave: OscillatorType;
  readonly stabWave: OscillatorType;
}

const GROOVES: Readonly<Record<CityId, Groove>> = {
  // Bouncy two-step: skipping kick, crisp snare, offbeat hats, warm plucks.
  london: {
    bpm: 128,
    kick: '1000000000100000',
    snare: '0000100000001000',
    hat: '0010001000100010',
    bass: '0...0..7..0.5...',
    stab: '0010000100100001',
    chords: [
      [50, 'min'],
      [46, 'maj'],
      [53, 'maj'],
      [48, 'maj'],
    ],
    bassWave: 'triangle',
    stabWave: 'sawtooth',
  },
};

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

export class SoundBoard {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineNodes: { gain: GainNode; a: OscillatorNode; b: OscillatorNode; filter: BiquadFilterNode } | null = null;
  private noise: AudioBuffer | null = null;
  private music: CityId | null = null;
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  private musicLevel = 0.6;
  private sfxLevel = 0.8;
  /** False when the browser could not create audio. */
  available = true;
  private style: BodyStyle = 'car';

  /** Create the audio context on the first user gesture. Returns false when audio is unavailable. */
  unlock(): boolean {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) {
      this.available = false;
      return false;
    }
    try {
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      this.musicGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.musicGain.connect(comp);
      this.sfxGain.connect(comp);
      this.setLevels(this.musicLevel, this.sfxLevel);
      const n = Math.floor(ctx.sampleRate * 1);
      this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      this.ctx = null;
      this.available = false;
      return false;
    }
  }

  setLevels(music: number, sfx: number): void {
    this.musicLevel = music;
    this.sfxLevel = sfx;
    const t = this.ctx?.currentTime ?? 0;
    this.musicGain?.gain.setTargetAtTime(music * 0.35, t, 0.05);
    this.sfxGain?.gain.setTargetAtTime(sfx * 0.7, t, 0.05);
  }

  // ---------- Music ----------
  /** Start (or switch) the city's groove; null stops it. */
  playMusic(city: CityId | null): void {
    if (city === this.music) return;
    this.music = city;
    window.clearInterval(this.timer);
    if (!city || !this.ctx) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule(): void {
    const c = this.ctx;
    const city = this.music;
    if (!c || !city) return;
    const g = GROOVES[city];
    const stepLen = 60 / g.bpm / 4;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(g, this.step, this.nextTime);
      this.nextTime += stepLen;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(g: Groove, step: number, t: number): void {
    const s = step % 16;
    const bar = Math.floor(step / 16) % g.chords.length;
    const [root, kind] = g.chords[bar] ?? [50, 'min'];
    const out = this.musicGain;
    if (!out) return;
    if (g.kick[s] === '1') this.kick(t, out);
    if (g.snare[s] === '1') this.snare(t, out);
    if (g.hat[s] === '1') this.hat(t, out, s % 4 === 2 ? 0.22 : 0.12);
    const b = g.bass[s];
    if (b && b !== '.') this.note(midi(root - 24 + Number.parseInt(b, 16)), t, 0.28, g.bassWave, 0.5, out, 900);
    if (g.stab[s] === '1') {
      const third = kind === 'min' ? 3 : 4;
      for (const iv of [0, third, 7]) this.note(midi(root + 12 + iv), t, 0.16, g.stabWave, 0.09, out, 2600);
    }
    // A little bell melody every other bar.
    if (step % 32 === 24 || step % 32 === 27) this.note(midi(root + 24 + (step % 32 === 24 ? 7 : 12)), t, 0.3, 'sine', 0.08, out, 6000);
  }

  private kick(t: number, out: AudioNode): void {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator();
    const gn = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    gn.gain.setValueAtTime(0.9, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(gn).connect(out);
    o.start(t);
    o.stop(t + 0.3);
  }

  private noiseHit(t: number, out: AudioNode, dur: number, gain: number, type: BiquadFilterType, freq: number): void {
    const c = this.ctx;
    if (!c || !this.noise) return;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const gn = c.createGain();
    gn.gain.setValueAtTime(gain, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(gn).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number, out: AudioNode): void {
    this.noiseHit(t, out, 0.16, 0.45, 'bandpass', 1800);
    this.note(190, t, 0.08, 'triangle', 0.2, out, 3000);
  }

  private hat(t: number, out: AudioNode, gain: number): void {
    this.noiseHit(t, out, 0.05, gain, 'highpass', 7000);
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, gain: number, out: AudioNode, cutoff: number): void {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(gn).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---------- Engine ----------
  /** Engine note for a body style at a share of top speed (0–1). */
  engine(level: number, throttle: boolean, style: BodyStyle): void {
    const c = this.ctx;
    const out = this.sfxGain;
    if (!c || !out) return;
    if (this.engineNodes && style !== this.style) this.engineOff();
    this.style = style;
    if (!this.engineNodes) {
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      const a = c.createOscillator();
      const b = c.createOscillator();
      a.type = 'sawtooth';
      b.type = style === 'bike' ? 'square' : 'sawtooth';
      a.connect(filter);
      b.connect(filter);
      filter.connect(gain).connect(out);
      a.start();
      b.start();
      this.engineNodes = { gain, a, b, filter };
    }
    const n = this.engineNodes;
    const t = c.currentTime;
    const k = Math.max(0, Math.min(1, level));
    const base = style === 'bus' ? 38 : style === 'bike' ? 70 : 48;
    const span = style === 'bus' ? 45 : style === 'bike' ? 150 : 95;
    const f = base + span * k;
    n.a.frequency.setTargetAtTime(f, t, 0.06);
    n.b.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    n.filter.frequency.setTargetAtTime(300 + (throttle ? 900 : 380) * (0.35 + k), t, 0.1);
    n.gain.gain.setTargetAtTime(throttle ? 0.06 : 0.04, t, 0.1);
  }

  /** Tyre and brake noise while braking hard (0–1). */
  brakes(level: number): void {
    const c = this.ctx;
    const out = this.sfxGain;
    if (!c || !out || !this.noise) return;
    if (level > 0.55 && !this.brakeNodes) {
      const src = c.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1700;
      f.Q.value = 3;
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      src.connect(f).connect(gain).connect(out);
      src.start();
      this.brakeNodes = { src, gain };
    }
    const n = this.brakeNodes;
    if (!n) return;
    const t = c.currentTime;
    n.gain.gain.setTargetAtTime(level > 0.55 ? (level - 0.5) * 0.12 : 0.0001, t, 0.05);
    if (level <= 0.05) {
      n.src.stop(t + 0.2);
      this.brakeNodes = null;
    }
  }
  private brakeNodes: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  engineOff(): void {
    this.brakes(0);
    const n = this.engineNodes;
    const c = this.ctx;
    if (!n || !c) return;
    const t = c.currentTime;
    n.gain.gain.setTargetAtTime(0.0001, t, 0.05);
    n.a.stop(t + 0.3);
    n.b.stop(t + 0.3);
    this.engineNodes = null;
  }

  // ---------- Effects ----------
  private sfx(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.2, at = 0, to?: number): void {
    const c = this.ctx;
    const out = this.sfxGain;
    if (!c || !out) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name: SoundName | 'tap' | 'beep' | 'go'): void {
    const out = this.sfxGain;
    const c = this.ctx;
    if (!out || !c) return;
    const t = c.currentTime;
    switch (name) {
      case 'coin':
        this.sfx(1568, 0.08, 'triangle', 0.14);
        this.sfx(2093, 0.18, 'triangle', 0.12, 0.07);
        break;
      case 'fare':
        this.sfx(988, 0.07, 'square', 0.06);
        this.sfx(1319, 0.2, 'square', 0.06, 0.07);
        break;
      case 'board':
        this.sfx(660, 0.14, 'sine', 0.12);
        break;
      case 'door':
        this.noiseHit(t, out, 0.35, 0.18, 'bandpass', 3200);
        break;
      case 'crash':
        this.noiseHit(t, out, 0.5, 0.7, 'lowpass', 1200);
        this.sfx(90, 0.4, 'sawtooth', 0.25, 0, 40);
        break;
      case 'whoosh': {
        const src = c.createBufferSource();
        if (!this.noise) break;
        src.buffer = this.noise;
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(600, t);
        f.frequency.exponentialRampToValueAtTime(3200, t + 0.25);
        const gn = c.createGain();
        gn.gain.setValueAtTime(0.0001, t);
        gn.gain.exponentialRampToValueAtTime(0.3, t + 0.1);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        src.connect(f).connect(gn).connect(out);
        src.start(t);
        src.stop(t + 0.4);
        break;
      }
      case 'bell':
        // The London bus bell: "ding ding".
        this.sfx(1760, 0.5, 'sine', 0.15);
        this.sfx(1760, 0.5, 'sine', 0.15, 0.22);
        break;
      case 'perfect':
        [784, 988, 1175, 1568].forEach((f, i) => this.sfx(f, 0.16, 'triangle', 0.1, i * 0.06));
        break;
      case 'complete':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.sfx(f, i === 5 ? 0.6 : 0.16, 'triangle', 0.12, i * 0.12));
        break;
      case 'over':
        [392, 330, 262].forEach((f, i) => this.sfx(f, 0.3, 'triangle', 0.12, i * 0.18));
        break;
      case 'step':
        this.sfx(320, 0.08, 'triangle', 0.08);
        break;
      case 'tap':
        this.sfx(880, 0.05, 'triangle', 0.06);
        break;
      case 'beep':
        this.sfx(660, 0.16, 'square', 0.06);
        break;
      case 'go':
        this.sfx(1320, 0.4, 'square', 0.06);
        break;
    }
  }
}
