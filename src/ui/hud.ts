// In-drive overlay: money, place and health, passengers or distance, message cards, countdown and controls.
import type { Card, TutorialStep } from '../game/drive.ts';
import { byId, esc, TextCache } from './dom.ts';

export interface HudState {
  readonly money: string;
  readonly place: string;
  readonly health: number;
  readonly healthMax: number;
  readonly passengers: boolean;
  readonly onboard: number;
  readonly seats: number;
  readonly next: string;
  /** "DISTANCE 2.4 km" or "TO FINISH 1.2 km". */
  readonly distance: string;
  readonly gasHeld: boolean;
  /** Boarding progress 0–1, or null when not stopped. */
  readonly progress: number | null;
  /** Countdown number, or null. */
  readonly count: number | null;
  readonly countText: string;
  readonly step: TutorialStep | null;
  readonly target: string | null;
}

export class Hud {
  private readonly root = byId('hud');
  private readonly el = {
    money: byId('h-money'),
    place: byId('h-place'),
    health: byId('h-health'),
    info: byId('h-info'),
    target: byId('h-target'),
    step: byId('h-step'),
    card: byId('h-card'),
    cardTitle: byId('h-card-title'),
    cardLine: byId('h-card-line'),
    shout: byId('h-shout'),
    pops: byId('h-pops'),
    swipe: byId('h-swipe'),
    count: byId('h-count'),
    countNum: byId('h-count-num'),
    countText: byId('h-count-text'),
    progress: byId('h-progress'),
    progressBar: byId('h-progress-bar'),
    hint: byId('h-hint'),
    gas: byId('b-gas'),
    hurt: byId('hurt'),
  };
  private readonly text = new TextCache();
  private cardT = 0;
  private shoutT = 0;
  private healthKey = '';
  private infoKey = '';
  private lastMoney = '';

  show(on: boolean): void {
    this.root.hidden = !on;
    if (!on) {
      this.el.card.hidden = true;
      this.el.shout.hidden = true;
      this.el.pops.replaceChildren();
      this.cardT = 0;
    }
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  card(card: Card, seconds: number): void {
    this.el.card.hidden = false;
    this.el.card.className = `card ${card.tone}`;
    this.text.set(this.el.cardTitle, card.title);
    this.text.set(this.el.cardLine, card.line);
    // Restart the pop-in animation.
    this.el.card.style.animation = 'none';
    void this.el.card.offsetWidth;
    this.el.card.style.animation = '';
    this.cardT = seconds;
  }

  clearCard(): void {
    this.cardT = 0;
    this.el.card.hidden = true;
  }

  pop(text: string, tone: 'good' | 'bad'): void {
    const el = document.createElement('div');
    el.className = `popup disp ${tone === 'bad' ? 'bad' : ''}`;
    el.textContent = text;
    el.addEventListener('animationend', () => el.remove());
    this.el.pops.append(el);
    while (this.el.pops.children.length > 3) this.el.pops.firstElementChild?.remove();
  }

  /** A conductor's shout or a bus announcement, in a speech bubble. */
  shout(text: string): void {
    this.el.shout.hidden = false;
    this.el.shout.textContent = text;
    this.shoutT = 2.8;
  }

  hurt(): void {
    this.el.hurt.classList.add('on');
    window.setTimeout(() => this.el.hurt.classList.remove('on'), 120);
    this.el.health.classList.remove('hit');
    void this.el.health.offsetWidth;
    this.el.health.classList.add('hit');
  }

  tick(dt: number): void {
    if (this.cardT > 0) {
      this.cardT -= dt;
      if (this.cardT <= 0) this.el.card.hidden = true;
    }
    if (this.shoutT > 0) {
      this.shoutT -= dt;
      if (this.shoutT <= 0) this.el.shout.hidden = true;
    }
  }

  render(s: HudState): void {
    const t = this.text;
    t.set(this.el.money, s.money);
    if (s.money !== this.lastMoney && this.lastMoney !== '') {
      this.el.money.classList.remove('bump');
      void this.el.money.offsetWidth;
      this.el.money.classList.add('bump');
    }
    this.lastMoney = s.money;
    t.set(this.el.place, s.place);
    const hk = `${s.health}/${s.healthMax}`;
    if (hk !== this.healthKey) {
      this.healthKey = hk;
      this.el.health.innerHTML = Array.from({ length: s.healthMax }, (_, i) => `<i class="${i < s.health ? '' : 'lost'}"></i>`).join('');
      this.el.health.setAttribute('aria-label', `Health ${s.health} of ${s.healthMax}`);
    }
    const info = s.passengers
      ? `<div class="bar"><b>Onboard ${s.onboard}<span class="sr"> of ${s.seats}</span></b><span>Next: ${esc(s.next)}</span></div>`
      : `<div class="chip">Passengers off</div><div class="chip">${esc(s.distance)}</div>`;
    if (info !== this.infoKey) {
      this.infoKey = info;
      this.el.info.innerHTML = info;
    }
    this.el.target.hidden = !s.target;
    if (s.target) t.set(this.el.target, s.target);
    this.el.step.hidden = !s.step;
    if (s.step) t.set(this.el.step, `Step ${s.step.n} / ${s.step.of}`);
    this.el.swipe.hidden = !s.step?.swipeHint;
    this.el.count.hidden = s.count === null;
    if (s.count !== null) {
      t.set(this.el.countNum, String(s.count));
      t.set(this.el.countText, s.countText);
    }
    this.el.progress.hidden = s.progress === null;
    if (s.progress !== null) this.el.progressBar.style.width = `${Math.round(s.progress * 100)}%`;
    t.set(this.el.gas, s.gasHeld ? 'Gas held' : 'Gas');
    this.el.hint.style.visibility = s.progress === null ? 'visible' : 'hidden';
  }
}
