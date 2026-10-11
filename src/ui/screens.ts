import { PAX, PAX_KINDS, type DayEvent, type RouteId, type UpgradeId } from '../rules/data.ts';
import type { ShopKind } from '../rules/progress.ts';
import { byId, esc } from './dom.ts';
import { paxIcon } from './icons.ts';

export interface RouteCard {
  readonly id: RouteId;
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly blurb: string;
  readonly difficulty: string;
  readonly locked: boolean;
  readonly unlockLevel: number;
  readonly selected: boolean;
}

/** Small line pictures for the route cards: market stall, lagoon bridge, expressway toll. */
const ROUTE_ICONS: Readonly<Record<RouteId, string>> = {
  ikorodu: '<path d="M3 9h18l-2.5-5h-13z"/><path d="M5 9v11M19 9v11M2 20h20M9 14h6v6H9z"/>',
  mainland: '<path d="M2 15h20M3 15c2.5-6 6-8 9-8s6.5 2 9 8M7 15v-3.5M12 15V7M17 15v-3.5"/><path d="M2 20c2-1.2 4-1.2 6 0s4 1.2 6 0 4-1.2 6 0"/>',
  lekki: '<path d="M8 21 10.5 3M16 21 13.5 3M12 7v2M12 12v2M12 17v2"/><path d="M2 10h7M15 10h7M4 10v4M20 10v4"/>',
};
const routeIcon = (id: RouteId): string =>
  `<svg class="route-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ROUTE_ICONS[id]}</svg>`;

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
  /** Today's shift: route, your best so far, and a friend's challenge if a link brought one. */
  readonly shift: { readonly route: string; readonly date: string; readonly best: string | null };
  readonly challenge: string | null;
}

export type GarageTab = 'car' | 'paint' | 'sticker' | 'horn' | 'upgrade';
export interface GarageItem {
  readonly kind: ShopKind | 'upgrade';
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly swatch?: string;
  /** Rendered picture and stat bars, for cars. */
  readonly thumb?: string;
  readonly stats?: readonly (readonly [string, number])[];
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

export interface RaceCard {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly blurb: string;
  readonly meta: string;
  readonly locked: boolean;
  readonly unlockLevel: number;
  readonly selected: boolean;
}
export interface CarChoice {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly swatch: string;
  readonly thumb: string;
  readonly selected: boolean;
}
export interface RacesModel {
  readonly bank: string;
  readonly level: number;
  readonly races: readonly RaceCard[];
  readonly cars: readonly CarChoice[];
  readonly moreCars: boolean;
}

export interface RaceOverModel {
  readonly title: string;
  readonly reason: string;
  readonly standings: readonly { place: string; name: string; car: string; time: string; you: boolean }[];
  readonly lines: readonly [string, string][];
  readonly net: string;
  readonly bank: string;
  readonly missions: readonly string[];
  readonly levelUp: string | null;
  readonly best: string | null;
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
  /** Take-home, the one number that matters. */
  readonly headline: string;
  /** "6 delivered · 2 missed · 1 crash". */
  readonly summary: string;
  /** Against your best or a friend's challenge. */
  readonly compare: string | null;
  readonly driver: string;
  readonly advice: string;
  readonly lines: readonly [string, string][];
  readonly net: string;
  readonly bank: string;
  readonly missions: readonly string[];
  readonly levelUp: string | null;
  readonly again: string;
  readonly name: string;
}

export interface SharePanelModel {
  readonly image: string;
  readonly whatsapp: string;
  readonly url: string;
}

export interface ScreenActions {
  start(): void;
  daily(): void;
  share(name: string): void;
  copyLink(): void;
  selectRoute(id: RouteId): void;
  open(screen: 'garage' | 'missions' | 'help' | 'race'): void;
  selectRace(id: string): void;
  pickCar(id: string): void;
  startRace(): void;
  preview(id: string): void;
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

type ScreenId = 'title' | 'garage' | 'race' | 'missions' | 'help' | 'pause' | 'over';

export class Screens {
  private readonly roots: Record<ScreenId, HTMLElement> = {
    title: byId('screen-title'),
    garage: byId('screen-garage'),
    race: byId('screen-race'),
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
            if (id === 'garage' || id === 'missions' || id === 'help' || id === 'race') actions.open(id);
            break;
          case 'race':
            if (id) actions.selectRace(id);
            break;
          case 'car':
            if (id) actions.pickCar(id);
            break;
          case 'race-start':
            actions.startRace();
            break;
          case 'preview':
            if (id) actions.preview(id);
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
          case 'daily':
            actions.daily();
            break;
          case 'share':
            actions.share(root.querySelector<HTMLInputElement>('input[data-name]')?.value ?? '');
            break;
          case 'copy':
            actions.copyLink();
            break;
          case 'share-close':
            root.querySelector('.share-panel')?.remove();
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
          <span class="route-head">${routeIcon(r.id)}<span class="route-name">${esc(r.name)}</span></span>
          <span class="route-path">${esc(r.from)} → ${esc(r.to)}</span>
          <span class="route-blurb">${r.locked ? `Unlocks at level ${r.unlockLevel}` : `<span class="level ${r.difficulty.toLowerCase()}">${esc(r.difficulty)}</span> ${esc(r.blurb)}`}</span>
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
        ${m.challenge ? `<div class="challenge"><b>${esc(m.challenge)}</b><button type="button" class="cta" data-action="daily">Take the challenge</button></div>` : ''}
        <button type="button" class="shift" data-action="daily">
          <span class="shift-tag">Daily shift · ${esc(m.shift.date)}</span>
          <b>${esc(m.shift.route)}</b>
          <span>${m.shift.best ? `Your best today: ${esc(m.shift.best)} · play again` : 'Same road for everyone today. Set a score and challenge friends.'}</span>
        </button>
        ${m.dailyBonus ? `<div class="toast">${esc(m.dailyBonus)}</div>` : ''}
        <div class="routes" role="group" aria-label="Choose a route">${routes}</div>
        <div class="row">
          <button type="button" class="cta" data-action="start" data-focus>Start driving</button>
          <button type="button" class="ghost" data-action="open" data-id="race">Race</button>
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
      ['car', 'Cars'],
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
        // Tapping a car's row shows it on the garage floor.
        const preview = it.kind === 'car' ? ` data-action="preview" data-id="${it.id}"` : '';
        const picture = it.thumb ? `<img class="thumb" src="${it.thumb}" alt="" width="96" height="56">` : it.swatch ? `<i class="swatch" style="background:${it.swatch}"></i>` : '';
        const stats = it.stats ? `<span class="stats">${it.stats.map(([label, v]) => `<span>${esc(label)}</span><i><b style="width:${Math.round(Math.min(1, v) * 100)}%"></b></i>`).join('')}</span>` : '';
        return `<li class="item${preview ? ' pickable' : ''}"${preview}>${picture}<span class="item-text"><b>${esc(it.name)}</b><small>${esc(it.detail)}</small>${stats}</span>${button}</li>`;
      })
      .join('');
    this.show(
      'garage',
      `<div class="panel garage-panel sheet">
        <div class="sheet-head">
          <div class="row between"><h2>Garage</h2><span class="wallet">${esc(m.bank)} · Level ${m.level}</span></div>
          <div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="tab${m.tab === id ? ' on' : ''}" aria-selected="${m.tab === id}" data-action="tab" data-tab="${id}">${label}</button>`).join('')}</div>
        </div>
        <ul class="items scroll">${items}</ul>
        <div class="actions"><p class="message" role="status">${esc(m.message)}</p><button type="button" class="cta" data-action="home" data-focus>Back</button></div>
      </div>`,
    );
  }

  races(m: RacesModel): void {
    const races = m.races
      .map(
        (r) => `<button type="button" class="route${r.selected ? ' on' : ''}" data-action="race" data-id="${r.id}" ${r.locked ? 'disabled' : ''} aria-pressed="${r.selected}">
          <span class="route-name">${esc(r.name)}</span>
          <span class="route-path">${esc(r.path)}</span>
          <span class="route-blurb">${r.locked ? `Unlocks at level ${r.unlockLevel}` : esc(r.blurb)}</span>
          ${r.locked ? '' : `<span class="route-meta">${esc(r.meta)}</span>`}
        </button>`,
      )
      .join('');
    const cars = m.cars
      .map(
        (c) => `<button type="button" class="carpick${c.selected ? ' on' : ''}" data-action="car" data-id="${c.id}" aria-pressed="${c.selected}">
          ${c.thumb ? `<img class="thumb" src="${c.thumb}" alt="" width="96" height="56">` : `<i class="swatch" style="background:${c.swatch}"></i>`}<span class="item-text"><b>${esc(c.name)}</b><small>${esc(c.detail)}</small></span>
        </button>`,
      )
      .join('');
    this.show(
      'race',
      `<div class="card wide sheet">
        <div class="sheet-head">
          <div class="title-top"><span class="eyebrow">Street racing</span><span class="wallet">${esc(m.bank)} · Level ${m.level}</span></div>
          <h2>Race</h2>
        </div>
        <div class="scroll">
          <p class="lede">Beat four drivers to the finish through normal Lagos traffic. The top three win prize money.</p>
          <div class="routes" role="group" aria-label="Choose a race">${races}</div>
          <h3>Your car</h3>
          <div class="carpicks" role="group" aria-label="Choose your car">${cars}</div>
          ${m.moreCars ? '<p class="fine">Buy saloons, SUVs, luxury, electric and exotic cars in the Garage.</p>' : '<p class="fine">Every car is free to race for now. Pick one and go.</p>'}
        </div>
        <div class="actions row">
          <button type="button" class="cta" data-action="race-start" data-focus>Start race</button>
          <button type="button" class="ghost" data-action="open" data-id="garage">Garage</button>
          <button type="button" class="ghost" data-action="home">Back</button>
        </div>
      </div>`,
    );
  }

  raceOver(m: RaceOverModel): void {
    const rows = m.standings
      .map((r) => `<li${r.you ? ' class="you"' : ''}><b>${esc(r.place)}</b><span>${esc(r.name)}<small>${esc(r.car)}</small></span><span class="count">${esc(r.time)}</span></li>`)
      .join('');
    this.show(
      'over',
      `<div class="card">
        <span class="eyebrow">${esc(m.reason)}</span>
        <h2>${esc(m.title)}</h2>
        <ol class="standings">${rows}</ol>
        <dl class="ledger">${m.lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}<div class="net"><dt>Take-home</dt><dd>${esc(m.net)}</dd></div></dl>
        ${m.missions.length ? `<ul class="done-list">${m.missions.map((t) => `<li>Mission done: ${esc(t)}</li>`).join('')}</ul>` : ''}
        ${m.levelUp ? `<p class="toast">${esc(m.levelUp)}</p>` : ''}
        <div class="row"><span class="wallet">Bank: ${esc(m.bank)}</span>${m.best ? `<span class="badge">${esc(m.best)}</span>` : ''}</div>
        <div class="row">
          <button type="button" class="cta" data-action="again" data-focus>Race again</button>
          <button type="button" class="ghost" data-action="open" data-id="race">Races</button>
          <button type="button" class="ghost" data-action="open" data-id="garage">Garage</button>
          <button type="button" class="ghost" data-action="home">Home</button>
        </div>
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
    const pax = PAX_KINDS.map((k) => `<li><i class="paxicon">${paxIcon(k, 20)}</i><b>${esc(PAX[k].label)}</b><span>${esc(PAX[k].perk)}</span></li>`).join('');
    this.show(
      'help',
      `<div class="card help sheet">
        <h2>How to drive</h2>
        <div class="scroll">
        <h3>The basics</h3>
        <ul class="howto">
          <li><b>Lanes</b><span>Swipe, or <kbd>←</kbd> <kbd>→</kbd>. Hop with a swipe up or <kbd>Space</kbd> (clears barriers, not cars).</span></li>
          <li><b>Stops</b><span>Move right to the kerb lane, then hold BRAKE or <kbd>↓</kbd> so you stop in the yellow bay. Passengers get off and on, then the bus drives off.</span></li>
          <li><b>Speed</b><span>Hold GAS or <kbd>↑</kbd> to go faster, up to 130 km/h. Let go and the bus eases back. Faster burns more fuel and makes bays harder to hit.</span></li>
        </ul>
        <h3>As you go</h3>
        <ul class="howto">
          <li><b>Change</b><span>Some passengers pay with big notes. Tap ₦50–₦500 (keys <kbd>1</kbd>–<kbd>4</kbd>) to hand back exact change for a tip.</span></li>
          <li><b>Fuel</b><span>Watch the gauge. Stop in a green fuel bay to buy fuel with your earnings. Empty tank ends the run.</span></li>
          <li><b>Warden</b><span>When the warden raises his hand, stop before the white line. Crossing costs ₦500.</span></li>
          <li><b>BRT lane</b><span>The red lane is fast but cameras fine you ₦1,500, and BRT buses come from behind.</span></li>
          <li><b>Streak</b><span>Each clean drop-off raises fares to ×3. Crashes, missed stops, scaring people and warden fines reset it.</span></li>
          <li><b>Horn</b><span>HORN or <kbd>H</kbd> moves okadas and kekes out of your lane and hurries people crossing.</span></li>
          <li><b>Rivals</b><span>Sometimes another danfo races you to the next stop. Park in the bay first to keep the passengers and earn ₦300; if it loads first, it carries them off.</span></li>
          <li><b>Racing</b><span>Press Race on the home screen, pick a race and a car. Hold GAS or <kbd>↑</kbd> for full speed. Bumping other racers slows you both; hitting traffic costs bodywork. The top three win prize money.</span></li>
        </ul>
        <h3>Who rides your danfo</h3>
        <ul class="pax">${pax}</ul>
        </div>
        <div class="actions"><button type="button" class="cta" data-action="${next}" data-focus>${next === 'start' ? 'Start driving' : 'Got it'}</button></div>
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
      `<div class="card sheet result">
        <div class="sheet-head"><span class="eyebrow">${esc(m.reason)}</span><h2>${esc(m.title)}</h2></div>
        <div class="scroll">
          <div class="hero"><span class="lbl">Take-home</span><b>${esc(m.headline)}</b><span class="driver">“${esc(m.driver)}”</span></div>
          <p class="summary">${esc(m.summary)}</p>
          ${m.compare ? `<p class="toast">${esc(m.compare)}</p>` : ''}
          <p class="advice"><b>Next time:</b> ${esc(m.advice)}</p>
          ${m.missions.length ? `<ul class="done-list">${m.missions.map((t) => `<li>Mission done: ${esc(t)}</li>`).join('')}</ul>` : ''}
          ${m.levelUp ? `<p class="toast">${esc(m.levelUp)}</p>` : ''}
          <details class="breakdown"><summary>Money breakdown</summary>
            <dl class="ledger">${m.lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}<div class="net"><dt>Take-home</dt><dd>${esc(m.net)}</dd></div></dl>
          </details>
          <div class="row"><span class="wallet">Bank: ${esc(m.bank)}</span></div>
          <label class="namefield">Name on your share card <input type="text" data-name maxlength="24" autocomplete="nickname" placeholder="e.g. Ada" value="${esc(m.name)}"></label>
        </div>
        <div class="actions row">
          <button type="button" class="cta" data-action="again" data-focus>${esc(m.again)}</button>
          <button type="button" class="ghost share-btn" data-action="share">Share</button>
          <button type="button" class="ghost" data-action="open" data-id="garage">Garage</button>
          <button type="button" class="ghost" data-action="home">Home</button>
        </div>
      </div>`,
    );
  }

  /** Fallback share options when the browser has no share sheet. */
  sharePanel(m: SharePanelModel): void {
    const root = this.roots.over;
    root.querySelector('.share-panel')?.remove();
    const panel = document.createElement('div');
    panel.className = 'share-panel';
    panel.innerHTML = `<div class="panel">
        <h3>Share your shift</h3>
        <img src="${m.image}" alt="Your share card" width="270" height="338">
        <div class="row">
          <a class="cta" href="${esc(m.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>
          <button type="button" class="ghost" data-action="copy">Copy link</button>
          <a class="ghost" href="${m.image}" download="wole-wole.png">Save image</a>
        </div>
        <p class="message" role="status"></p>
        <button type="button" class="ghost" data-action="share-close">Close</button>
      </div>`;
    root.appendChild(panel);
    panel.querySelector<HTMLElement>('.cta')?.focus({ preventScroll: true });
  }

  /** Short status line inside the share panel, e.g. "Link copied". */
  shareStatus(text: string): void {
    const el = this.roots.over.querySelector('.share-panel .message');
    if (el) el.textContent = text;
  }
}
