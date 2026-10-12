// Menu screens, drawn as HTML over the live scene. Wording and layout follow the West Road Life kit.
import { esc } from './dom.ts';

export interface HomeModel {
  readonly vehicle: string;
  readonly place: string;
  readonly mode: 'route' | 'endless';
  readonly passengers: boolean;
  readonly daily: { readonly label: string; readonly best: string | null } | null;
  readonly challenge: { readonly text: string } | null;
}

export interface SetupModel {
  readonly city: 'london' | 'lagos';
  readonly areas: readonly { readonly id: string; readonly name: string; readonly blurb: string; readonly best: string | null }[];
  readonly area: string;
  readonly mode: 'route' | 'endless';
}

export interface GarageModel {
  readonly city: string;
  readonly bank: string;
  readonly fleet: readonly { readonly id: string; readonly name: string; readonly thumb: string }[];
  readonly selected: string;
  readonly name: string;
  readonly line: string;
  readonly stats: readonly (readonly [string, number])[];
  readonly facts: string;
  readonly inUse: boolean;
}

export interface EndModel {
  readonly complete: boolean;
  readonly amount: string;
}

export interface ResultsModel {
  readonly amount: string;
  readonly rows: readonly (readonly [string, string])[];
  readonly advice: readonly [string, string];
  readonly badge: string | null;
  readonly versus: { readonly text: string; readonly ahead: boolean } | null;
  readonly again: string;
}

export interface ShareModel {
  readonly image: string;
  readonly name: string;
}

export interface SettingsModel {
  readonly music: number;
  readonly sfx: number;
  readonly reducedMotion: boolean;
  readonly graphics: 'auto' | 'high' | 'medium' | 'low';
  readonly inDrive: boolean;
}

const back = (action = 'back'): string => `<div class="topbar"><button type="button" class="pillbtn" data-action="${action}">Back</button><span class="brand disp">West Road Life</span></div>`;
const seg = (action: string, options: readonly (readonly [string, string])[], value: string, label: string): string =>
  `<div class="seg" role="group" aria-label="${esc(label)}">${options.map(([v, t]) => `<button type="button" data-action="${action}" data-value="${esc(v)}" aria-pressed="${v === value}">${esc(t)}</button>`).join('')}</div>`;

export function homeHtml(m: HomeModel): string {
  return `<section class="screen home" aria-label="West Road Life home">
    <h1 class="wordmark"><span class="disp w1">West Road</span><span class="disp w2">Life</span></h1>
    <button type="button" class="place" data-action="setup">${esc(m.place)}</button>
    <div class="extras">
      ${m.challenge ? `<div class="challenge"><p>${esc(m.challenge.text)}</p><button type="button" class="btn small disp" data-action="challenge">Beat it</button></div>` : ''}
      <button type="button" class="lagos-link" data-action="lagos"><span class="disp">Lagos</span><span>Drive a danfo in Wole Wole</span></button>
      ${m.daily && !m.challenge ? `<button type="button" class="daily" data-action="daily"><span><b class="tag disp">Today’s drive</b><br>${esc(m.daily.label)}</span><span class="best">${m.daily.best ? `Best ${esc(m.daily.best)}` : 'Same road for all'}</span></button>` : ''}
    </div>
    <div class="spacer"></div>
    <div class="panel">
      <p class="vehicle-name">${esc(m.vehicle)}</p>
      ${seg('mode', [['route', 'Route'], ['endless', 'Endless']], m.mode, 'Game mode')}
      <button type="button" class="pax" data-action="passengers">Passengers ${m.passengers ? 'on' : 'off'} / change</button>
      <button type="button" class="btn play disp" data-action="play" data-focus>Play</button>
      <div class="links"><button type="button" class="linkbtn" data-action="howto">How to play</button><button type="button" class="linkbtn" data-action="garage">Garage</button><button type="button" class="linkbtn" data-action="settings">Settings</button></div>
    </div>
  </section>`;
}

export function setupHtml(m: SetupModel): string {
  return `<section class="screen" aria-label="Choose your drive">
    ${back()}
    <h1 class="title disp">Your drive</h1>
    <div class="sheet">
      <h2 class="disp">Choose your city</h2>
      ${seg('city', [['london', 'London'], ['lagos', 'Lagos']], m.city, 'City')}
      <h3>Area / route</h3>
      <div class="areas">${m.areas
        .map((a) => `<button type="button" data-action="area" data-value="${esc(a.id)}" aria-pressed="${a.id === m.area}"><span>${esc(a.name)}</span><small>${esc(a.blurb)}${a.best ? ` · Best ${esc(a.best)}` : ''}</small></button>`)
        .join('')}</div>
      <h3>Game mode</h3>
      ${seg('mode', [['route', 'Route'], ['endless', 'Endless']], m.mode, 'Game mode')}
      <p class="muted" style="margin-top:14px">${m.mode === 'route' ? 'A destination to complete.' : 'Keep driving until the damage limit.'}<br>Switch modes whenever you want.</p>
      <p class="muted" style="margin-top:10px;font-size:13px">Lagos opens Wole Wole, the danfo game, with its own routes and progress.</p>
    </div>
    <div class="bottom-actions"><button type="button" class="btn disp" data-action="back" data-focus>Continue</button></div>
  </section>`;
}

export function garageHtml(m: GarageModel): string {
  return `<section class="screen garage" aria-label="Your garage">
    ${back()}
    <h1 class="title disp">Your garage</h1>
    <div class="fleet" role="group" aria-label="${esc(m.city)} fleet">${m.fleet
      .map((v) => `<button type="button" data-action="pick" data-value="${esc(v.id)}" aria-pressed="${v.id === m.selected}" aria-label="${esc(v.name)}"><img src="${v.thumb}" alt=""></button>`)
      .join('')}</div>
    <div class="sheet" style="margin-top:14px">
      <h2 class="disp">${esc(m.name)}</h2>
      <p class="muted" style="text-align:center">${m.inUse ? 'Selected vehicle' : esc(m.line)}</p>
      <div class="stats">${m.stats.map(([k, v]) => `<span>${esc(k)}</span><i><b style="width:${Math.round(v * 100)}%"></b></i>`).join('')}</div>
      <p class="muted" style="margin-top:12px;font-size:14px">${esc(m.facts)}<br>Passenger service is optional. Bank: ${esc(m.bank)}</p>
    </div>
    <div class="bottom-actions">
      <button type="button" class="btn disp" data-action="use" data-focus>${m.inUse ? 'In use' : 'Use vehicle'}</button>
      <p class="swipe-note">Swipe to explore the fleet</p>
    </div>
  </section>`;
}

export function passengersHtml(on: boolean, seats: string): string {
  return `<section class="screen" aria-label="Passengers">
    ${back()}
    <h1 class="title disp">Drive your way</h1>
    <div class="sheet" style="margin-top:56px">
      <h2 class="disp">Pick up passengers?</h2>
      <p class="muted" style="margin:14px 0 26px;font-size:16px">Choose a passenger shift,<br>or just enjoy the drive.<br>You earn money either way.</p>
      ${seg('pax', [['on', 'On'], ['off', 'Off']], on ? 'on' : 'off', 'Passengers')}
      <p class="muted" style="text-align:center;font-size:12px;margin-top:22px;text-transform:uppercase">${esc(seats)}</p>
    </div>
    <div class="bottom-actions"><button type="button" class="btn disp" data-action="play" data-focus>Start driving</button></div>
  </section>`;
}

export function howtoHtml(touch: boolean): string {
  return `<section class="screen" aria-label="How to play">
    ${back()}
    <h1 class="title disp">How to play</h1>
    <div class="sheet">
      <h2 class="disp">Four simple actions</h2>
      <dl class="howto">
        <dt class="disp">Steer</dt><dd class="muted">Swipe left or right to change lane.</dd>
        <dt class="disp">Speed up</dt><dd class="muted">Hold the road or the Gas button. Faster pays more.</dd>
        <dt class="disp">Brake</dt><dd class="muted">Hold Brake to slow down or stop.</dd>
        <dt class="disp">Passengers</dt><dd class="muted">Optional: move into a marked bay and stop. Stop by the shelter for a tip.</dd>
      </dl>
      <p class="keys">${touch ? 'Three hits and the drive is over. Close passes pay a bonus.' : 'Keys: ← → lanes · ↑ or W gas · ↓, S or Space brake · P pause · M sound'}</p>
    </div>
    <div class="bottom-actions"><button type="button" class="btn disp" data-action="practice" data-focus>Try a practice drive</button></div>
  </section>`;
}

export function settingsHtml(m: SettingsModel): string {
  const slider = (id: string, label: string, v: number): string =>
    `<div class="setting"><label for="${id}" class="disp">${label}</label><input type="range" id="${id}" min="0" max="100" step="5" value="${Math.round(v * 100)}" data-input="${id}" style="--fill:${Math.round(v * 100)}%"></div>`;
  return `<section class="screen ${m.inDrive ? 'dim' : ''}" aria-label="Sound and settings">
    ${back()}
    <h1 class="title disp">Sound and settings</h1>
    <div class="sheet">
      <h2 class="disp">Make it yours</h2>
      ${slider('music', 'Music', m.music)}
      ${slider('sfx', 'Sound effects', m.sfx)}
      <div class="row"><span>Reduced motion</span><button type="button" class="toggle" data-action="motion" aria-pressed="${m.reducedMotion}">${m.reducedMotion ? 'On' : 'Off'}</button></div>
      <div class="setting"><span class="disp" style="display:block;margin-bottom:10px">Graphics</span><div class="seg four" role="group" aria-label="Graphics quality">${(
        [
          ['auto', 'Auto'],
          ['high', 'High'],
          ['medium', 'Medium'],
          ['low', 'Low'],
        ] as const
      )
        .map(([v, t]) => `<button type="button" data-action="graphics" data-value="${v}" aria-pressed="${m.graphics === v}">${t}</button>`)
        .join('')}</div></div>
      ${m.inDrive ? '' : '<div class="row"><button type="button" class="linkbtn" style="padding-left:0" data-action="tutorial">Replay tutorial</button></div>'}
    </div>
    <div class="bottom-actions"><button type="button" class="btn disp" data-action="back" data-focus>Done</button></div>
  </section>`;
}

export function pauseHtml(): string {
  return `<section class="screen dim" aria-label="Paused">
    <div class="overlay-card">
      <h2 class="disp">Paused</h2>
      <button type="button" class="btn disp" data-action="resume" data-focus>Resume</button>
      <button type="button" class="btn cream disp" data-action="restart">Restart</button>
      <button type="button" class="btn cream disp" data-action="quit">Home</button>
      <button type="button" class="linkbtn" data-action="settings">Sound settings</button>
    </div>
  </section>`;
}

export function endHtml(m: EndModel): string {
  return `<section class="screen dim-soft" aria-label="${m.complete ? 'Route complete' : 'Drive finished'}">
    <div class="overlay-card">
      <h2 class="disp">${m.complete ? 'Route complete' : 'Drive finished'}</h2>
      <p class="sub">${m.complete ? 'You made it!' : 'Damage limit reached'}</p>
      <p class="big disp">${esc(m.amount)}</p>
      <p class="cap">Money earned</p>
      <button type="button" class="btn disp" data-action="results" data-focus>View results</button>
    </div>
  </section>`;
}

export function resultsHtml(m: ResultsModel): string {
  return `<section class="screen results" aria-label="Your drive">
    ${back('home')}
    <h1 class="title disp">Your drive</h1>
    <div class="sheet">
      <h2 class="disp">Money earned</h2>
      <p class="amount disp">${esc(m.amount)}</p>
      ${m.badge ? `<span class="badge disp">${esc(m.badge)}</span>` : ''}
      ${m.versus ? `<p class="vs ${m.versus.ahead ? '' : 'behind'}">${esc(m.versus.text)}</p>` : ''}
      <dl>${m.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <p class="muted advice">${esc(m.advice[0])}<br>${esc(m.advice[1])}</p>
    </div>
    <div class="bottom-actions">
      <button type="button" class="btn disp" data-action="again" data-focus>${esc(m.again)}</button>
      <div class="links"><button type="button" class="linkbtn" data-action="home">Home</button><button type="button" class="linkbtn" data-action="share">Share result</button></div>
    </div>
  </section>`;
}

export function shareHtml(m: ShareModel): string {
  return `<section class="screen" aria-label="Share your drive">
    ${back('results')}
    <h1 class="title disp">Share your drive</h1>
    <div class="sheet">
      <img class="share-card" src="${m.image}" alt="Your result card" width="540" height="675">
      <label class="namefield">Name on your card<input type="text" maxlength="24" autocomplete="nickname" placeholder="e.g. Ada" value="${esc(m.name)}" data-input="name"></label>
    </div>
    <div class="bottom-actions"><button type="button" class="btn disp" data-action="send" data-focus>Share</button></div>
  </section>`;
}

/** Simple dialog: sharing or saving failed, or loading could not finish. */
export function modalHtml(title: string, lines: readonly string[], actions: readonly (readonly [string, string, boolean])[]): string {
  return `<section class="screen dim" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="overlay-card">
      <h2 class="disp">${esc(title)}</h2>
      <p class="muted">${lines.map(esc).join('<br>')}</p>
      ${actions.map(([action, label, primary], i) => `<button type="button" class="btn ${primary ? '' : 'cream'} disp" data-action="${action}" ${i === 0 ? 'data-focus' : ''}>${esc(label)}</button>`).join('')}
    </div>
  </section>`;
}

/** Mounts one screen at a time and routes its buttons and inputs to the app. */
export class Screens {
  private readonly root: HTMLElement;
  current = '';

  constructor(root: HTMLElement, onAction: (action: string, value: string, el: HTMLElement) => void, onInput: (id: string, value: string, el: HTMLInputElement) => void) {
    this.root = root;
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!el || !root.contains(el)) return;
      onAction(el.dataset.action ?? '', el.dataset.value ?? '', el);
    });
    root.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.input) onInput(el.dataset.input, el.value, el);
    });
  }

  show(id: string, html: string): void {
    this.current = id;
    this.root.innerHTML = html;
    const focus = this.root.querySelector<HTMLElement>('[data-focus]');
    // Keyboard users land on the main action; touch users are not scrolled about.
    if (focus && !document.body.classList.contains('touch')) focus.focus({ preventScroll: true });
  }

  hide(): void {
    this.current = '';
    this.root.innerHTML = '';
  }
}
