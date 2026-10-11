import { PAX, type PaxKind } from '../rules/data.ts';
import { byId, TextCache } from './dom.ts';
import { paxIcon } from './icons.ts';

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
  /** `cue` says how urgent braking is: plenty of room, brake now, or already too fast to stop in the bay. */
  readonly stop: { name: string; dist: string; info: string; hint: string; busy: boolean; here: boolean; cue: 'go' | 'now' | 'late' | null } | null;
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
    coach: byId('h-coach'),
    hurt: byId('hurt'),
  };
  private readonly moneyChip = this.el.cash.closest<HTMLElement>('.chip') ?? this.el.cash;
  private marks: HTMLElement[] = [];
  /** Guide text that stays up, and a one-time tip that times out. */
  private coachText: string | null = null;
  private tipText = '';
  private tipT = 0;
  private lastCash = 0;
  private lastStreak = 0;
  private lastBody = -1;
  private readonly pops: { main: string; sub: string; tone: 'good' | 'bad' | 'gold' }[] = [];
  private popT = 0;
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
      this.lastCash = 0;
      this.lastStreak = 0;
      this.lastBody = -1;
    } else {
      this.queue.length = 0;
      this.pops.length = 0;
      this.el.callout.className = 'callout';
      this.coachText = null;
      this.tipT = 0;
      this.el.coach.hidden = true;
    }
  }

  /** Steady guide text (null clears it). */
  coach(text: string | null): void {
    this.coachText = text;
  }

  /** A short tip that shows for a few seconds unless the guide is talking. */
  tip(text: string, seconds = 5): void {
    this.tipText = text;
    this.tipT = seconds;
  }

  /** Red edge flash when the vehicle takes damage. */
  hurt(): void {
    this.restart(this.el.hurt, 'on');
  }

  /** Replay a one-shot CSS animation. */
  private restart(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
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

  /** Queue a rising message; they show one after another so they never pile up. */
  popup(main: string, sub = '', tone: 'good' | 'bad' | 'gold' = 'good'): void {
    this.pops.push({ main, sub, tone });
    if (this.pops.length > 4) this.pops.shift();
  }

  private showPop({ main, sub, tone }: { main: string; sub: string; tone: 'good' | 'bad' | 'gold' }): void {
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
    this.popT -= dt;
    const pop = this.popT <= 0 ? this.pops.shift() : undefined;
    if (pop) {
      this.showPop(pop);
      this.popT = 0.5;
    }
    this.tipT = Math.max(0, this.tipT - dt);
    const coach = this.coachText ?? (this.tipT > 0 ? this.tipText : null);
    this.el.coach.hidden = !coach;
    if (coach) this.text.set(this.el.coach, coach);
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
    // Money and streak react when they change, so gains and losses register at a glance.
    if (d.cash > this.lastCash + 0.5) this.restart(this.moneyChip, 'gain');
    else if (d.cash < this.lastCash - 0.5) this.restart(this.moneyChip, 'loss');
    this.lastCash = d.cash;
    if (d.streak > this.lastStreak) this.restart(this.el.mult, 'up');
    else if (d.streak < this.lastStreak) this.restart(this.el.mult, 'down');
    this.lastStreak = d.streak;
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
          const icon = document.createElement('i');
          icon.innerHTML = paxIcon(kind);
          icon.title = PAX[kind].label;
          if (PAX[kind].seats > 1) icon.className = 'wide';
          return icon;
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
      this.el.card.classList.toggle('now', d.stop.cue === 'now');
      this.el.card.classList.toggle('late', d.stop.cue === 'late');
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
    if (this.lastBody >= 0 && body < this.lastBody) this.restart(this.el.body, 'hit');
    this.lastBody = body;
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
