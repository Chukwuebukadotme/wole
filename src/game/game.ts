import * as THREE from 'three';
import { SoundBoard } from '../audio.ts';
import { makeBrtCamera, makeJunction, makeStation, makeStop, makeToll, plateMaterial, type JunctionVisual, type TollVisual } from '../engine/features.ts';
import { makeDanfo, makeFigure, type DanfoModel, type FigureKind } from '../engine/models.ts';
import { Stage } from '../engine/stage.ts';
import { Tiles, type TileContext } from '../engine/tiles.ts';
import {
  CALLS,
  HORNS,
  KERB,
  KERB_X,
  LANES,
  LINES,
  OWA,
  PAINTS,
  PAX,
  PAX_KINDS,
  ROUTES,
  STICKERS,
  TUNING,
  UPGRADES,
  laneX,
  type DayEvent,
  type MissionEvent,
  type PaxKind,
  type RouteDef,
  type RouteId,
  type StretchKind,
  type UpgradeId,
} from '../rules/data.ts';
import { eventFor, isHarmattanSeason, previousDayKey, watDayKey } from '../rules/daily.ts';
import { changeTip, checkChange, fareFor, paymentFor, streakBonus, streakMult } from '../rules/fare.ts';
import { applyEvent, claim, fillMissions, missionDone, missionText, startRun as startRunMissions } from '../rules/missions.ts';
import {
  bodyMax,
  brakeFactor,
  buyItem,
  buyUpgrade,
  equipItem,
  levelInfo,
  parseSave,
  recordDaily,
  seatCount,
  tankSize,
  unlockedRoutes,
  upgradePrice,
  type MissionState,
  type SaveData,
  type ShopKind,
} from '../rules/progress.ts';
import { getRoute, placements, stopSerial, stretchAt } from '../rules/route.ts';
import { clamp, clockText, lerp, metres, mod, money, pick, rand, weighted } from '../rules/util.ts';
import { ChangePanel } from '../ui/change.ts';
import { Hud, type AlertTone } from '../ui/hud.ts';
import { Screens, type GarageItem, type GarageTab, type OverModel } from '../ui/screens.ts';
import { Traffic, type Hazard, type TrafficEnv, type Vehicle, type Walker } from './traffic.ts';

const BUS = { w: 2.3, l: 5.6 } as const;
const SAVE_KEY = 'wolewole.save.v2';
const AHEAD = 900;
const BEHIND = 70;

type Mode = 'loading' | 'title' | 'garage' | 'play' | 'paused' | 'ending' | 'over';
type EndReason = 'crash' | 'fuel' | 'quit';

interface Rider {
  readonly kind: PaxKind;
  readonly fromD: number;
  readonly destSerial: number;
  readonly destD: number;
  readonly destName: string;
  readonly deadline: number;
  smooth: boolean;
}
interface Waiting {
  readonly kind: PaxKind;
  readonly mesh: THREE.Group;
}
interface Mover {
  readonly mesh: THREE.Group;
  readonly kind: FigureKind;
  t: number;
  readonly board: boolean;
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  readonly dir: number;
}
interface StopEnt {
  readonly key: string;
  readonly serial: number;
  readonly name: string;
  readonly at: number;
  readonly vis: { group: THREE.Group; plate: THREE.Mesh };
  readonly waiting: Waiting[];
  readonly movers: Mover[];
  dropped: number;
  boarded: number;
  called: boolean;
  left: boolean;
  done: boolean;
}
interface StationEnt {
  readonly key: string;
  readonly at: number;
  readonly group: THREE.Group;
  pumped: number;
  left: boolean;
  done: boolean;
}
interface JunctionEnt {
  readonly key: string;
  readonly at: number;
  readonly vis: JunctionVisual;
  phase: 'go' | 'stop';
  timer: number;
  active: boolean;
  crossT: number;
  crossDir: 1 | -1;
  waited: boolean;
  resolved: boolean;
}
interface TollEnt {
  readonly key: string;
  readonly at: number;
  readonly vis: TollVisual;
  open: number;
  paid: boolean;
  resolved: boolean;
}
interface CameraEnt {
  readonly key: string;
  readonly at: number;
  readonly group: THREE.Group;
  resolved: boolean;
}
interface ChangeTask {
  readonly who: string;
  readonly fare: number;
  readonly paid: number;
  readonly due: number;
}

interface Run {
  t: number;
  hour: number;
  braking: boolean;
  gas: boolean;
  parked: { kind: 'stop' | 'station'; key: string; leaveT: number } | null;
  body: number;
  readonly bodyMax: number;
  invuln: number;
  fuel: number;
  readonly tank: number;
  readonly seats: number;
  readonly brakeFactor: number;
  fuelWarned: boolean;
  emptyT: number;
  cash: number;
  fares: number;
  tips: number;
  notes: number;
  fuelSpent: number;
  fines: number;
  tolls: number;
  streak: number;
  shieldUsed: boolean;
  complaints: number;
  riders: Rider[];
  delivered: number;
  served: number;
  correctChange: number;
  changeQueue: ChangeTask[];
  changeGiven: number[];
  changeT: number;
  loadT: number;
  rain: number;
  rainTarget: number;
  haze: number;
  nextRainAt: number;
  rainUntil: number;
  cleanMetres: number;
  nightAcc: number;
  potholeT: number;
  brtT: number;
  darkAnnounced: boolean;
  bridgeFrom: number | null;
  readonly missionsDone: MissionState[];
  endReason: EndReason;
  endT: number;
  readonly startDist: number;
}

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export class Game {
  private readonly stage: Stage;
  private readonly tiles: Tiles;
  private readonly traffic: Traffic;
  private readonly bus: DanfoModel;
  private readonly sound = new SoundBoard();
  private readonly hud = new Hud();
  private readonly change: ChangePanel;
  private readonly screens: Screens;
  private save: SaveData;
  private mode: Mode = 'loading';
  private readonly event: DayEvent;
  private route: RouteDef;
  private runStart = 0;
  private dist = 0;
  private speed = 8;
  private lane = 1;
  private x = laneX(1);
  private y = 0;
  private vy = 0;
  private air = false;
  private shake = 0;
  private run: Run | null = null;
  private garageTab: GarageTab = 'paint';
  private garageMsg = '';
  private dailyText: string | null = null;
  private lastT = 0;
  private camX = 0;
  private orbit = 0;
  private readonly stops = new Map<string, StopEnt>();
  private readonly stations = new Map<string, StationEnt>();
  private readonly junctions = new Map<string, JunctionEnt>();
  private readonly tolls = new Map<string, TollEnt>();
  private readonly cameras = new Map<string, CameraEnt>();
  private readonly stopPool: { group: THREE.Group; plate: THREE.Mesh }[] = [];
  private readonly stationPool: THREE.Group[] = [];
  private readonly junctionPool: JunctionVisual[] = [];
  private readonly tollPool: TollVisual[] = [];
  private readonly cameraPool: THREE.Group[] = [];
  private readonly figurePool = new Map<FigureKind, THREE.Group[]>();
  private readonly reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(host: HTMLElement) {
    this.stage = new Stage(host);
    this.tiles = new Tiles(this.stage.scene);
    this.traffic = new Traffic(this.stage.scene);
    this.save = this.loadSave();
    this.event = eventFor(new Date());
    this.route = this.routeFromSave();
    this.sound.setMuted(this.save.settings.muted);
    this.sound.horn = this.save.equip.horn;
    const paint = PAINTS.find((p) => p.id === this.save.equip.paint) ?? PAINTS[0];
    const sticker = STICKERS.find((s) => s.id === this.save.equip.sticker) ?? STICKERS[0];
    if (!paint || !sticker) throw new Error('Garage catalogue is empty');
    this.bus = makeDanfo(paint, sticker.text, true);
    this.bus.group.add(this.stage.busLight, this.stage.busLight.target);
    this.stage.scene.add(this.bus.group);

    this.change = new ChangePanel((v) => this.giveChange(v), () => this.undoChange());
    this.screens = new Screens({
      start: () => this.startRun(),
      selectRoute: (id) => this.selectRoute(id),
      open: (screen) => (screen === 'garage' ? this.openGarage() : screen === 'missions' ? this.openMissions() : this.screens.help()),
      home: () => this.showTitle(),
      toggleAuto: () => {
        this.save.settings.autoChange = !this.save.settings.autoChange;
        this.persist();
        this.showTitle();
      },
      toggleSound: () => this.toggleMute(),
      resume: () => this.resume(),
      quit: () => this.endRun('quit'),
      again: () => this.startRun(),
      garageTab: (tab) => {
        this.garageTab = tab;
        this.garageMsg = '';
        this.screens.garage(this.garageModel());
      },
      buy: (kind, id) => this.buy(kind, id),
      equip: (kind, id) => this.equip(kind, id),
      upgrade: (id) => this.upgrade(id),
    });

    const today = watDayKey(new Date());
    const daily = recordDaily(this.save, today, previousDayKey(today));
    if (daily.bonus > 0) this.dailyText = `Daily bonus: ${money(daily.bonus)} for ${daily.streak} day${daily.streak === 1 ? '' : 's'} in a row`;
    fillMissions(this.save.missions, levelInfo(this.save.xp).level, Math.random);
    this.persist();

    this.tiles.reset(this.dist, this.tileCtx());
    this.traffic.reset(this.dist);
    this.stage.resize();
    window.addEventListener('resize', () => this.stage.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.stage.resize()).observe(host);
  }

  get view(): HTMLCanvasElement {
    return this.stage.renderer.domElement;
  }

  // ---------- Save ----------
  private loadSave(): SaveData {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return parseSave(raw ? JSON.parse(raw) : null);
    } catch {
      return parseSave(null);
    }
  }

  private persist(): void {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      // Storage can be unavailable (private windows); progress then lasts for this visit only.
    }
  }

  private level(): number {
    return levelInfo(this.save.xp).level;
  }

  private routeFromSave(): RouteDef {
    const allowed = unlockedRoutes(this.level());
    return getRoute(allowed.includes(this.save.route) ? this.save.route : 'ikorodu');
  }

  private tileCtx(): TileContext {
    return { route: this.route, runStart: this.runStart, festive: this.event.festive };
  }

  // ---------- Screens ----------
  start(): void {
    const loading = document.getElementById('loading');
    if (loading) loading.hidden = true;
    this.showTitle();
    requestAnimationFrame((t) => {
      this.lastT = t;
      this.frame(t);
    });
  }

  private showTitle(): void {
    this.mode = 'title';
    this.run = null;
    this.hud.show(false);
    this.change.hide();
    const lv = levelInfo(this.save.xp);
    const unlocked = unlockedRoutes(lv.level);
    this.screens.title({
      bank: money(this.save.bank),
      level: lv.level,
      xpPct: Math.round((lv.into / lv.need) * 100),
      event: this.event,
      routes: ROUTES.map((r) => ({ id: r.id, name: r.name, from: r.from, to: r.to, blurb: r.blurb, locked: !unlocked.includes(r.id), unlockLevel: r.unlockLevel, selected: r.id === this.route.id })),
      best: this.save.best.cash > 0 ? `Best run ${money(this.save.best.cash)}` : null,
      dailyBonus: this.dailyText,
      autoChange: this.save.settings.autoChange,
      muted: this.save.settings.muted,
    });
    this.dailyText = null;
  }

  private selectRoute(id: RouteId): void {
    if (!unlockedRoutes(this.level()).includes(id)) return;
    this.save.route = id;
    this.persist();
    if (this.route.id !== id) {
      this.route = getRoute(id);
      this.resetWorld(this.dist);
    }
    this.showTitle();
  }

  private openMissions(): void {
    const lv = levelInfo(this.save.xp);
    this.screens.missions({
      level: lv.level,
      xpText: `${lv.into} / ${lv.need} XP`,
      xpPct: Math.round((lv.into / lv.need) * 100),
      rows: this.save.missions.map((m) => ({ text: missionText(m), progress: m.progress, target: m.target, reward: `${money(m.reward)} + ${m.xp} XP`, done: missionDone(m) })),
      stats: `Lifetime: ${this.save.stats.delivered} passengers, ${metres(this.save.stats.metres)} driven, ${this.save.stats.runs} runs.`,
    });
  }

  private openGarage(): void {
    this.mode = 'garage';
    this.hud.show(false);
    this.change.hide();
    this.speed = 0;
    this.garageMsg = '';
    this.screens.garage(this.garageModel());
  }

  private garageModel(): {
    tab: GarageTab;
    bank: string;
    level: number;
    items: GarageItem[];
    message: string;
  } {
    const level = this.level();
    const bank = this.save.bank;
    const s = this.save;
    let items: GarageItem[];
    if (this.garageTab === 'paint')
      items = PAINTS.map((p) => ({ kind: 'paint', id: p.id, name: p.name, detail: p.price ? `₦${p.price.toLocaleString('en-NG')}` : 'Free', swatch: `linear-gradient(90deg, ${hex(p.body)} 70%, ${hex(p.stripe)} 70%)`, price: p.price, owned: s.owned.paint.includes(p.id), equipped: s.equip.paint === p.id, lockedLevel: level < p.level ? p.level : null, affordable: bank >= p.price }));
    else if (this.garageTab === 'sticker')
      items = STICKERS.map((st) => ({ kind: 'sticker', id: st.id, name: st.text, detail: 'Rear window sticker', price: st.price, owned: s.owned.sticker.includes(st.id), equipped: s.equip.sticker === st.id, lockedLevel: level < st.level ? st.level : null, affordable: bank >= st.price }));
    else if (this.garageTab === 'horn')
      items = HORNS.map((h) => ({ kind: 'horn', id: h.id, name: h.name, detail: 'Tap Use to hear it', price: h.price, owned: s.owned.horn.includes(h.id), equipped: s.equip.horn === h.id, lockedLevel: level < h.level ? h.level : null, affordable: bank >= h.price }));
    else
      items = UPGRADES.map((u) => {
        const price = upgradePrice(s, u.id);
        return { kind: 'upgrade', id: u.id, name: u.name, detail: `${u.effect} · level ${s.upgrades[u.id]}/${u.prices.length}`, price, owned: false, equipped: false, lockedLevel: null, affordable: price !== null && bank >= price };
      });
    return { tab: this.garageTab, bank: money(bank), level, items, message: this.garageMsg };
  }

  private buy(kind: ShopKind, id: string): void {
    this.sound.unlock();
    const result = buyItem(this.save, kind, id);
    if (result.ok) {
      equipItem(this.save, kind, id);
      this.applyLook();
      this.sound.fare();
      this.garageMsg = 'Bought and fitted.';
      this.persist();
    } else this.garageMsg = result.reason === 'money' ? 'Not enough money in the bank yet.' : result.reason === 'level' ? 'Reach a higher level first.' : '';
    this.screens.garage(this.garageModel());
  }

  private equip(kind: ShopKind, id: string): void {
    this.sound.unlock();
    if (equipItem(this.save, kind, id)) {
      this.applyLook();
      if (kind === 'horn') this.sound.previewHorn(this.save.equip.horn);
      this.garageMsg = 'Fitted.';
      this.persist();
    }
    this.screens.garage(this.garageModel());
  }

  private upgrade(id: UpgradeId): void {
    this.sound.unlock();
    const result = buyUpgrade(this.save, id);
    this.garageMsg = result.ok ? 'Upgrade fitted.' : result.reason === 'money' ? 'Not enough money in the bank yet.' : 'Already at the top level.';
    if (result.ok) {
      this.sound.fare();
      this.persist();
    }
    this.screens.garage(this.garageModel());
  }

  private applyLook(): void {
    const paint = PAINTS.find((p) => p.id === this.save.equip.paint);
    const sticker = STICKERS.find((s) => s.id === this.save.equip.sticker);
    if (paint) this.bus.setPaint(paint);
    if (sticker) this.bus.setSticker(sticker.text);
    this.sound.horn = this.save.equip.horn;
  }

  private toggleMute(): void {
    this.save.settings.muted = !this.save.settings.muted;
    this.sound.setMuted(this.save.settings.muted);
    const btn = document.getElementById('b-mute');
    if (btn) {
      btn.textContent = this.save.settings.muted ? 'Muted' : 'Sound';
      btn.setAttribute('aria-label', this.save.settings.muted ? 'Turn sound on' : 'Turn sound off');
    }
    this.persist();
    if (this.screens.current === 'title') this.showTitle();
    else if (this.screens.current === 'pause') this.screens.pause(this.save.settings.muted);
  }

  // ---------- World reset ----------
  private resetWorld(at: number): void {
    for (const s of this.stops.values()) this.releaseStop(s);
    for (const s of this.stations.values()) this.releaseStation(s);
    for (const j of this.junctions.values()) this.releaseJunction(j);
    for (const t of this.tolls.values()) this.releaseToll(t);
    for (const c of this.cameras.values()) this.releaseCamera(c);
    this.stops.clear();
    this.stations.clear();
    this.junctions.clear();
    this.tolls.clear();
    this.cameras.clear();
    this.runStart = at;
    this.traffic.reset(at);
    this.tiles.reset(at, this.tileCtx());
  }

  // ---------- Run lifecycle ----------
  private startRun(): void {
    this.sound.unlock();
    if (!this.save.seenHelp) {
      this.save.seenHelp = true;
      this.persist();
      this.screens.help('start');
      return;
    }
    this.screens.hideAll();
    this.route = this.routeFromSave();
    this.resetWorld(this.dist);
    const level = this.level();
    fillMissions(this.save.missions, level, Math.random);
    startRunMissions(this.save.missions);
    const haze = this.event.weather === 'harmattan' ? 0.85 : isHarmattanSeason(new Date()) ? 0.55 : 0;
    const rainy = this.event.weather === 'rainy';
    this.run = {
      t: 0,
      hour: this.event.startHour,
      braking: false,
      gas: false,
      parked: null,
      body: bodyMax(this.save),
      bodyMax: bodyMax(this.save),
      invuln: 0,
      fuel: tankSize(this.save),
      tank: tankSize(this.save),
      seats: seatCount(this.save),
      brakeFactor: brakeFactor(this.save),
      fuelWarned: false,
      emptyT: 0,
      cash: 0,
      fares: 0,
      tips: 0,
      notes: 0,
      fuelSpent: 0,
      fines: 0,
      tolls: 0,
      streak: 0,
      shieldUsed: false,
      complaints: 0,
      riders: [],
      delivered: 0,
      served: 0,
      correctChange: 0,
      changeQueue: [],
      changeGiven: [],
      changeT: TUNING.changeSeconds,
      loadT: 0.2,
      rain: rainy ? 0.7 : 0,
      rainTarget: rainy ? 0.7 : 0,
      haze,
      nextRainAt: rainy ? rand(40, 70) : Math.random() < 0.3 ? rand(70, 200) : Number.POSITIVE_INFINITY,
      rainUntil: rainy ? rand(60, 100) : 0,
      cleanMetres: 0,
      nightAcc: 0,
      potholeT: 0,
      brtT: 0,
      darkAnnounced: false,
      bridgeFrom: null,
      missionsDone: [],
      endReason: 'quit',
      endT: 0,
      startDist: this.dist,
    };
    this.speed = Math.max(this.speed, 8);
    this.lane = 1;
    this.air = false;
    this.y = 0;
    this.mode = 'play';
    this.hud.show(true);
    this.view.focus({ preventScroll: true });
  }

  private pause(): void {
    if (this.mode !== 'play') return;
    this.mode = 'paused';
    this.setBrake(false);
    this.setGas(false);
    this.sound.hornOff();
    this.screens.pause(this.save.settings.muted);
  }

  private resume(): void {
    if (this.mode !== 'paused') return;
    this.screens.hideAll();
    this.mode = 'play';
    this.lastT = performance.now();
    this.view.focus({ preventScroll: true });
  }

  private endRun(reason: EndReason): void {
    const r = this.run;
    if (!r || (this.mode !== 'play' && this.mode !== 'paused')) return;
    r.endReason = reason;
    r.endT = 0;
    r.parked = null;
    this.setBrake(false);
    this.setGas(false);
    this.sound.hornOff();
    this.change.hide();
    this.screens.hideAll();
    this.mode = 'ending';
    if (reason === 'quit') this.finishRun();
  }

  private finishRun(): void {
    const r = this.run;
    if (!r) return;
    this.mode = 'over';
    this.hud.show(false);
    this.change.hide();
    this.sound.setRain(0);
    const s = this.save;
    const driven = this.dist - r.startDist;
    const before = levelInfo(s.xp).level;
    this.emit('earnRun', r.cash);
    s.bank = Math.max(0, s.bank + r.cash);
    const rewards = claim(s.missions, before, Math.random);
    s.bank += rewards.bank;
    const runXp = Math.round(r.delivered * 6 + driven / 100 + r.correctChange * 4 + r.served * 2);
    s.xp += runXp + rewards.xp;
    const after = levelInfo(s.xp).level;
    fillMissions(s.missions, after, Math.random);
    const newBest = r.cash > s.best.cash;
    s.best = { cash: Math.max(s.best.cash, r.cash), dist: Math.max(s.best.dist, driven) };
    s.stats.runs += 1;
    s.stats.delivered += r.delivered;
    s.stats.metres += driven;
    this.persist();

    const unlocked = ROUTES.filter((rt) => rt.unlockLevel > before && rt.unlockLevel <= after).map((rt) => rt.name);
    const reasons: Record<EndReason, [string, string]> = {
      crash: ['Bodywork finished', 'Too many crashes'],
      fuel: ['Fuel finish!', 'The tank ran dry'],
      quit: ['Run ended', 'You parked for the day'],
    };
    const [title, reason] = reasons[r.endReason];
    const model: OverModel = {
      title,
      reason: `${reason} · ${metres(driven)} · ${r.delivered} delivered`,
      lines: [
        ['Fares', money(r.fares)],
        ['Tips and bonuses', money(r.tips)],
        ['₦20 notes', money(r.notes)],
        ['Fuel bought', `−${money(r.fuelSpent)}`],
        ['Fines and toll', `−${money(r.fines + r.tolls)}`],
        ['Mission rewards', money(rewards.bank)],
      ],
      net: money(r.cash + rewards.bank),
      bank: money(s.bank),
      missions: r.missionsDone.map((m) => missionText(m)),
      levelUp: after > before ? `Level ${after}!${unlocked.length ? ` New route: ${unlocked.join(', ')}.` : ''} +${runXp + rewards.xp} XP` : `+${runXp + rewards.xp} XP`,
      best: newBest && r.cash > 0 ? 'New best run!' : null,
    };
    this.screens.over(model);
  }

  // ---------- Controls (called from input.ts) ----------
  playing(): boolean {
    return this.mode === 'play';
  }

  changeOpen(): boolean {
    return this.change.visible;
  }

  laneChange(dir: -1 | 1): void {
    if (this.mode !== 'play') return;
    if (this.run?.parked) this.unpark();
    this.lane = clamp(this.lane + dir, 0, LANES - 1);
  }

  hopOrGo(): void {
    const r = this.run;
    if (this.mode !== 'play' || !r) return;
    if (r.parked) {
      this.unpark();
      return;
    }
    if (this.air) return;
    this.air = true;
    this.vy = TUNING.hopV;
    this.sound.hop();
  }

  setBrake(on: boolean): void {
    if (this.run) this.run.braking = on && this.mode === 'play';
  }

  /** Hold to drive above cruise speed; pressing it while parked drives off. */
  setGas(on: boolean): void {
    const r = this.run;
    if (!r) return;
    r.gas = on && this.mode === 'play';
    if (r.gas && r.parked) this.unpark();
  }

  horn(on: boolean): void {
    if (!on) {
      this.sound.hornOff();
      return;
    }
    if (this.mode !== 'play') return;
    this.sound.unlock();
    this.sound.hornOn();
    const moved = this.traffic.honk(this.dist, this.lane, this.trafficEnv());
    if (moved > 0) {
      this.hud.say(pick(LINES.honk), 'info');
      this.emit('honkClear', moved);
    }
  }

  pauseFromInput(): void {
    this.pause();
  }

  muteFromInput(): void {
    this.toggleMute();
  }

  giveChange(value: number): void {
    const r = this.run;
    const task = r?.changeQueue[0];
    if (!r || !task || !this.change.visible) return;
    r.changeGiven.push(value);
    this.sound.coin();
    const check = checkChange(task.due, r.changeGiven);
    if (check.status === 'exact') {
      const tip = changeTip(task.fare);
      r.cash += tip;
      r.tips += tip;
      r.correctChange += 1;
      this.emit('change', 1);
      this.hud.say(pick(LINES.changeOk), 'passenger');
      this.hud.popup(`+${money(tip)}`, 'correct change');
      this.sound.changeOk();
      this.nextChange();
    } else if (check.status === 'over') {
      const extra = check.given - task.due;
      r.cash -= extra;
      this.hud.say('You give me extra? Thank you o!', 'passenger');
      this.hud.popup(`−${money(extra)}`, 'too much change', 'bad');
      this.sound.changeBad();
      this.nextChange();
    }
  }

  undoChange(): void {
    this.run?.changeGiven.pop();
  }

  private nextChange(): void {
    const r = this.run;
    if (!r) return;
    r.changeQueue.shift();
    r.changeGiven = [];
    r.changeT = TUNING.changeSeconds;
    if (r.changeQueue.length === 0) this.change.hide();
  }

  // ---------- Main loop ----------
  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.05);
    const r = this.run;

    if (this.mode === 'play' && r) this.updatePlay(dt, r);
    else if (this.mode === 'title') {
      this.speed += (8 - this.speed) * Math.min(1, dt * 2);
      this.lane = 1;
    } else if (this.mode === 'garage') this.speed = Math.max(0, this.speed - 10 * dt);
    else if (this.mode === 'ending' && r) {
      r.endT += dt;
      this.speed = Math.max(0, this.speed - 14 * dt);
      if (r.endT > 1.4) this.finishRun();
    } else if (this.mode === 'over') this.speed = Math.max(0, this.speed - 14 * dt);

    if (this.mode !== 'paused') {
      if (this.mode !== 'play') this.dist += this.speed * dt;
      this.updateMotion(dt);
      this.syncFeatures();
      this.animateFeatures(dt);
      this.traffic.update(dt, this.trafficEnv());
      this.tiles.update(this.dist, this.tileCtx());
    }
    this.updateSky(dt);
    this.updateBusMesh(dt);
    this.updateCamera(dt);
    if (r && (this.mode === 'play' || this.mode === 'ending')) {
      this.hud.update(this.hudData(r));
      this.hud.tick(dt);
      this.updateChangePanel(r);
    }
    this.stage.render();
  }

  private updateMotion(dt: number): void {
    this.x += (laneX(this.lane) - this.x) * Math.min(1, dt * 11);
    if (this.air) {
      this.vy -= TUNING.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.air = false;
      }
    }
  }

  private currentHour(): number {
    return this.run ? this.run.hour : this.event.startHour;
  }

  private isNight(): boolean {
    const h = mod(this.currentHour(), 24);
    return h >= 19 || h < 5.5;
  }

  private updateSky(dt: number): void {
    const r = this.run;
    const rain = r ? r.rain : this.event.weather === 'rainy' ? 0.6 : 0;
    const haze = r ? r.haze : this.event.weather === 'harmattan' ? 0.85 : 0;
    const onBridge = stretchAt(this.route, this.dist - this.runStart).kind === 'bridge';
    this.stage.setSky(this.currentHour(), { rain, haze }, onBridge);
    this.stage.updateRain(dt, this.speed, rain);
    this.sound.setRain(this.mode === 'play' ? rain : 0);
  }

  private updateWeather(dt: number, r: Run): void {
    if (r.t >= r.nextRainAt && r.rainTarget === 0) {
      r.rainTarget = rand(0.55, 0.9);
      r.rainUntil = r.t + rand(55, 95);
      this.hud.say(pick(LINES.rainStart), 'info');
    }
    if (r.rainTarget > 0 && r.t >= r.rainUntil) {
      r.rainTarget = 0;
      r.nextRainAt = this.event.weather === 'rainy' ? r.t + rand(25, 50) : Number.POSITIVE_INFINITY;
    }
    r.rain += (r.rainTarget - r.rain) * Math.min(1, dt / 5);
    if (this.event.weather !== 'harmattan') {
      const h = mod(r.hour, 24);
      const seasonal = isHarmattanSeason(new Date()) ? 0.55 : 0;
      r.haze = seasonal * clamp((12.5 - h) / 3, 0.15, 1);
    }
  }

  // ---------- Play update ----------
  private updatePlay(dt: number, r: Run): void {
    r.t += dt;
    r.hour = this.event.startHour + r.t * TUNING.clockRate;
    this.updateWeather(dt, r);
    r.invuln = Math.max(0, r.invuln - dt);
    r.potholeT = Math.max(0, r.potholeT - dt);
    this.shake = Math.max(0, this.shake - dt * 1.8);

    const cruise = Math.min(TUNING.speedMax, TUNING.speedStart + TUNING.speedRamp * r.t);
    const empty = r.fuel <= 0;
    const target = r.parked || r.braking || empty ? 0 : r.gas ? TUNING.gasMax : cruise;
    const brake = TUNING.brake * r.brakeFactor * lerp(1, 0.72, r.rain);
    if (r.parked) this.speed = 0;
    else if (this.speed > target) this.speed = Math.max(target, this.speed - (r.braking ? brake : TUNING.coast) * dt);
    else this.speed = Math.min(target, this.speed + (this.speed < cruise ? TUNING.accel : TUNING.gasAccel) * dt);

    const moved = this.speed * dt;
    this.dist += moved;
    r.fuel = Math.max(0, r.fuel - moved * TUNING.litresPerMetre * (this.speed > 24 ? 1.2 : 1));
    if (r.fuel < r.tank * 0.2 && !r.fuelWarned) {
      r.fuelWarned = true;
      this.hud.say(pick(LINES.fuelLow), 'conductor');
    }
    if (r.fuel > r.tank * 0.35) r.fuelWarned = false;
    if (empty && this.speed < 0.3 && !r.parked) {
      r.emptyT += dt;
      if (r.emptyT > 1.5) {
        this.endRun('fuel');
        return;
      }
    }

    r.cleanMetres += moved;
    this.emit('cleanRun', Math.floor(r.cleanMetres));
    if (this.stage.darkness > 0.6) {
      r.nightAcc += moved;
      if (r.nightAcc >= 50) {
        this.emit('nightMetres', r.nightAcc);
        r.nightAcc = 0;
      }
      if (!r.darkAnnounced) {
        r.darkAnnounced = true;
        this.hud.say(pick(LINES.night), 'info');
      }
    }
    const kind = stretchAt(this.route, this.dist - this.runStart).kind;
    this.trackBridge(kind, r);

    this.updateStops(dt, r);
    this.updateStations(dt, r);
    this.updateJunctions(dt, r);
    this.updateTolls(r);
    this.updateCameras(r);
    this.updateBrt(dt, r);
    this.collide(r);
  }

  private trackBridge(kind: StretchKind, r: Run): void {
    if (kind === 'bridge' && r.bridgeFrom === null) r.bridgeFrom = this.dist;
    if (kind !== 'bridge' && r.bridgeFrom !== null) {
      if (this.dist - r.bridgeFrom > 2000) {
        this.emit('bridge', 1);
        this.hud.say('You don cross Third Mainland Bridge!', 'info');
      }
      r.bridgeFrom = null;
    }
  }

  private emit(event: MissionEvent, value: number): void {
    const r = this.run;
    if (!r) return;
    for (const m of applyEvent(this.save.missions, event, value)) {
      r.missionsDone.push(m);
      this.hud.say(`Mission done: ${missionText(m)}`, 'mission');
      this.sound.jingle();
    }
  }

  private loseStreak(label: string): void {
    const r = this.run;
    if (!r) return;
    if (r.streak > 0) this.hud.popup(label, 'streak reset', 'bad');
    r.streak = 0;
  }

  private earn(r: Run, amount: number): void {
    r.cash += amount;
  }

  // ---------- Bus stops ----------
  private nextStop(): StopEnt | null {
    let best: StopEnt | null = null;
    for (const s of this.stops.values()) if (!s.done && (!best || s.at < best.at)) best = s;
    return best;
  }

  private seatsUsed(r: Run): number {
    return r.riders.reduce((n, rd) => n + PAX[rd.kind].seats, 0);
  }

  private stopBusiness(r: Run, st: StopEnt): { drops: number; boardable: boolean } {
    const drops = r.riders.filter((rd) => rd.destSerial === st.serial).length;
    const free = r.seats - this.seatsUsed(r);
    const boardable = st.waiting.some((w) => PAX[w.kind].seats <= free);
    return { drops, boardable };
  }

  private atKerb(): boolean {
    return this.lane === KERB && Math.abs(this.x - laneX(KERB)) < 0.5;
  }

  private updateStops(dt: number, r: Run): void {
    const st = this.nextStop();
    if (!st) return;
    const rel = this.dist - st.at;
    const { drops, boardable } = this.stopBusiness(r, st);
    if (!st.called && rel > -200) {
      st.called = true;
      if (drops > 0) this.hud.say(pick(OWA)(st.name), 'passenger');
      else if (boardable) this.hud.say(pick(CALLS)(st.name), 'conductor');
      else if (st.waiting.length > 0) this.hud.say(pick(LINES.full), 'conductor');
    }
    const inZone = rel > -TUNING.zoneBefore && rel < TUNING.zoneAfter;
    if (!r.parked && !st.left && inZone && this.atKerb() && this.speed < TUNING.parkBelow && !this.air && (drops > 0 || boardable)) {
      r.parked = { kind: 'stop', key: st.key, leaveT: 0 };
      r.loadT = 0.25;
      this.speed = 0;
    }
    if (r.parked?.kind === 'stop' && r.parked.key === st.key) {
      r.loadT -= dt;
      while (r.loadT <= 0) {
        const idx = r.riders.findIndex((rd) => rd.destSerial === st.serial);
        if (idx >= 0) {
          const rider = r.riders[idx];
          r.riders.splice(idx, 1);
          if (rider) this.dropOff(r, st, rider);
          r.loadT += 0.3;
          continue;
        }
        const free = r.seats - this.seatsUsed(r);
        const wIdx = this.closestBoarder(st, free);
        if (wIdx >= 0) {
          const w = st.waiting[wIdx];
          st.waiting.splice(wIdx, 1);
          if (w) {
            this.boardRider(r, st, w);
            r.loadT += PAX[w.kind].boardTime;
          }
          continue;
        }
        r.loadT = 0;
        break;
      }
      const after = this.stopBusiness(r, st);
      const busy = after.drops > 0 || after.boardable;
      const changing = r.changeQueue.length > 0 && !this.save.settings.autoChange;
      if (!busy && !changing) {
        r.parked.leaveT += dt;
        if (r.parked.leaveT > 0.6) this.unpark();
      } else if (changing && !busy) {
        r.changeT -= dt;
        if (r.changeT <= 0) this.changeTimeout(r);
      }
    }
    if (rel >= TUNING.zoneAfter) this.finishStop(r, st);
  }

  private closestBoarder(st: StopEnt, free: number): number {
    const doorZ = -1.6 - st.vis.group.position.z;
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    st.waiting.forEach((w, i) => {
      if (PAX[w.kind].seats > free) return;
      const dz = Math.abs(w.mesh.position.z - doorZ);
      if (dz < bestDist) {
        bestDist = dz;
        best = i;
      }
    });
    return best;
  }

  private boardRider(r: Run, st: StopEnt, w: Waiting): void {
    const k = weighted([[1, 0.5], [2, 0.32], [3, 0.18]] as const);
    const destSerial = st.serial + k;
    const n = this.route.stops.length;
    const lap = Math.floor(destSerial / n);
    const def = this.route.stops[destSerial % n];
    if (!def) return;
    const destD = this.runStart + lap * this.route.length + def.at;
    r.riders.push({ kind: w.kind, fromD: st.at, destSerial, destD, destName: def.name, deadline: r.t + (destD - st.at) / 9 + 20, smooth: true });
    st.boarded += 1;
    const doorZ = -1.6 - st.vis.group.position.z;
    st.movers.push({ mesh: w.mesh, kind: w.kind, t: 0, board: true, x0: w.mesh.position.x, z0: w.mesh.position.z, x1: this.x + 1.25, z1: doorZ, dir: 0 });
    this.sound.board();
    if (w.kind === 'trader') this.hud.say('Mama with basin don enter. Two seats!', 'info');
    if (r.seats - this.seatsUsed(r) <= 0) this.hud.say(pick(LINES.full), 'conductor');
  }

  private fareMult(): number {
    return this.event.fareMult * (this.isNight() ? this.event.nightFareMult : 1);
  }

  private dropOff(r: Run, st: StopEnt, rider: Rider): void {
    const fare = fareFor(rider.destD - rider.fromD, this.route.fareScale, PAX[rider.kind].fareMult, this.fareMult());
    let extra = streakBonus(fare, r.streak);
    const notes: string[] = [];
    if (rider.kind === 'worker') {
      if (r.t <= rider.deadline) {
        extra += Math.round((fare * 0.5) / 10) * 10;
        notes.push('on time');
        this.hud.say(pick(LINES.worker), 'passenger');
      } else this.hud.say(pick(LINES.workerLate), 'passenger');
    }
    if (rider.kind === 'baba' && rider.smooth) {
      extra += fare;
      notes.push('smooth ride');
      this.hud.say(pick(LINES.baba), 'passenger');
    }
    if (rider.kind !== 'hawker' && r.riders.some((o) => o.kind === 'hawker')) extra += Math.round((fare * 0.1) / 10) * 10;
    if (rider.kind === 'preacher') {
      r.streak = Math.min(4, r.streak + 1);
      this.hud.say(pick(LINES.preacher), 'passenger');
      this.emit('streak', streakMult(r.streak));
    }
    this.earn(r, fare + extra);
    r.fares += fare;
    r.tips += extra;
    r.delivered += 1;
    st.dropped += 1;
    this.emit('deliver', 1);
    if (rider.kind === 'trader') this.emit('traderDelivered', 1);
    if (r.rain > 0.4) this.emit('rainDeliver', 1);
    this.emit('earnRun', r.cash);
    this.hud.popup(`+${money(fare + extra)}`, [r.streak > 0 ? `×${streakMult(r.streak)}` : '', ...notes].filter(Boolean).join(' · '));
    this.sound.fare();
    const paid = paymentFor(fare, Math.random);
    if (paid > fare && !this.save.settings.autoChange) {
      if (r.changeQueue.length === 0) {
        r.changeT = TUNING.changeSeconds;
        r.changeGiven = [];
      }
      r.changeQueue.push({ who: PAX[rider.kind].label, fare, paid, due: paid - fare });
    }
    const p = this.figure(rider.kind);
    const z = -1.6 - st.vis.group.position.z;
    p.position.set(this.x + 1.3, 0.15, z);
    st.vis.group.add(p);
    st.movers.push({ mesh: p, kind: rider.kind, t: 0, board: false, x0: this.x + 1.3, z0: z, x1: KERB_X + rand(1, 2.6), z1: z, dir: Math.random() < 0.5 ? 1 : -1 });
  }

  private changeTimeout(r: Run): void {
    r.complaints += 1;
    this.hud.say(pick(LINES.changeBad), 'passenger');
    this.sound.changeBad();
    if (r.complaints >= 3) {
      r.complaints = 0;
      this.loseStreak('Too many complaints');
    }
    this.nextChange();
  }

  private finishStop(r: Run, st: StopEnt): void {
    st.done = true;
    if (r.parked?.key === st.key) this.unpark();
    const missed = r.riders.filter((rd) => rd.destSerial === st.serial).length;
    if (missed > 0) {
      r.riders = r.riders.filter((rd) => rd.destSerial !== st.serial);
      this.loseStreak(`${missed} missed`);
      this.hud.say(pick(LINES.missed), 'passenger');
      this.sound.changeBad();
    } else if (st.dropped > 0) {
      r.streak = Math.min(4, r.streak + 1);
      r.served += 1;
      this.hud.say(`Clean stop! Fares now ×${streakMult(r.streak)}`, 'info');
      this.emit('streak', streakMult(r.streak));
    } else if (st.boarded > 0) r.served += 1;
  }

  private unpark(): void {
    const r = this.run;
    if (!r?.parked) return;
    const { kind, key } = r.parked;
    r.parked = null;
    if (kind === 'stop') {
      const st = this.stops.get(key);
      if (st) st.left = true;
      r.changeQueue = [];
      r.changeGiven = [];
      this.change.hide();
    } else {
      const sn = this.stations.get(key);
      if (sn) {
        sn.left = true;
        if (sn.pumped >= 1) this.emit('refuel', 1);
      }
    }
  }

  private updateChangePanel(r: Run): void {
    const task = r.changeQueue[0];
    const parkedAtStop = r.parked?.kind === 'stop';
    const st = parkedAtStop && r.parked ? this.stops.get(r.parked.key) : undefined;
    const busy = st ? (() => {
      const b = this.stopBusiness(r, st);
      return b.drops > 0 || b.boardable;
    })() : true;
    if (!task || !parkedAtStop || busy || this.save.settings.autoChange) {
      if (this.change.visible) this.change.hide();
      return;
    }
    this.change.show({ who: task.who, fare: task.fare, paid: task.paid, due: task.due, given: r.changeGiven, timeLeft: r.changeT, total: TUNING.changeSeconds });
  }

  // ---------- Filling stations ----------
  private updateStations(dt: number, r: Run): void {
    let sn: StationEnt | null = null;
    for (const s of this.stations.values()) if (!s.done && (!sn || s.at < sn.at)) sn = s;
    if (!sn) return;
    const rel = this.dist - sn.at;
    const inZone = rel > -TUNING.zoneBefore && rel < TUNING.zoneAfter;
    if (!r.parked && !sn.left && inZone && this.atKerb() && this.speed < TUNING.parkBelow && !this.air && r.fuel < r.tank - 0.5) {
      r.parked = { kind: 'station', key: sn.key, leaveT: 0 };
      this.speed = 0;
      this.hud.say(`Filling up at ₦${this.event.fuelPrice}/litre`, 'info');
    }
    if (r.parked?.kind === 'station' && r.parked.key === sn.key) {
      const litres = Math.min(TUNING.pumpRate * dt, r.tank - r.fuel);
      const cost = litres * this.event.fuelPrice;
      if (r.cash < cost || r.cash <= 0) {
        this.hud.say(pick(LINES.stationBroke), 'info');
        this.unpark();
      } else {
        r.fuel += litres;
        r.cash -= cost;
        r.fuelSpent += cost;
        sn.pumped += litres;
        if (Math.floor(sn.pumped) !== Math.floor(sn.pumped - litres)) this.sound.pump();
        if (r.fuel >= r.tank - 0.05) {
          this.hud.say(pick(LINES.stationFull), 'info');
          this.unpark();
        }
      }
    }
    if (rel >= TUNING.zoneAfter) {
      sn.done = true;
      if (r.parked?.key === sn.key) this.unpark();
    }
  }

  // ---------- Junction with traffic warden ----------
  private updateJunctions(dt: number, r: Run): void {
    const front = this.dist + BUS.l / 2;
    for (const j of this.junctions.values()) {
      if (j.resolved) continue;
      const ahead = j.at - front;
      if (!j.active && ahead < 300) {
        j.active = true;
        j.phase = Math.random() < 0.65 ? 'stop' : 'go';
        j.timer = j.phase === 'stop' ? rand(4, 6) : rand(4, 7);
        if (j.phase === 'stop') this.hud.say(pick(LINES.wardenStop), 'info');
      }
      if (!j.active) continue;
      j.timer -= dt;
      if (j.timer <= 0) {
        j.phase = j.phase === 'stop' ? 'go' : 'stop';
        j.timer = j.phase === 'stop' ? rand(4, 6) : rand(7, 10);
        if (j.phase === 'go' && ahead > -2 && ahead < 120) this.hud.say(pick(LINES.wardenGo), 'info');
      }
      if (j.phase === 'stop') {
        j.crossT -= dt;
        if (j.crossT <= 0) {
          j.crossT = 1.3;
          j.crossDir = j.crossDir === 1 ? -1 : 1;
          this.traffic.addCrossCar(j.at + (j.crossDir === 1 ? 4 : 8), j.crossDir);
        }
        if (ahead < 30 && ahead > -1 && this.speed < 1) j.waited = true;
      }
      if (ahead <= 0) {
        j.resolved = true;
        if (j.phase === 'stop') {
          r.fines += TUNING.wardenFine;
          this.earn(r, -TUNING.wardenFine);
          this.loseStreak('Warden fine');
          this.hud.say(pick(LINES.wardenFine), 'info');
          this.hud.popup(`−${money(TUNING.wardenFine)}`, 'warden fine', 'bad');
          this.sound.whistle();
        } else if (j.waited) {
          this.emit('wardenObey', 1);
          this.hud.popup('Good driver', 'waited for the warden', 'gold');
        }
      }
    }
  }

  // ---------- Toll gate ----------
  private updateTolls(r: Run): void {
    const front = this.dist + BUS.l / 2;
    for (const t of this.tolls.values()) {
      if (t.resolved) continue;
      const ahead = t.at - front;
      if (!t.paid && ahead < 30 && ahead > 0 && this.speed < 6) {
        t.paid = true;
        r.tolls += TUNING.toll;
        this.earn(r, -TUNING.toll);
        this.emit('toll', 1);
        this.hud.say(pick(LINES.toll), 'info');
        this.hud.popup(`−${money(TUNING.toll)}`, 'toll');
        this.sound.beep();
      }
      if (ahead <= 0.3) {
        t.resolved = true;
        if (!t.paid) {
          r.fines += TUNING.toll * 5;
          this.earn(r, -TUNING.toll * 5);
          this.hud.say(pick(LINES.tollCrash), 'info');
          this.crash();
        }
      }
    }
  }

  // ---------- BRT lane ----------
  private inBrtLane(): boolean {
    return stretchAt(this.route, this.dist - this.runStart).brt === true && Math.abs(this.x - laneX(0)) < 1.6;
  }

  private updateCameras(r: Run): void {
    const front = this.dist + BUS.l / 2;
    for (const c of this.cameras.values()) {
      if (c.resolved || front < c.at) continue;
      c.resolved = true;
      if (this.inBrtLane()) {
        r.fines += TUNING.brtFine;
        this.earn(r, -TUNING.brtFine);
        this.loseStreak('BRT fine');
        this.hud.say(pick(LINES.brtFine), 'info');
        this.hud.popup(`−${money(TUNING.brtFine)}`, 'BRT camera', 'bad');
        if (!this.reduceMotion) this.hud.flash();
        this.sound.snap();
      }
    }
  }

  private updateBrt(dt: number, r: Run): void {
    if (this.inBrtLane()) {
      r.brtT += dt;
      if (r.brtT > 1.5 && !this.traffic.vehicles.some((v) => v.behind && !v.flung)) {
        this.traffic.addBrtBehind(this.dist);
        this.hud.say(pick(LINES.brtBehind), 'info');
      }
    } else r.brtT = 0;
  }

  // ---------- Collisions ----------
  private collide(r: Run): void {
    const D = this.dist;
    for (const v of this.traffic.vehicles) {
      if (v.flung) continue;
      const dz = Math.abs(v.d - D);
      const dx = Math.abs(v.x - this.x);
      const hit = v.cross ? dz < (v.w + BUS.l) / 2 - 0.3 && dx < (v.l + BUS.w) / 2 - 0.3 : dz < (v.l + BUS.l) / 2 - 0.35 && dx < (v.w + BUS.w) / 2 - 0.3;
      if (hit) this.crash(v);
    }
    for (const h of this.traffic.hazards) {
      if (h.flung) continue;
      const dz = Math.abs(h.d - D);
      const dx = Math.abs(h.x - this.x);
      if (h.kind === 'barrier') {
        if (dz < (h.l + BUS.l) / 2 - 1 && dx < (h.w + BUS.w) / 2 - 0.35 && this.y < 0.5) this.crash(h);
      } else if (!h.hit && dz < (h.l + BUS.l) / 2 - 1 && dx < 1.4 && this.y < 0.05) {
        h.hit = true;
        for (const rd of r.riders) rd.smooth = false;
        if (h.kind === 'puddle') {
          this.speed *= 0.8;
          this.sound.splash();
        } else {
          this.speed *= 0.6;
          this.shake = 0.35;
          this.sound.thud();
          if (r.potholeT <= 0) {
            this.hud.say(pick(LINES.pothole), 'passenger');
            r.potholeT = 6;
          }
        }
      }
    }
    for (let i = this.traffic.notes.length - 1; i >= 0; i--) {
      const n = this.traffic.notes[i];
      if (n && Math.abs(n.d - D) < BUS.l / 2 + 0.4 && Math.abs(n.x - this.x) < BUS.w / 2 + 0.5) {
        this.earn(r, TUNING.noteValue);
        r.notes += TUNING.noteValue;
        this.emit('notesRun', 1);
        this.sound.note();
        this.traffic.removeNote(i);
      }
    }
    for (const w of this.traffic.walkers) this.walkerContact(r, w);
  }

  private walkerContact(r: Run, w: Walker): void {
    const dz = Math.abs(w.d - this.dist);
    const dx = Math.abs(w.x - this.x);
    if (w.kind === 'hawker' && !w.sold && r.riders.length > 0 && dz < BUS.l / 2 + 1 && dx < 3.4 && this.speed < 7) {
      w.sold = true;
      const tip = Math.min(400, 30 * r.riders.length);
      this.earn(r, tip);
      r.tips += tip;
      this.emit('hawkerSale', 1);
      this.hud.say(pick(LINES.hawker), 'passenger');
      this.hud.popup(`+${money(tip)}`, 'hawker sales');
      this.sound.coin();
    }
    if (!w.scared && dz < BUS.l / 2 + 0.4 && dx < BUS.w / 2 + 0.35 && this.speed > 3) {
      w.scared = true;
      w.dodge = 0.7;
      this.loseStreak('Scare!');
      this.hud.say(pick(LINES.scare), 'passenger');
      this.sound.scare();
    }
  }

  private crash(hit?: Vehicle | Hazard): void {
    const r = this.run;
    if (hit) this.traffic.fling(hit, this.x);
    if (!r || r.invuln > 0) return;
    r.body -= 1;
    r.invuln = 2.2;
    this.speed *= 0.25;
    this.shake = 0.7;
    r.cleanMetres = 0;
    for (const rd of r.riders) rd.smooth = false;
    if (r.riders.some((rd) => rd.kind === 'preacher') && !r.shieldUsed) {
      r.shieldUsed = true;
      this.hud.say(pick(LINES.preacher), 'passenger');
    } else this.loseStreak('Streak lost');
    this.sound.crash();
    this.hud.say(pick(LINES.crash), 'passenger');
    if (r.body <= 0) this.endRun('crash');
  }

  // ---------- Route features (spawn, animate, recycle) ----------
  private figure(kind: FigureKind): THREE.Group {
    const pool = this.figurePool.get(kind);
    const g = pool?.pop() ?? makeFigure(kind);
    g.visible = true;
    g.rotation.set(0, 0, 0);
    g.userData.kind = kind;
    g.userData.t = Math.random() * 6;
    return g;
  }

  private freeFigure(g: THREE.Group): void {
    g.removeFromParent();
    const kind = g.userData.kind as FigureKind | undefined;
    if (!kind) return;
    const pool = this.figurePool.get(kind) ?? [];
    pool.push(g);
    this.figurePool.set(kind, pool);
  }

  private paxWeights(stretch: StretchKind): [PaxKind, number][] {
    const h = mod(this.currentHour(), 24);
    const night = h >= 19 || h < 5;
    const rush = (h >= 6 && h < 9.5) || (h >= 16 && h < 19);
    const school = (h >= 7 && h < 9) || (h >= 13 && h < 15.5);
    return PAX_KINDS.map((k) => {
      let w = PAX[k].weight * (this.event.paxBoost[k] ?? 1);
      if (k === 'guest') w = night ? 2 * (this.event.paxBoost.guest ?? 1) : 0;
      if (k === 'worker') w *= rush ? 3 : night ? 0.3 : 1;
      if (k === 'student') w *= school ? 2 : night ? 0.2 : 1;
      if (k === 'trader' && stretch === 'market') w *= 3;
      return [k, w];
    });
  }

  private syncFeatures(): void {
    const from = this.dist - BEHIND;
    const to = this.dist + AHEAD;
    const route = this.route;
    for (const p of placements(route, 'stop', route.stops.map((s) => s.at), this.runStart, from, to)) {
      if (this.stops.has(p.key)) continue;
      const def = route.stops[p.index];
      if (!def) continue;
      const vis = this.stopPool.pop() ?? makeStop(def.name);
      vis.plate.material = plateMaterial(def.name);
      vis.group.visible = true;
      if (!vis.group.parent) this.stage.scene.add(vis.group);
      const raining = (this.run?.rain ?? 0) > 0.4;
      const count = clamp(Math.round(def.busy * rand(0.5, 1.15) * this.event.crowdMult * (raining ? 1.5 : 1)), 1, 9);
      const weights = this.paxWeights(stretchAt(route, def.at).kind);
      const waiting: Waiting[] = [];
      for (let i = 0; i < count; i++) {
        const kind = weighted(weights);
        const mesh = this.figure(kind);
        mesh.position.set(KERB_X + rand(0.9, 2.7), 0.15, rand(-5.5, 5.5));
        mesh.rotation.y = rand(-0.5, 0.5);
        vis.group.add(mesh);
        waiting.push({ kind, mesh });
      }
      this.stops.set(p.key, { key: p.key, serial: stopSerial(route, p.lap, p.index), name: def.name, at: p.at, vis, waiting, movers: [], dropped: 0, boarded: 0, called: false, left: false, done: false });
    }
    for (const p of placements(route, 'station', route.stations, this.runStart, from, to)) {
      if (this.stations.has(p.key)) continue;
      const group = this.stationPool.pop() ?? makeStation(this.event.fuelPrice);
      group.visible = true;
      if (!group.parent) this.stage.scene.add(group);
      this.stations.set(p.key, { key: p.key, at: p.at, group, pumped: 0, left: false, done: false });
    }
    for (const p of placements(route, 'junction', route.junctions, this.runStart, from, to)) {
      if (this.junctions.has(p.key)) continue;
      const vis = this.junctionPool.pop() ?? makeJunction();
      vis.group.visible = true;
      if (!vis.group.parent) this.stage.scene.add(vis.group);
      this.junctions.set(p.key, { key: p.key, at: p.at, vis, phase: 'go', timer: 0, active: false, crossT: 0, crossDir: 1, waited: false, resolved: false });
    }
    for (const p of placements(route, 'toll', route.tolls, this.runStart, from, to)) {
      if (this.tolls.has(p.key)) continue;
      const vis = this.tollPool.pop() ?? makeToll();
      vis.group.visible = true;
      if (!vis.group.parent) this.stage.scene.add(vis.group);
      this.tolls.set(p.key, { key: p.key, at: p.at, vis, open: 0, paid: false, resolved: false });
    }
    for (const p of placements(route, 'camera', route.brtCameras, this.runStart, from, to)) {
      if (this.cameras.has(p.key)) continue;
      const group = this.cameraPool.pop() ?? makeBrtCamera();
      group.visible = true;
      if (!group.parent) this.stage.scene.add(group);
      this.cameras.set(p.key, { key: p.key, at: p.at, group, resolved: false });
    }
    for (const [key, s] of this.stops) if (s.at < from) (this.releaseStop(s), this.stops.delete(key));
    for (const [key, s] of this.stations) if (s.at < from) (this.releaseStation(s), this.stations.delete(key));
    for (const [key, j] of this.junctions) if (j.at < from) (this.releaseJunction(j), this.junctions.delete(key));
    for (const [key, t] of this.tolls) if (t.at < from) (this.releaseToll(t), this.tolls.delete(key));
    for (const [key, c] of this.cameras) if (c.at < from) (this.releaseCamera(c), this.cameras.delete(key));
  }

  private releaseStop(s: StopEnt): void {
    for (const w of s.waiting) this.freeFigure(w.mesh);
    for (const m of s.movers) this.freeFigure(m.mesh);
    s.vis.group.visible = false;
    this.stopPool.push(s.vis);
  }
  private releaseStation(s: StationEnt): void {
    s.group.visible = false;
    this.stationPool.push(s.group);
  }
  private releaseJunction(j: JunctionEnt): void {
    j.vis.group.visible = false;
    this.junctionPool.push(j.vis);
  }
  private releaseToll(t: TollEnt): void {
    t.vis.group.visible = false;
    this.tollPool.push(t.vis);
  }
  private releaseCamera(c: CameraEnt): void {
    c.group.visible = false;
    this.cameraPool.push(c.group);
  }

  private animateFeatures(dt: number): void {
    const D = this.dist;
    for (const s of this.stops.values()) {
      s.vis.group.position.z = -(s.at - D);
      for (const w of s.waiting) {
        const t = ((w.mesh.userData.t as number | undefined) ?? 0) + dt;
        w.mesh.userData.t = t;
        w.mesh.position.y = 0.15 + (Math.sin(t * 2.4) > 0.97 ? 0.08 : 0);
      }
      for (let i = s.movers.length - 1; i >= 0; i--) {
        const m = s.movers[i];
        if (!m) continue;
        m.t += dt;
        if (m.board) {
          const k = Math.min(1, m.t / 0.35);
          m.mesh.position.set(m.x0 + (m.x1 - m.x0) * k, 0.15 + Math.abs(Math.sin(m.t * 16)) * 0.12, m.z0 + (m.z1 - m.z0) * k);
          if (k >= 1) {
            this.freeFigure(m.mesh);
            s.movers.splice(i, 1);
          }
        } else {
          if (m.t < 0.6) m.mesh.position.x = m.x0 + (m.x1 - m.x0) * (m.t / 0.6);
          else m.mesh.position.z += m.dir * 1.3 * dt;
          m.mesh.position.y = 0.15 + Math.abs(Math.sin(m.t * 9)) * 0.06;
          if (m.t > 7) {
            this.freeFigure(m.mesh);
            s.movers.splice(i, 1);
          }
        }
      }
      if (this.mode !== 'play' && D > s.at + TUNING.zoneAfter) s.done = true;
    }
    for (const s of this.stations.values()) s.group.position.z = -(s.at - D);
    for (const c of this.cameras.values()) c.group.position.z = -(c.at - D);
    const t = performance.now() / 1000;
    for (const j of this.junctions.values()) {
      j.vis.group.position.z = -(j.at - D);
      const stop = j.active && j.phase === 'stop' && !j.resolved;
      if (j.vis.arm) j.vis.arm.rotation.z = stop ? 0 : -Math.PI / 2 + Math.sin(t * 6) * 0.45;
      const color = (j.vis.signal.material as THREE.MeshBasicMaterial).color;
      color.setHex(stop ? 0xd7263d : 0x2ecc71);
    }
    for (const toll of this.tolls.values()) {
      toll.vis.group.position.z = -(toll.at - D);
      const near = toll.at - this.dist;
      const open = toll.paid || (near < 25 && near > -5 && this.speed < 6) || this.mode !== 'play';
      toll.open += ((open ? 1 : 0) - toll.open) * Math.min(1, dt * 4);
      toll.vis.arms.forEach((arm, lane) => {
        const carNear = this.traffic.vehicles.some((v) => !v.flung && v.lane === lane && toll.at - v.d < 18 && toll.at - v.d > -6);
        arm.rotation.z = (carNear ? 1 : toll.open) * 1.35;
      });
    }
  }

  // ---------- Traffic environment ----------
  private trafficEnv(): TrafficEnv {
    const route = this.route;
    const runStart = this.runStart;
    const r = this.run;
    const reserved = [...route.stops.map((s) => s.at), ...route.stations];
    return {
      dist: this.dist,
      difficulty: r ? clamp((this.dist - r.startDist) / 7000, 0, 1) : 0,
      trafficMult: this.event.trafficMult,
      pedestrianMult: this.event.pedestrianMult,
      hawkerMult: this.event.hawkerMult,
      rain: r?.rain ?? 0,
      dark: this.stage.darkness,
      playing: this.mode === 'play',
      stretchAt: (d) => {
        const s = stretchAt(route, d - runStart);
        return { kind: s.kind, brt: s.brt === true };
      },
      kerbReserved: (d) => {
        const local = mod(d - runStart, route.length);
        return reserved.some((at) => local > at - TUNING.zoneBefore - 70 && local < at + TUNING.zoneAfter + 10);
      },
      stopLines: () => [...this.junctions.values()].filter((j) => j.active && j.phase === 'stop' && !j.resolved).map((j) => j.at),
      slowZones: () => [...this.tolls.values()].map((t) => ({ from: t.at - 45, to: t.at + 3, speed: 4 })),
    };
  }

  // ---------- Bus, camera, HUD ----------
  private updateBusMesh(dt: number): void {
    const g = this.bus.group;
    g.position.set(this.x, this.y, 0);
    const lean = (laneX(this.lane) - this.x) * -0.035;
    g.rotation.z += (lean - g.rotation.z) * Math.min(1, dt * 10);
    const pitch = this.run?.braking && this.speed > 1 ? 0.03 : 0;
    g.rotation.x += (pitch - g.rotation.x) * Math.min(1, dt * 6);
    for (const w of this.bus.wheels) w.rotation.x -= (this.speed * dt) / 0.45;
    const door = this.bus.door;
    const k = (door.userData.k as number | undefined) ?? 0;
    const target = this.run?.parked ? 1 : 0;
    const next = k + (target - k) * Math.min(1, dt * 8);
    door.userData.k = next;
    door.position.z = -1.6 + next * 0.95;
    const r = this.run;
    g.visible = !(this.mode === 'play' && r && r.invuln > 0 && Math.floor(r.invuln * 12) % 2 === 1);
  }

  private updateCamera(dt: number): void {
    const cam = this.stage.camera;
    const portrait = cam.aspect < 0.85;
    if (this.mode === 'garage') {
      this.orbit += dt * 0.35;
      cam.fov += (45 - cam.fov) * Math.min(1, dt * 3);
      cam.updateProjectionMatrix();
      cam.position.set(this.x + Math.sin(this.orbit) * (portrait ? 11 : 8.5), 3.4, Math.cos(this.orbit) * (portrait ? 11 : 8.5));
      cam.lookAt(this.x, 1.4, 0);
      return;
    }
    const fov = (portrait ? 70 : 58) + (this.mode === 'play' ? (this.speed / TUNING.speedMax) * 7 : 0);
    if (Math.abs(fov - cam.fov) > 0.05) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
      cam.updateProjectionMatrix();
    }
    this.camX += (this.x * 0.6 - this.camX) * Math.min(1, dt * 4);
    const sh = !this.reduceMotion && this.shake > 0 ? this.shake : 0;
    const jitter = (): number => (sh ? (Math.random() - 0.5) * sh : 0);
    cam.position.set(this.camX + jitter(), (portrait ? 8.6 : 7) + this.y * 0.35 + jitter(), portrait ? 13.5 : 12);
    cam.lookAt(this.camX * 0.5, 1.3, -24);
  }

  private hudData(r: Run) {
    const st = this.nextStop();
    let stop: { name: string; dist: string; info: string; hint: string; busy: boolean; here: boolean } | null = null;
    const touch = document.body.classList.contains('touch');
    const brakeWord = touch ? 'Hold BRAKE' : 'Hold ↓';
    if (st) {
      const ahead = st.at - this.dist;
      const here = ahead < TUNING.zoneBefore && ahead > -TUNING.zoneAfter;
      const { drops, boardable } = this.stopBusiness(r, st);
      const busy = drops > 0 || boardable;
      const free = r.seats - this.seatsUsed(r);
      let hint = '';
      const parkedHere = r.parked?.kind === 'stop' && r.parked.key === st.key;
      if (parkedHere) hint = this.change.visible ? 'Give the right change!' : `Passengers moving… ${touch ? 'GO' : 'Space'} to leave early`;
      else if (st.left) hint = 'Drive on';
      else if (!busy) hint = ahead < 220 ? (st.waiting.length > 0 ? 'Bus full. Drive on.' : 'Nobody for this stop. Drive on.') : '';
      else if (ahead < 220) hint = this.lane !== KERB ? 'Move to the kerb lane →' : `${brakeWord} in the yellow bay`;
      stop = {
        name: st.name,
        dist: here ? 'Here' : ahead > TUNING.zoneBefore ? `in ${Math.round(ahead - TUNING.zoneBefore)} m` : '',
        info: `${drops} getting off · ${st.waiting.length} waiting · ${free} seat${free === 1 ? '' : 's'} free`,
        hint,
        busy,
        here: here && busy,
      };
    }
    const alerts: { id: string; text: string; tone: AlertTone }[] = [];
    for (const j of this.junctions.values()) {
      const ahead = j.at - this.dist;
      if (!j.resolved && j.active && ahead < 160 && ahead > -3) alerts.push({ id: 'warden', text: j.phase === 'stop' ? 'Warden: STOP before the line' : 'Warden: GO', tone: j.phase === 'stop' ? 'bad' : 'ok' });
    }
    for (const t of this.tolls.values()) {
      const ahead = t.at - this.dist;
      if (!t.resolved && ahead < 160 && ahead > 0) alerts.push({ id: 'toll', text: t.paid ? 'Toll paid' : 'Toll gate: slow below 20 km/h', tone: t.paid ? 'ok' : 'warn' });
    }
    if (this.inBrtLane()) alerts.push({ id: 'brt', text: 'BRT lane: cameras fine ₦1,500', tone: 'warn' });
    const behind = this.traffic.vehicles.find((v) => v.behind && !v.flung && this.dist - v.d < 80 && v.d < this.dist);
    if (behind && Math.abs(behind.x - this.x) < 2) alerts.push({ id: 'brtbus', text: 'BRT bus behind you!', tone: 'bad' });
    let nextStation: number | null = null;
    for (const s of this.stations.values()) if (!s.done && s.at > this.dist - TUNING.zoneAfter && (nextStation === null || s.at < nextStation)) nextStation = s.at;
    if (r.parked?.kind === 'station') alerts.push({ id: 'fuel', text: `Filling up… ${Math.round(r.fuel)} / ${r.tank} L`, tone: 'info' });
    else if (r.fuel < r.tank * 0.2) alerts.push({ id: 'fuel', text: nextStation !== null ? `Fuel low · station in ${Math.max(0, Math.round(nextStation - this.dist))} m` : 'Fuel low!', tone: 'bad' });
    else if (nextStation !== null && nextStation - this.dist < 250 && r.fuel < r.tank * 0.75) alerts.push({ id: 'fuel', text: 'Filling station ahead: kerb lane + brake', tone: 'info' });
    if (r.rain > 0.3) alerts.push({ id: 'rain', text: 'Rain: brakes slippery', tone: 'info' });

    const h = mod(r.hour, 24);
    const sky = r.rain > 0.3 ? 'Rain' : r.haze > 0.4 && this.stage.darkness < 0.5 ? 'Harmattan' : this.stage.darkness > 0.6 ? 'Night' : h >= 17.5 ? 'Evening' : h < 11 ? 'Morning' : 'Afternoon';
    return {
      cash: r.cash,
      cashText: money(r.cash),
      streak: r.streak,
      multText: `×${streakMult(r.streak)}`,
      distText: metres(this.dist - r.startDist),
      clock: clockText(r.hour),
      skyText: sky,
      fuel: r.fuel / r.tank,
      fuelLow: r.fuel < r.tank * 0.2,
      body: Math.max(0, r.body),
      bodyMax: r.bodyMax,
      seatsText: `${this.seatsUsed(r)}/${r.seats}`,
      riders: r.riders.map((rd) => rd.kind),
      speedKmh: this.speed * 3.6,
      stop,
      alerts,
      parked: r.parked !== null,
    };
  }
}
