import type { HornId } from './rules/data.ts';

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  to?: number;
  at?: number;
}

/** All sound is synthesised; nothing plays until the first tap or key press. */
export class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private hornNodes: { gain: GainNode; stop: () => void } | null = null;
  private rainNodes: { gain: GainNode; source: AudioBufferSourceNode } | null = null;
  private engineNodes: { gain: GainNode; a: OscillatorNode; b: OscillatorNode; filter: BiquadFilterNode; electric: boolean } | null = null;
  private muted = false;
  horn: HornId = 'classic';

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.6;
  }

  private tone(freq: number, dur: number, o: ToneOptions = {}): void {
    const c = this.ctx;
    const out = this.master;
    if (!c || !out) return;
    const t0 = c.currentTime + (o.at ?? 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private noiseBuffer(seconds: number): AudioBuffer | null {
    const c = this.ctx;
    if (!c) return null;
    const n = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noise(dur: number, gain: number, cutoff = 900): void {
    const c = this.ctx;
    const out = this.master;
    const buf = this.noiseBuffer(dur);
    if (!c || !out || !buf) return;
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (data[i] ?? 0) * (1 - i / data.length);
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = buf;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start();
  }

  hornOn(): void {
    const c = this.ctx;
    const out = this.master;
    if (!c || !out || this.hornNodes) return;
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.horn === 'bass' ? 700 : 1900;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.03);
    filter.connect(gain);
    gain.connect(out);
    const oscs: OscillatorNode[] = [];
    const now = c.currentTime;
    const make = (freq: number, type: OscillatorType = 'square'): OscillatorNode => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(filter);
      o.start(now);
      oscs.push(o);
      return o;
    };
    if (this.horn === 'classic') {
      make(415);
      make(523);
    } else if (this.horn === 'bass') {
      make(110, 'sawtooth');
      make(138, 'sawtooth');
    } else if (this.horn === 'trumpet') {
      const o = make(392);
      [392, 494, 587, 784].forEach((f, i) => o.frequency.setValueAtTime(f, now + i * 0.11));
    } else {
      const o = make(523, 'triangle');
      [523, 659, 784, 659, 880, 784, 659, 523].forEach((f, i) => o.frequency.setValueAtTime(f, now + i * 0.13));
    }
    this.hornNodes = {
      gain,
      stop: () => {
        const t = c.currentTime;
        gain.gain.setTargetAtTime(0.0001, t, 0.03);
        for (const o of oscs) o.stop(t + 0.2);
      },
    };
  }

  hornOff(): void {
    this.hornNodes?.stop();
    this.hornNodes = null;
  }

  /** Short preview of a horn in the garage. */
  previewHorn(id: HornId): void {
    const before = this.horn;
    this.horn = id;
    this.hornOn();
    window.setTimeout(() => {
      this.hornOff();
      this.horn = before;
    }, 650);
  }

  setRain(level: number): void {
    const c = this.ctx;
    const out = this.master;
    if (!c || !out) return;
    if (level > 0.02 && !this.rainNodes) {
      const buf = this.noiseBuffer(2);
      if (!buf) return;
      const source = c.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2400;
      f.Q.value = 0.4;
      const gain = c.createGain();
      gain.gain.value = 0;
      source.connect(f);
      f.connect(gain);
      gain.connect(out);
      source.start();
      this.rainNodes = { gain, source };
    }
    if (this.rainNodes) {
      this.rainNodes.gain.gain.value = level * 0.12;
      if (level <= 0.02) {
        this.rainNodes.source.stop();
        this.rainNodes = null;
      }
    }
  }

  /** Race engine note pitched by speed (0–1): a petrol growl through the gears, or an electric whine. */
  engine(level: number, throttle: boolean, electric: boolean): void {
    const c = this.ctx;
    const out = this.master;
    if (!c || !out) return;
    if (this.engineNodes && this.engineNodes.electric !== electric) this.engineOff();
    if (!this.engineNodes) {
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      const a = c.createOscillator();
      const b = c.createOscillator();
      a.type = electric ? 'sine' : 'sawtooth';
      b.type = electric ? 'triangle' : 'square';
      a.connect(filter);
      b.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      a.start();
      b.start();
      this.engineNodes = { gain, a, b, filter, electric };
    }
    const n = this.engineNodes;
    const t = c.currentTime;
    const k = Math.max(0, Math.min(1, level));
    if (electric) {
      n.a.frequency.setTargetAtTime(160 + 900 * k, t, 0.05);
      n.b.frequency.setTargetAtTime(320 + 1800 * k, t, 0.05);
      n.filter.frequency.setTargetAtTime(3000, t, 0.1);
      n.gain.gain.setTargetAtTime((throttle ? 0.035 : 0.02) * (0.3 + k), t, 0.08);
    } else {
      // Four gears: the pitch climbs, drops at each change, then climbs again.
      const gear = Math.min(3, Math.floor(k * 4));
      const f = 48 + gear * 14 + (k * 4 - gear) * 55;
      n.a.frequency.setTargetAtTime(f, t, 0.04);
      n.b.frequency.setTargetAtTime(f * 0.5, t, 0.04);
      n.filter.frequency.setTargetAtTime(380 + (throttle ? 900 : 300) * (0.4 + k), t, 0.08);
      n.gain.gain.setTargetAtTime(throttle ? 0.07 : 0.045, t, 0.08);
    }
  }

  engineOff(): void {
    const n = this.engineNodes;
    const c = this.ctx;
    if (!n || !c) return;
    const t = c.currentTime;
    n.gain.gain.setTargetAtTime(0.0001, t, 0.05);
    n.a.stop(t + 0.3);
    n.b.stop(t + 0.3);
    this.engineNodes = null;
  }

  /** Race countdown: short beeps for 3, 2, 1 and a long high one for GO. */
  countBeep(go: boolean): void {
    this.tone(go ? 1320 : 660, go ? 0.45 : 0.18, { type: 'square', gain: 0.07 });
  }

  note(): void {
    this.tone(1320, 0.08, { type: 'triangle', gain: 0.1 });
    this.tone(1760, 0.1, { type: 'triangle', gain: 0.09, at: 0.06 });
  }
  board(): void {
    this.tone(660, 0.12, { gain: 0.12 });
  }
  fare(): void {
    this.tone(988, 0.08, { type: 'square', gain: 0.06 });
    this.tone(1319, 0.22, { type: 'square', gain: 0.06, at: 0.08 });
  }
  coin(): void {
    this.tone(2093, 0.06, { type: 'triangle', gain: 0.08 });
  }
  changeOk(): void {
    [784, 988, 1175].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', gain: 0.09, at: i * 0.07 }));
  }
  changeBad(): void {
    this.tone(330, 0.25, { type: 'sawtooth', gain: 0.07, to: 200 });
  }
  hop(): void {
    this.tone(300, 0.18, { type: 'triangle', gain: 0.12, to: 540 });
  }
  thud(): void {
    this.tone(110, 0.2, { gain: 0.25, to: 55 });
    this.noise(0.12, 0.15);
  }
  splash(): void {
    this.noise(0.3, 0.25, 2600);
  }
  crash(): void {
    this.noise(0.45, 0.45);
    this.tone(90, 0.35, { type: 'sawtooth', gain: 0.16, to: 40 });
  }
  whistle(): void {
    for (let i = 0; i < 2; i++) this.tone(2900, 0.16, { gain: 0.08, at: i * 0.22, to: 3100 });
  }
  beep(): void {
    this.tone(1046, 0.1, { type: 'square', gain: 0.05 });
    this.tone(1046, 0.1, { type: 'square', gain: 0.05, at: 0.15 });
  }
  pump(): void {
    this.tone(180, 0.05, { type: 'square', gain: 0.03 });
  }
  snap(): void {
    this.noise(0.08, 0.3, 5000);
  }
  scare(): void {
    this.tone(620, 0.25, { type: 'sawtooth', gain: 0.06, to: 880 });
  }
  jingle(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', gain: 0.1, at: i * 0.09 }));
  }
  reverseBeep(): void {
    this.tone(1200, 0.08, { type: 'square', gain: 0.04 });
  }
}
