import { PAX, type PaxKind } from '../rules/data.ts';
import { byId, TextCache } from './dom.ts';

export type CalloutKind = 'conductor' | 'passenger' | 'info' | 'mission';
export type AlertTone = 'ok' | 'warn' | 'bad' | 'info';

export interface HudData {
  readonly cash: number;
  readonly cashText: string;
  readonly streak: number;
  readonly multText: string;
  readonly distText: string;
  readonly clock: string;
  readonly skyText: string;
  readonly fuel: number;
  readonly fuelLow: boolean;
  readonly body: number;
  readonly bodyMax: number;
  readonly seatsText: string;
  readonly riders: readonly PaxKind[];
  readonly speedKmh: number;
  readonly stop: { name: string; dist: string; info: string; hint: string; busy: boolean; here: boolean } | null;
  readonly alerts: readonly { id: string; text: string; tone: AlertTone }[];
  readonly parked: boolean;
}

export interface RaceHudData {
  readonly place: string;
  readonly of: string;
  readonly time: string;
  readonly togo: string;
  readonly body: number;
  readonly bodyMax: number;
  readonly speedKmh: number;
  /** Everyone's progress from start (0) to finish (1). */
  readonly track: readonly { pct: number; color: string; you: boolean }[];
}

export class Hud {
  private readonly root = byId('hud');
  private readonly text = new TextCache();
  private readonly el = {
    cash: byId('h-cash'),
    mult: byId('h-mult'),
    dist: byId('h-dist'),
    clock: byId('h-clock'),
    sky: byId('h-sky'),
    fuel: byId('h-fuel'),
    fuelChip: byId('h-fuel-chip'),
    body: byId('h-body'),
    seats: byId('h-seats'),
    riders: byId('h-riders'),
    speed: byId('h-speed'),
    card: byId('h-card'),
    stopName: byId('h-stop-name'),
    stopDist: byId('h-stop-dist'),
    stopInfo: byId('h-stop-info'),
    stopHint: byId('h-stop-hint'),
    alerts: byId('h-alerts'),
    callout: byId('h-callout'),
    popups: byId('popups'),
    flash: byId('flash'),
    hop: byId('b-hop'),
    pos: byId('h-pos'),
    of: byId('h-of'),
    time: byId('h-time'),
    togo: byId('h-togo'),
    track: byId('h-track'),
    countdown: byId('countdown'),
  };
  private marks: HTMLElement[] = [];
  private readonly queue: { text: string; kind: CalloutKind }[] = [];
  private calloutT = 0;
  private bodyKey = '';
  private ridersKey = '';
  private alertsKey = '';

  show(on: boolean): void {
    this.root.hidden = !on;
    if (on) {
      this.text.clear();
      this.bodyKey = this.ridersKey = this.alertsKey = '';
      this.marks = [];
      this.el.track.replaceChildren();
    } else {
      this.queue.length = 0;
      this.el.callout.className = 'callout';
    }
  }

  /** Switch between the danfo run read-outs and the race read-outs. */
  racing(on: boolean): void {
    this.root.classList.toggle('racing', on);
    if (on) this.el.card.hidden = true;
    this.el.alerts.replaceChildren();
    this.alertsKey = '';
    this.el.countdown.className = '';
  }

  /** Big centred countdown text: "3", "2", "1", "GO!". */
  countdown(text: string): void {
    this.el.countdown.textContent = text;
    this.el.countdown.className = '';
    void this.el.countdown.offsetWidth;
    this.el.countdown.className = text === 'GO!' ? 'on go' : 'on';
  }

  say(text: string, kind: CalloutKind = 'conductor'): void {
    this.queue.push({ text, kind });
    if (this.queue.length > 3) this.queue.shift();
  }

  popup(main: string, sub = '', tone: 'good' | 'bad' | 'gold' = 'good'): void {
    const el = document.createElement('div');
    el.className = `pop ${tone}`;
    const b = document.createElement('b');
    b.textContent = main;
    el.appendChild(b);
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      el.appendChild(s);
    }
    this.el.popups.appendChild(el);
    window.setTimeout(() => el.remove(), 1200);
  }

  flash(): void {
    this.el.flash.classList.remove('on');
    void this.el.flash.offsetWidth;
    this.el.flash.classList.add('on');
  }

  tick(dt: number): void {
    this.calloutT -= dt;
    if (this.calloutT > 0) return;
    const next = this.queue.shift();
    if (next) {
      this.el.callout.textContent = next.text;
      this.el.callout.className = `callout show ${next.kind}`;
      this.calloutT = 2.4;
    } else this.el.callout.className = 'callout';
  }

  update(d: HudData): void {
    const t = this.text;
    t.set(this.el.cash, d.cashText);
    t.set(this.el.mult, d.multText);
    this.el.mult.classList.toggle('hot', d.streak > 0);
    t.set(this.el.dist, d.distText);
    t.set(this.el.clock, d.clock);
    t.set(this.el.sky, d.skyText);
    t.set(this.el.seats, d.seatsText);
    t.set(this.el.speed, String(Math.round(d.speedKmh)));
    t.set(this.el.hop, d.parked ? 'Go' : 'Hop');
    this.el.hop.classList.toggle('go', d.parked);
    this.el.fuel.style.transform = `scaleX(${Math.max(0, Math.min(1, d.fuel)).toFixed(3)})`;
    this.el.fuelChip.classList.toggle('low', d.fuelLow);
    this.bodywork(d.body, d.bodyMax);
    const ridersKey = d.riders.join(',');
    if (ridersKey !== this.ridersKey) {
      this.ridersKey = ridersKey;
      this.el.riders.replaceChildren(
        ...d.riders.map((kind) => {
          const dot = document.createElement('i');
          dot.style.background = PAX[kind].color;
          dot.title = PAX[kind].label;
          if (PAX[kind].seats > 1) dot.className = 'wide';
          return dot;
        }),
      );
    }
    const alertsKey = d.alerts.map((a) => `${a.id}:${a.text}:${a.tone}`).join('|');
    if (alertsKey !== this.alertsKey) {
      this.alertsKey = alertsKey;
      this.el.alerts.replaceChildren(
        ...d.alerts.map((a) => {
          const chip = document.createElement('span');
          chip.className = `alert ${a.tone}`;
          chip.textContent = a.text;
          return chip;
        }),
      );
    }
    this.el.card.hidden = d.stop === null;
    if (d.stop) {
      t.set(this.el.stopName, d.stop.name);
      t.set(this.el.stopDist, d.stop.dist);
      t.set(this.el.stopInfo, d.stop.info);
      t.set(this.el.stopHint, d.stop.hint);
      this.el.card.classList.toggle('busy', d.stop.busy);
      this.el.card.classList.toggle('here', d.stop.here);
    }
  }

  updateRace(d: RaceHudData): void {
    const t = this.text;
    t.set(this.el.pos, d.place);
    t.set(this.el.of, d.of);
    t.set(this.el.time, d.time);
    t.set(this.el.togo, d.togo);
    t.set(this.el.speed, String(Math.round(d.speedKmh)));
    t.set(this.el.hop, 'Hop');
    this.el.hop.classList.remove('go');
    this.bodywork(d.body, d.bodyMax);
    if (this.marks.length !== d.track.length) {
      this.marks = d.track.map((m) => {
        const dot = document.createElement('i');
        dot.style.background = m.color;
        if (m.you) dot.className = 'you';
        return dot;
      });
      this.el.track.replaceChildren(...this.marks);
    }
    d.track.forEach((m, i) => {
      const dot = this.marks[i];
      if (dot) dot.style.left = `${(m.pct * 100).toFixed(1)}%`;
    });
  }

  private bodywork(body: number, max: number): void {
    const key = `${body}/${max}`;
    if (key === this.bodyKey) return;
    this.bodyKey = key;
    this.el.body.replaceChildren(
      ...Array.from({ length: max }, (_, i) => {
        const pip = document.createElement('i');
        pip.className = i < body ? 'pip on' : 'pip';
        return pip;
      }),
    );
    this.el.body.classList.toggle('low', body === 1);
  }
}
