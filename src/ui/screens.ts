import { PAX, PAX_KINDS, type DayEvent, type RouteId, type UpgradeId } from '../rules/data.ts';
import type { ShopKind } from '../rules/progress.ts';
import { byId, esc } from './dom.ts';

export interface RouteCard {
  readonly id: RouteId;
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly blurb: string;
  readonly locked: boolean;
  readonly unlockLevel: number;
  readonly selected: boolean;
}

export interface TitleModel {
  readonly bank: string;
  readonly level: number;
  readonly xpPct: number;
  readonly event: DayEvent;
  readonly routes: readonly RouteCard[];
  readonly best: string | null;
  readonly dailyBonus: string | null;
  readonly autoChange: boolean;
  readonly muted: boolean;
}

export type GarageTab = 'paint' | 'sticker' | 'horn' | 'upgrade';
export interface GarageItem {
  readonly kind: ShopKind | 'upgrade';
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly swatch?: string;
  readonly price: number | null;
  readonly owned: boolean;
  readonly equipped: boolean;
  readonly lockedLevel: number | null;
  readonly affordable: boolean;
}
export interface GarageModel {
  readonly tab: GarageTab;
  readonly bank: string;
  readonly level: number;
  readonly items: readonly GarageItem[];
  readonly message: string;
}

export interface MissionRow {
  readonly text: string;
  readonly progress: number;
  readonly target: number;
  readonly reward: string;
  readonly done: boolean;
}
export interface MissionsModel {
  readonly level: number;
  readonly xpText: string;
  readonly xpPct: number;
  readonly rows: readonly MissionRow[];
  readonly stats: string;
}

export interface OverModel {
  readonly title: string;
  readonly reason: string;
  readonly lines: readonly [string, string][];
  readonly net: string;
  readonly bank: string;
  readonly missions: readonly string[];
  readonly levelUp: string | null;
  readonly best: string | null;
}

export interface ScreenActions {
  start(): void;
  selectRoute(id: RouteId): void;
  open(screen: 'garage' | 'missions' | 'help'): void;
  home(): void;
  toggleAuto(): void;
  toggleSound(): void;
  resume(): void;
  quit(): void;
  again(): void;
  garageTab(tab: GarageTab): void;
  buy(kind: ShopKind, id: string): void;
  equip(kind: ShopKind, id: string): void;
  upgrade(id: UpgradeId): void;
}

type ScreenId = 'title' | 'garage' | 'missions' | 'help' | 'pause' | 'over';

export class Screens {
  private readonly roots: Record<ScreenId, HTMLElement> = {
    title: byId('screen-title'),
    garage: byId('screen-garage'),
    missions: byId('screen-missions'),
    help: byId('screen-help'),
    pause: byId('screen-pause'),
    over: byId('screen-over'),
  };
  current: ScreenId | null = null;

  constructor(actions: ScreenActions) {
    for (const root of Object.values(this.roots)) {
      root.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
        if (!target || !root.contains(target)) return;
        const { action, id, kind, tab } = target.dataset;
        switch (action) {
          case 'start':
            actions.start();
            break;
          case 'route':
            if (id) actions.selectRoute(id as RouteId);
            break;
          case 'open':
            if (id === 'garage' || id === 'missions' || id === 'help') actions.open(id);
            break;
          case 'home':
            actions.home();
            break;
          case 'auto':
            actions.toggleAuto();
            break;
          case 'sound':
            actions.toggleSound();
            break;
          case 'resume':
            actions.resume();
            break;
          case 'quit':
            actions.quit();
            break;
          case 'again':
            actions.again();
            break;
          case 'tab':
            if (tab) actions.garageTab(tab as GarageTab);
            break;
          case 'buy':
            if (kind && id) actions.buy(kind as ShopKind, id);
            break;
          case 'equip':
            if (kind && id) actions.equip(kind as ShopKind, id);
            break;
          case 'upgrade':
            if (id) actions.upgrade(id as UpgradeId);
            break;
          default:
            break;
        }
      });
    }
  }

  hideAll(): void {
    for (const root of Object.values(this.roots)) root.hidden = true;
    this.current = null;
  }

  private show(id: ScreenId, html: string, focus = '[data-focus]'): void {
    this.hideAll();
    const root = this.roots[id];
    root.innerHTML = html;
    root.hidden = false;
    this.current = id;
    root.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  }

  title(m: TitleModel): void {
    const routes = m.routes
      .map(
        (r) => `<button type="button" class="route${r.selected ? ' on' : ''}" data-action="route" data-id="${r.id}" ${r.locked ? 'disabled' : ''} aria-pressed="${r.selected}">
          <span class="route-name">${esc(r.name)}</span>
          <span class="route-path">${esc(r.from)} → ${esc(r.to)}</span>
          <span class="route-blurb">${r.locked ? `Unlocks at level ${r.unlockLevel}` : esc(r.blurb)}</span>
        </button>`,
      )
      .join('');
    this.show(
      'title',
      `<div class="card title-card">
        <div class="title-top"><span class="eyebrow">Lagos danfo simulator</span><span class="wallet">${esc(m.bank)} · Level ${m.level}<i class="xp"><b style="width:${m.xpPct}%"></b></i></span></div>
        <h1>Wole Wole</h1>
        <p class="lede">Load passengers, give correct change, mind the warden, and keep your fare streak alive from morning rush to owambe night.</p>
        <div class="event"><span class="event-tag">Today</span><b>${esc(m.event.name)}</b><span>${esc(m.event.line)}</span></div>
        ${m.dailyBonus ? `<div class="toast">${esc(m.dailyBonus)}</div>` : ''}
        <div class="routes" role="group" aria-label="Choose a route">${routes}</div>
        <div class="row">
          <button type="button" class="cta" data-action="start" data-focus>Start driving</button>
          <button type="button" class="ghost" data-action="open" data-id="garage">Garage</button>
          <button type="button" class="ghost" data-action="open" data-id="missions">Missions</button>
          <button type="button" class="ghost" data-action="open" data-id="help">How to play</button>
        </div>
        <div class="row small">
          <button type="button" class="toggle" data-action="auto" aria-pressed="${m.autoChange}">Conductor gives change: ${m.autoChange ? 'On (no tips)' : 'Off'}</button>
          <button type="button" class="toggle" data-action="sound" aria-pressed="${!m.muted}">Sound: ${m.muted ? 'Off' : 'On'}</button>
          ${m.best ? `<span class="badge">${esc(m.best)}</span>` : ''}
        </div>
      </div>`,
    );
  }

  garage(m: GarageModel): void {
    const tabs: [GarageTab, string][] = [
      ['paint', 'Paint'],
      ['sticker', 'Stickers'],
      ['horn', 'Horns'],
      ['upgrade', 'Upgrades'],
    ];
    const items = m.items
      .map((it) => {
        let button: string;
        if (it.kind === 'upgrade') {
          button = it.price === null ? '<span class="owned">Maxed</span>' : `<button type="button" class="buy" data-action="upgrade" data-id="${it.id}" ${it.affordable ? '' : 'disabled'}>Buy ₦${it.price.toLocaleString('en-NG')}</button>`;
        } else if (it.equipped) button = '<span class="owned">In use</span>';
        else if (it.owned) button = `<button type="button" class="equip" data-action="equip" data-kind="${it.kind}" data-id="${it.id}">Use</button>`;
        else if (it.lockedLevel !== null) button = `<span class="locked">Level ${it.lockedLevel}</span>`;
        else button = `<button type="button" class="buy" data-action="buy" data-kind="${it.kind}" data-id="${it.id}" ${it.affordable ? '' : 'disabled'}>Buy ₦${(it.price ?? 0).toLocaleString('en-NG')}</button>`;
        return `<li class="item">${it.swatch ? `<i class="swatch" style="background:${it.swatch}"></i>` : ''}<span class="item-text"><b>${esc(it.name)}</b><small>${esc(it.detail)}</small></span>${button}</li>`;
      })
      .join('');
    this.show(
      'garage',
      `<div class="panel garage-panel">
        <div class="row between"><h2>Garage</h2><span class="wallet">${esc(m.bank)} · Level ${m.level}</span></div>
        <div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="tab${m.tab === id ? ' on' : ''}" aria-selected="${m.tab === id}" data-action="tab" data-tab="${id}">${label}</button>`).join('')}</div>
        <ul class="items">${items}</ul>
        <p class="message" role="status">${esc(m.message)}</p>
        <button type="button" class="cta" data-action="home" data-focus>Back</button>
      </div>`,
    );
  }

  missions(m: MissionsModel): void {
    const rows = m.rows
      .map(
        (r) => `<li class="mission${r.done ? ' done' : ''}"><span><b>${esc(r.text)}</b><small>Reward ${esc(r.reward)}</small></span>
          <span class="meter"><i style="width:${Math.min(100, Math.round((r.progress / r.target) * 100))}%"></i></span>
          <span class="count">${r.done ? 'Done' : `${Math.min(r.progress, r.target).toLocaleString('en-NG')} / ${r.target.toLocaleString('en-NG')}`}</span></li>`,
      )
      .join('');
    this.show(
      'missions',
      `<div class="card">
        <h2>Missions</h2>
        <div class="levelbar"><b>Level ${m.level}</b><i class="xp wide"><b style="width:${m.xpPct}%"></b></i><span>${esc(m.xpText)}</span></div>
        <ul class="missions">${rows}</ul>
        <p class="fine">Rewards are paid into your bank when the run ends. ${esc(m.stats)}</p>
        <button type="button" class="cta" data-action="home" data-focus>Back</button>
      </div>`,
    );
  }

  help(next: 'home' | 'start' = 'home'): void {
    const pax = PAX_KINDS.map((k) => `<li><i class="dot" style="background:${PAX[k].color}"></i><b>${esc(PAX[k].label)}</b><span>${esc(PAX[k].perk)}</span></li>`).join('');
    this.show(
      'help',
      `<div class="card help">
        <h2>How to drive</h2>
        <ul class="howto">
          <li><b>Lanes</b><span>Swipe, or <kbd>←</kbd> <kbd>→</kbd>. Hop with a swipe up or <kbd>Space</kbd> (clears barriers, not cars).</span></li>
          <li><b>Stops</b><span>Move to the kerb lane, hold BRAKE or <kbd>↓</kbd> in the yellow bay. The bus holds while people move, then drives off. Press GO or <kbd>Space</kbd> to leave early.</span></li>
          <li><b>Change</b><span>Some passengers pay with big notes. Tap ₦50–₦500 (keys <kbd>1</kbd>–<kbd>4</kbd>) to hand back exact change for a tip.</span></li>
          <li><b>Fuel</b><span>Watch the gauge. Stop in a green fuel bay to buy fuel with your earnings. Empty tank ends the run.</span></li>
          <li><b>Warden</b><span>When the warden raises his hand, stop before the white line. Crossing costs ₦500.</span></li>
          <li><b>BRT lane</b><span>The red lane is fast but cameras fine you ₦1,500, and BRT buses come from behind.</span></li>
          <li><b>Streak</b><span>Each clean drop-off raises fares to ×3. Crashes, missed stops, scaring people and warden fines reset it.</span></li>
          <li><b>Horn</b><span>HORN or <kbd>H</kbd> moves okadas and kekes out of your lane and hurries people crossing.</span></li>
        </ul>
        <h3>Who rides your danfo</h3>
        <ul class="pax">${pax}</ul>
        <button type="button" class="cta" data-action="${next}" data-focus>${next === 'start' ? 'Start driving' : 'Got it'}</button>
      </div>`,
    );
  }

  pause(muted: boolean): void {
    this.show(
      'pause',
      `<div class="card narrow">
        <h2>Paused</h2>
        <div class="row">
          <button type="button" class="cta" data-action="resume" data-focus>Keep driving</button>
          <button type="button" class="ghost" data-action="sound">Sound: ${muted ? 'Off' : 'On'}</button>
          <button type="button" class="ghost" data-action="quit">End run</button>
        </div>
      </div>`,
    );
  }

  over(m: OverModel): void {
    this.show(
      'over',
      `<div class="card">
        <span class="eyebrow">${esc(m.reason)}</span>
        <h2>${esc(m.title)}</h2>
        <dl class="ledger">${m.lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}<div class="net"><dt>Take-home</dt><dd>${esc(m.net)}</dd></div></dl>
        ${m.missions.length ? `<ul class="done-list">${m.missions.map((t) => `<li>Mission done: ${esc(t)}</li>`).join('')}</ul>` : ''}
        ${m.levelUp ? `<p class="toast">${esc(m.levelUp)}</p>` : ''}
        <div class="row"><span class="wallet">Bank: ${esc(m.bank)}</span>${m.best ? `<span class="badge">${esc(m.best)}</span>` : ''}</div>
        <div class="row">
          <button type="button" class="cta" data-action="again" data-focus>Drive again</button>
          <button type="button" class="ghost" data-action="open" data-id="garage">Garage</button>
          <button type="button" class="ghost" data-action="home">Home</button>
        </div>
      </div>`,
    );
  }
}
