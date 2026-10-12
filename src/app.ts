// West Road Life: screens, the home showcase, drives, results and sharing.
import { CITIES, areaById, cityById, type AreaDef, type CityId } from './config/cities.ts';
import { FLEETS, VEHICLES, type VehicleId } from './config/vehicles.ts';
import { SoundBoard } from './audio.ts';
import { Thumbnails } from './art/thumbs.ts';
import { ChaseCamera } from './game/camera.ts';
import { Crowd } from './game/crowd.ts';
import { Drive, type DriveListener, type SoundName } from './game/drive.ts';
import { PlayerVehicle, vehicleShape } from './game/player.ts';
import { Traffic } from './game/traffic.ts';
import { distanceText, money } from './rules/money.ts';
import { SAVE_KEY, bestKey, defaultSave, parseSave, type Mode, type SaveData } from './rules/save.ts';
import { dailyDrive, dayKey, driveAdvice, encodeChallenge, shortDate, type Challenge, type DailyDrive } from './rules/social.ts';
import { clamp } from './rules/util.ts';
import { byId } from './ui/dom.ts';
import { Hud } from './ui/hud.ts';
import { endHtml, garageHtml, homeHtml, howtoHtml, modalHtml, passengersHtml, pauseHtml, resultsHtml, settingsHtml, setupHtml, shareHtml, Screens, type ResultsModel } from './ui/screens.ts';
import { canvasBlob, drawShareCard, shareNative } from './ui/share.ts';
import { Layout, LANES } from './world/layout.ts';
import { Stage, TIERS, type Quality } from './world/stage.ts';
import { setReflections, setSurfaceDetail } from './art/surfaces.ts';
import { Blobs } from './world/blobs.ts';
import { Streets } from './world/streets.ts';

type State = 'loading' | 'home' | 'menu' | 'garage' | 'drive' | 'paused' | 'resuming' | 'end' | 'results' | 'share';

/** What a drive was started with, so Restart and Play again repeat it. */
interface DriveConfig {
  readonly city: CityId;
  readonly area: string;
  readonly mode: Mode;
  readonly passengers: boolean;
  readonly vehicle: VehicleId;
  /** Fixed for daily drives and challenges; otherwise new each drive. */
  readonly seed: number | null;
  readonly daily: DailyDrive | null;
  readonly challenge: Challenge | null;
  readonly tutorial: boolean;
}

interface LastDrive {
  readonly config: DriveConfig;
  readonly seed: number;
  readonly money: number;
  readonly metres: number;
  readonly results: ResultsModel;
  readonly shot: string | null;
  readonly stats: readonly string[];
}

const START = 240;
const params = new URLSearchParams(window.location.search);
const LONDON_CALLS = ['Next stop: {s}.', 'This bus is for {s}.', '{s}. Mind the doors, please.'];

export class App {
  readonly stage: Stage;
  private readonly streets: Streets;
  private readonly traffic = new Traffic();
  private readonly crowd: Crowd;
  private readonly player = new PlayerVehicle();
  private readonly cam = new ChaseCamera();
  private readonly sound = new SoundBoard();
  private readonly hud = new Hud();
  private readonly screens: Screens;
  private readonly thumbs: Thumbnails;
  /** Contact shadows under the player, traffic and people. */
  private readonly blobs = new Blobs();
  save: SaveData;
  private saveOk = true;
  state: State = 'loading';
  drive: Drive | null = null;
  private config: DriveConfig | null = null;
  private last: LastDrive | null = null;
  private challenge: Challenge | null = null;
  private readonly today: DailyDrive;
  private readonly gasSources = new Set<string>();
  private readonly brakeSources = new Set<string>();
  /** Home showcase: the selected vehicle cruising down the selected area. */
  private show = { dist: START, layout: null as Layout | null, x: 0 };
  private resumeT = 0;
  private endT = 0;
  private wantShot = false;
  private shot: string | null = null;
  private muted = false;
  private garagePick: VehicleId | null = null;
  private menuReturn: 'home' | 'pause' = 'home';
  private shareCanvas: HTMLCanvasElement | null = null;
  private lastTime = performance.now();
  private audioWarned = false;

  constructor(host: HTMLElement) {
    this.stage = new Stage(host);
    this.streets = new Streets(this.stage);
    this.crowd = new Crowd(this.stage.world);
    this.stage.world.add(this.traffic.group, this.blobs.mesh);
    this.stage.scene.add(this.player.group);
    this.thumbs = new Thumbnails(this.stage.renderer);
    this.screens = new Screens(byId('screens'), (a, v, el) => this.action(a, v, el), (id, v, el) => this.input(id, v, el));
    this.save = this.load();
    this.today = dailyDrive(dayKey(new Date()));
    this.applyMotion();
    const g = this.save.settings.graphics;
    this.applyQuality(g === 'auto' ? Stage.autoQuality() : g);
    this.sound.setLevels(this.save.settings.music, this.save.settings.sfx);
    window.addEventListener('resize', () => this.stage.resize());
    this.stage.resize();
  }

  // ---------- Saving ----------
  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return parseSave(JSON.parse(raw));
    } catch {
      // Storage blocked or corrupt: start fresh.
    }
    return defaultSave();
  }

  private persist(): boolean {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
      this.saveOk = true;
    } catch {
      this.saveOk = false;
    }
    return this.saveOk;
  }

  private applyMotion(): void {
    const reduce = this.save.settings.reducedMotion;
    document.body.classList.toggle('reduce-motion', reduce);
    this.cam.reduceMotion = reduce;
  }

  // ---------- Start-up ----------
  async boot(challenge: Challenge | null): Promise<void> {
    this.challenge = challenge;
    if (challenge) this.save.city = challenge.city;
    this.loop(performance.now());
    await this.loadCity(this.save.city);
    this.showHome();
  }

  private loadingScreen(city: CityId, pct: number): void {
    const el = byId('loading');
    el.hidden = false;
    byId('loading-art').style.backgroundImage = `url(/art/${city}.jpg)`;
    byId('loading-text').textContent = `Getting ${cityById(city).name} ready`;
    byId('loading-bar').style.width = `${Math.round(pct)}%`;
    byId('loading-pct').textContent = `Loading / ${Math.round(pct)}%`;
  }

  /** Build a city's models, with the kit's loading screen while it happens. */
  private async loadCity(city: CityId): Promise<void> {
    if (this.streets.city === city) return;
    const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    this.state = this.state === 'loading' ? 'loading' : this.state;
    this.loadingScreen(city, 8);
    await frame();
    try {
      await document.fonts.ready;
    } catch {
      // Fonts are optional.
    }
    this.loadingScreen(city, 25);
    await frame();
    this.stage.setCity(city);
    this.streets.setCity(city);
    this.loadingScreen(city, 75);
    await frame();
    this.crowd.setCity(city);
    this.traffic.setCity(city, cityById(city).side, null);
    this.loadingScreen(city, 100);
    await frame();
    byId('loading').hidden = true;
  }

  // ---------- Showcase scene ----------
  private area(): AreaDef {
    return areaById(this.save.city, this.save.cities[this.save.city].area);
  }

  private vehicle(): VehicleId {
    return this.garagePick ?? this.save.cities[this.save.city].vehicle;
  }

  /** Put the selected vehicle on the selected area's street, cruising. */
  private stageShowcase(parked = false): void {
    const city = cityById(this.save.city);
    const def = VEHICLES[this.vehicle()];
    this.player.build(def, city.side);
    // Start just before the area's landmark when it has one, so Tower Bridge or the cathedral is in view.
    const area = this.area();
    this.show.layout = new Layout(area, START, true);
    const lm = area.landmarks[0];
    this.show.dist = START + (lm ? Math.max(30, lm.at - (lm.kind === 'tower-bridge' ? 260 : 120)) : 30);
    this.show.x = LANES[1];
    this.streets.start(this.show.layout, this.show.dist);
    this.crowd.clear();
    this.traffic.setCity(city.id, city.side, null);
    if (parked) this.traffic.clear();
    else this.traffic.reset(this.show.dist, this.showEnv(), 30);
    this.cam.mode = parked ? 'garage' : 'home';
    this.cam.snap(this.stage.camera, { x: this.show.x, l: def.l, h: def.h, rush: 0, shake: 0 });
  }

  private showEnv(): Parameters<Traffic['update']>[1] {
    const def = VEHICLES[this.vehicle()];
    return { dist: this.show.dist, playerX: this.show.x, playerL: def.l, playerW: def.w, playerV: this.state === 'garage' ? 0 : def.cruise * 0.8, cruise: def.cruise, density: 0.8, seed: 99 };
  }

  // ---------- Screens ----------
  private showHome(): void {
    this.endDriveScene();
    this.state = 'home';
    this.garagePick = null;
    this.stageShowcase();
    this.sound.playMusic(this.sound.available ? this.save.city : null);
    this.renderHome();
  }

  private renderHome(): void {
    const s = this.save;
    const city = cityById(s.city);
    const area = this.area();
    const day = this.today;
    const dailyBest = s.daily.day === day.day && s.daily.best !== null ? money(cityById(day.city).economy, s.daily.best) : null;
    const ch = this.challenge;
    this.screens.show(
      'home',
      homeHtml({
        vehicle: VEHICLES[this.vehicle()].name,
        place: `${city.name} / ${area.place}`,
        mode: s.mode,
        passengers: s.passengers,
        daily: { label: `${cityById(day.city).name} · ${areaById(day.city, day.area).place} · ${VEHICLES[day.vehicle].name}`, best: dailyBest },
        challenge: ch ? { text: `${ch.name} earned ${money(cityById(ch.city).economy, ch.score)} on ${areaById(ch.city, ch.area).name}${ch.day ? ` (daily drive, ${shortDate(ch.day)})` : ''}. Can you beat it?` } : null,
      }),
    );
  }

  private renderSetup(): void {
    const s = this.save;
    const city = cityById(s.city);
    this.screens.show(
      'setup',
      setupHtml({
        city: s.city,
        areas: city.areas.map((a) => {
          const best = s.bests[bestKey(s.city, a.id, s.mode)];
          return { id: a.id, name: a.name, blurb: a.blurb, best: best ? money(city.economy, best) : null };
        }),
        area: s.cities[s.city].area,
        mode: s.mode,
      }),
    );
  }

  private renderGarage(): void {
    const s = this.save;
    const city = cityById(s.city);
    const pick = this.vehicle();
    const def = VEHICLES[pick];
    const fleet = FLEETS[s.city].map((id) => ({ id, name: VEHICLES[id].name, thumb: this.thumbs.get(`${id}:${city.side}`, () => vehicleShape(VEHICLES[id], city.side)) }));
    this.screens.show(
      'garage',
      garageHtml({
        city: city.name,
        bank: money(city.economy, s.cities[s.city].bank),
        fleet,
        selected: pick,
        name: def.name,
        line: def.line,
        stats: [
          ['Speed', def.top / 38],
          ['Pick-up', def.accel / 8],
          ['Handling', def.steer / 7.5],
          ['Seats', def.seats / 16],
        ],
        facts: `${def.seats} seat${def.seats === 1 ? '' : 's'} · ${Math.round(def.top * 3.6)} km/h · ${def.health} health · fares ×${def.fareMult}`,
        inUse: pick === s.cities[s.city].vehicle,
      }),
    );
  }

  private renderPassengers(): void {
    const def = VEHICLES[this.vehicle()];
    this.screens.show('passengers', passengersHtml(this.save.passengers, `${def.seats} seat${def.seats === 1 ? '' : 's'} in the ${def.name}`));
  }

  private renderSettings(): void {
    const s = this.save.settings;
    this.screens.show('settings', settingsHtml({ music: s.music, sfx: s.sfx, reducedMotion: s.reducedMotion, graphics: s.graphics, inDrive: this.menuReturn === 'pause' }));
  }

  // ---------- Actions from screens ----------
  private action(a: string, v: string, _el: HTMLElement): void {
    this.sound.play('tap');
    const s = this.save;
    switch (a) {
      case 'setup':
        this.state = 'menu';
        this.renderSetup();
        break;
      case 'lagos':
        this.goLagos();
        break;
      case 'city':
        // Lagos is Wole Wole, its own game on its own page.
        if (v === 'lagos') this.goLagos();
        break;
      case 'area':
        s.cities[s.city].area = v;
        this.persist();
        this.stageShowcase();
        this.renderSetup();
        break;
      case 'mode':
        s.mode = v === 'endless' ? 'endless' : 'route';
        this.persist();
        if (this.screens.current === 'setup') this.renderSetup();
        else this.renderHome();
        break;
      case 'passengers':
        this.state = 'menu';
        this.renderPassengers();
        break;
      case 'pax':
        s.passengers = v === 'on';
        this.persist();
        this.renderPassengers();
        break;
      case 'howto':
        this.state = 'menu';
        this.screens.show('howto', howtoHtml(document.body.classList.contains('touch')));
        break;
      case 'practice':
        void this.startDrive(this.homeConfig(true));
        break;
      case 'garage':
        this.state = 'garage';
        this.garagePick = s.cities[s.city].vehicle;
        this.stageShowcase(true);
        this.renderGarage();
        break;
      case 'pick':
        this.pickVehicle(v as VehicleId);
        break;
      case 'use':
        if (this.garagePick) {
          s.cities[s.city].vehicle = this.garagePick;
          this.persist();
        }
        this.showHome();
        break;
      case 'settings':
        this.menuReturn = this.state === 'paused' ? 'pause' : 'home';
        if (this.menuReturn === 'home') this.state = 'menu';
        this.renderSettings();
        break;
      case 'graphics': {
        const g = v === 'high' || v === 'medium' || v === 'low' ? v : 'auto';
        s.settings.graphics = g;
        this.persist();
        this.applyQuality(g === 'auto' ? Stage.autoQuality() : g);
        this.renderSettings();
        break;
      }
      case 'motion':
        s.settings.reducedMotion = !s.settings.reducedMotion;
        this.persist();
        this.applyMotion();
        this.renderSettings();
        break;
      case 'tutorial':
        s.tutorialDone = false;
        this.persist();
        void this.startDrive(this.homeConfig(true));
        break;
      case 'back':
        if (this.screens.current === 'settings' && this.menuReturn === 'pause') this.screens.show('pause', pauseHtml());
        else if (this.state === 'garage' || this.screens.current === 'setup') this.showHome();
        else this.renderHome(), (this.state = 'home');
        break;
      case 'play':
        void this.startDrive(this.homeConfig(!s.tutorialDone));
        break;
      case 'daily':
        void this.startDrive({ city: this.today.city, area: this.today.area, mode: 'route', passengers: true, vehicle: this.today.vehicle, seed: this.today.seed, daily: this.today, challenge: null, tutorial: false });
        break;
      case 'challenge': {
        const c = this.challenge;
        if (!c) break;
        const daily = c.day === this.today.day && c.seed === this.today.seed ? this.today : null;
        void this.startDrive({ city: c.city, area: c.area, mode: c.mode, passengers: c.passengers, vehicle: c.vehicle, seed: c.seed, daily, challenge: c, tutorial: false });
        break;
      }
      case 'resume':
        this.screens.hide();
        this.state = 'resuming';
        this.resumeT = 3;
        break;
      case 'restart':
        if (this.config) void this.startDrive({ ...this.config, tutorial: false });
        break;
      case 'quit':
        this.finishDrive(true);
        this.toResults();
        break;
      case 'results':
        this.toResults();
        break;
      case 'again':
        if (this.last) void this.startDrive({ ...this.last.config, tutorial: false });
        break;
      case 'home':
        this.showHome();
        break;
      case 'share':
        void this.showShare();
        break;
      case 'send':
        void this.send();
        break;
      case 'save-card':
        this.saveCard();
        break;
      case 'copy-link':
        void this.copyLink();
        break;
      case 'retry-save':
        if (this.persist()) this.showResults();
        else this.saveFailed();
        break;
      case 'reload':
        window.location.reload();
        break;
    }
  }

  private input(id: string, value: string, el: HTMLInputElement): void {
    const s = this.save;
    if (id === 'music' || id === 'sfx') {
      const v = clamp(Number(value) / 100, 0, 1);
      s.settings[id] = v;
      el.style.setProperty('--fill', `${Math.round(v * 100)}%`);
      this.muted = false;
      this.sound.setLevels(s.settings.music, s.settings.sfx);
      if (id === 'music' && this.sound.available) this.sound.playMusic(s.city);
      this.persist();
    } else if (id === 'name') {
      s.name = value.replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 24);
      this.persist();
    }
  }

  /** Lagos is Wole Wole, a separate game on its own page. */
  private goLagos(): void {
    this.sound.playMusic(null);
    this.loadingScreen('london', 100);
    byId('loading-art').style.backgroundImage = 'url(art/lagos.jpg)';
    byId('loading-text').textContent = 'Off to Lagos: Wole Wole';
    window.location.href = new URL('lagos/', document.baseURI).href;
  }

  private pickVehicle(id: VehicleId): void {
    if (!FLEETS[this.save.city].includes(id)) return;
    this.garagePick = id;
    this.player.build(VEHICLES[id], cityById(this.save.city).side);
    this.renderGarage();
  }

  private homeConfig(tutorial: boolean): DriveConfig {
    const s = this.save;
    return { city: s.city, area: s.cities[s.city].area, mode: s.mode, passengers: s.passengers, vehicle: s.cities[s.city].vehicle, seed: null, daily: null, challenge: null, tutorial };
  }

  // ---------- Driving ----------
  private listener(): DriveListener {
    return {
      card: (card, seconds) => this.hud.card(card, seconds),
      pop: (text, tone) => this.hud.pop(text, tone),
      sound: (name: SoundName) => this.sound.play(name),
      damage: () => {
        this.hud.hurt();
        this.player.kick(0.9);
      },
      shout: (stop: string) => this.shout(stop),
    };
  }

  /** The bus announcement, as a double-decker nears a stop. */
  private shout(stop: string): void {
    const cfg = this.config;
    if (!cfg) return;
    const style = VEHICLES[cfg.vehicle].style;
    if (style === 'bus') {
      const line = LONDON_CALLS[Math.floor(Math.random() * LONDON_CALLS.length)] ?? '';
      this.hud.shout(line.replaceAll('{s}', stop));
    }
  }

  private async startDrive(cfg: DriveConfig): Promise<void> {
    this.screens.hide();
    this.endDriveScene();
    await this.loadCity(cfg.city);
    const city = cityById(cfg.city);
    const area = areaById(cfg.city, cfg.area);
    const vehicle = VEHICLES[cfg.vehicle];
    const seed = cfg.seed ?? Math.floor(Math.random() * 0xffffffff);
    this.config = cfg;
    this.gasSources.clear();
    this.brakeSources.clear();
    this.crowd.clear();
    this.traffic.setCity(cfg.city, city.side, cfg.vehicle);
    const drive = new Drive(
      { city, area, mode: cfg.mode, passengers: cfg.passengers, vehicle, seed, startDist: START, daily: cfg.daily, challenge: cfg.challenge, tutorial: cfg.tutorial },
      this.traffic,
      this.crowd,
      this.listener(),
    );
    this.drive = drive;
    this.streets.start(drive.layout, drive.dist);
    this.traffic.reset(drive.dist, { dist: drive.dist, playerX: drive.x, playerL: vehicle.l, playerW: vehicle.w, playerV: 0, cruise: vehicle.cruise, density: drive.density, seed }, 55);
    this.player.build(vehicle, city.side, Math.floor(seed % 5));
    this.cam.mode = 'drive';
    this.cam.snap(this.stage.camera, { x: drive.x, l: vehicle.l, h: vehicle.h, rush: 0, shake: 0 });
    this.hud.show(true);
    this.hud.clearCard();
    this.state = 'drive';
    this.endT = 0;
    this.shot = null;
    this.sound.unlock();
    this.sound.playMusic(this.sound.available ? cfg.city : null);
    this.sound.play('beep');
    if (!this.sound.available && !this.audioWarned) {
      this.audioWarned = true;
      this.hud.card({ title: 'MUSIC UNAVAILABLE', line: 'Keep driving. Retry in Settings.', tone: 'cream' }, 3);
    }
  }

  private endDriveScene(): void {
    this.drive?.dispose();
    this.drive = null;
    this.hud.show(false);
    this.sound.engineOff();
  }

  /** Called once a drive has ended (or was left from the pause menu): bank the money and build the results. */
  private finishDrive(quit: boolean): void {
    const d = this.drive;
    const cfg = this.config;
    if (!d || !cfg) return;
    if (quit) d.quit();
    const s = this.save;
    const city = cityById(cfg.city);
    const eco = city.economy;
    const earned = Math.max(0, Math.round(d.money / eco.step) * eco.step);
    const key = bestKey(cfg.city, cfg.area, cfg.daily ? 'daily' : cfg.mode);
    const prevBest = s.bests[key] ?? 0;
    s.bests[key] = Math.max(prevBest, earned);
    const cs = s.cities[cfg.city];
    const cityBest = cs.best;
    cs.bank += earned;
    cs.best = Math.max(cs.best, earned);
    cs.bestDist = Math.max(cs.bestDist, d.metres);
    s.stats.drives++;
    s.stats.delivered += d.stats.delivered;
    s.stats.metres += d.metres;
    s.stats.perfectStops += d.stats.perfectStops;
    if (cfg.tutorial && !d.tutorial) s.tutorialDone = true;
    if (cfg.tutorial && d.ended) s.tutorialDone = true;
    if (cfg.daily) {
      if (s.daily.day !== cfg.daily.day) s.daily = { day: cfg.daily.day, best: null, tries: 0 };
      s.daily.tries++;
      s.daily.best = Math.max(s.daily.best ?? 0, earned);
    }
    this.persist();
    const stats = d.driveStats();
    const advice = driveAdvice(stats);
    const rows: [string, string][] = [
      ['Best earnings', money(eco, Math.max(prevBest, earned))],
      ['Distance', distanceText(d.metres)],
    ];
    if (cfg.passengers) {
      rows.push(['Passengers delivered', String(d.stats.delivered)], ['Clean stops', String(d.stats.cleanStops)]);
      if (d.stats.perfectStops) rows.push(['Perfect stops', String(d.stats.perfectStops)]);
    } else rows.push(['Passenger service', 'Off'], ['Vehicle health', `${Math.max(0, d.health)} / ${d.setup.vehicle.health}`]);
    if (d.stats.closePasses) rows.push(['Close passes', String(d.stats.closePasses)]);
    let versus: ResultsModel['versus'] = null;
    const ch = cfg.challenge;
    if (ch) {
      const diff = earned - ch.score;
      versus = diff > 0 ? { text: `You beat ${ch.name} by ${money(eco, diff)}!`, ahead: true } : diff === 0 ? { text: `Dead heat with ${ch.name}!`, ahead: true } : { text: `${money(eco, -diff)} short of ${ch.name}. Go again!`, ahead: false };
    } else if (cfg.daily && s.daily.tries > 1) versus = { text: `Today’s best: ${money(eco, s.daily.best ?? earned)} after ${s.daily.tries} tries`, ahead: earned >= (s.daily.best ?? 0) };
    const results: ResultsModel = {
      amount: money(eco, earned),
      rows,
      advice,
      badge: earned > prevBest && earned > 0 ? (earned > cityBest ? `New ${city.name} best!` : 'New best!') : null,
      versus,
      again: cfg.daily || ch ? 'Try again' : 'Play again',
    };
    const statLine = cfg.passengers ? [`${d.stats.delivered} riders`, `${d.stats.cleanStops} clean stops`] : [`${d.stats.closePasses} close passes`, `${Math.max(0, d.health)}/${d.setup.vehicle.health} health`];
    this.last = { config: cfg, seed: d.setup.seed, money: earned, metres: d.metres, results, shot: this.shot, stats: statLine };
  }

  /** Leave the drive for the results screen (or the save warning). */
  private toResults(): void {
    if (this.drive) {
      this.endDriveScene();
      this.stageShowcaseAfterDrive();
    }
    if (!this.saveOk) this.saveFailed();
    else this.showResults();
  }

  /** After a drive the scene keeps rolling quietly behind the results. */
  private stageShowcaseAfterDrive(): void {
    this.stageShowcase();
    this.cam.mode = 'home';
  }

  private showResults(): void {
    const l = this.last;
    if (!l) return this.showHome();
    this.state = 'results';
    this.screens.show('results', resultsHtml(l.results));
  }

  private saveFailed(): void {
    const l = this.last;
    const eco = cityById(l?.config.city ?? 'london').economy;
    this.state = 'results';
    this.screens.show('modal', modalHtml('Result not saved', [`Your drive earned ${money(eco, l?.money ?? 0)}.`, 'Saving failed. Try again.'], [['retry-save', 'Retry save', true], ['results', 'Back to results', false]]));
  }

  // ---------- Sharing ----------
  private shareUrl(): string {
    const l = this.last;
    const base = `${window.location.origin}${window.location.pathname}`;
    if (!l) return base;
    const c = l.config;
    return `${base}?c=${encodeChallenge({ city: c.city, area: c.area, mode: c.mode, passengers: c.passengers, vehicle: c.vehicle, seed: l.seed, score: l.money, name: this.save.name || 'A friend', day: c.daily?.day ?? null })}`;
  }

  private async showShare(): Promise<void> {
    const l = this.last;
    if (!l) return;
    const c = l.config;
    const city = cityById(c.city);
    const canvas = await drawShareCard({
      shot: l.shot,
      city: city.name,
      area: areaById(c.city, c.area).name,
      vehicle: VEHICLES[c.vehicle].name,
      amount: money(city.economy, l.money),
      distance: distanceText(l.metres),
      stats: l.stats,
      name: this.save.name,
      badge: c.daily ? `Daily drive · ${shortDate(c.daily.day)}` : null,
      url: this.shareUrl(),
    });
    this.shareCanvas = canvas;
    this.state = 'share';
    this.screens.show('share', shareHtml({ image: canvas?.toDataURL('image/png') ?? '', name: this.save.name }));
  }

  private shareText(): string {
    const l = this.last;
    if (!l) return 'West Road Life';
    const city = cityById(l.config.city);
    return `I earned ${money(city.economy, l.money)} driving a ${VEHICLES[l.config.vehicle].name.toLowerCase()} in ${city.name} on West Road Life. Can you beat my drive?`;
  }

  private async send(): Promise<void> {
    // Redraw so the card carries the latest name.
    await this.showShareCanvasOnly();
    const blob = this.shareCanvas ? await canvasBlob(this.shareCanvas) : null;
    const result = await shareNative(blob, this.shareText(), this.shareUrl());
    if (result === 'unavailable')
      this.screens.show('modal', modalHtml('Sharing unavailable', ['Your result is ready.', 'Save the card or copy the link.'], [['save-card', 'Save result card', true], ['copy-link', 'Copy link', false], ['results', 'Back to results', false]]));
  }

  private async showShareCanvasOnly(): Promise<void> {
    const l = this.last;
    if (!l) return;
    const c = l.config;
    const city = cityById(c.city);
    this.shareCanvas = await drawShareCard({
      shot: l.shot,
      city: city.name,
      area: areaById(c.city, c.area).name,
      vehicle: VEHICLES[c.vehicle].name,
      amount: money(city.economy, l.money),
      distance: distanceText(l.metres),
      stats: l.stats,
      name: this.save.name,
      badge: c.daily ? `Daily drive · ${shortDate(c.daily.day)}` : null,
      url: this.shareUrl(),
    });
  }

  private saveCard(): void {
    const canvas = this.shareCanvas;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'west-road-life.png';
    a.click();
  }

  private async copyLink(): Promise<void> {
    const url = this.shareUrl();
    let ok = false;
    try {
      await navigator.clipboard.writeText(`${this.shareText()} ${url}`);
      ok = true;
    } catch {
      ok = false;
    }
    this.screens.show(
      'modal',
      modalHtml(ok ? 'Link copied' : 'Copy this link', ok ? ['Paste it to a friend in any chat.'] : [url], [['results', 'Back to results', true], ['save-card', 'Save result card', false]]),
    );
  }

  // ---------- Controls ----------
  readonly controls = {
    driving: (): boolean => this.state === 'drive' && this.drive?.phase !== 'countdown',
    lane: (dir: -1 | 1): void => this.drive?.steer(dir),
    gas: (source: string, on: boolean): void => {
      if (on) this.gasSources.add(source);
      else this.gasSources.delete(source);
    },
    brake: (source: string, on: boolean): void => {
      if (on) this.brakeSources.add(source);
      else this.brakeSources.delete(source);
    },
    pause: (): void => this.pause(),
    mute: (): void => {
      this.muted = !this.muted;
      const s = this.save.settings;
      this.sound.setLevels(this.muted ? 0 : s.music, this.muted ? 0 : s.sfx);
    },
    swipe: (dir: -1 | 1): void => {
      if (this.state !== 'garage') return;
      const fleet = FLEETS[this.save.city];
      const i = fleet.indexOf(this.vehicle());
      const next = fleet[(i + dir + fleet.length) % fleet.length];
      if (next) this.pickVehicle(next);
    },
    gesture: (): void => {
      if (this.sound.unlock()) this.sound.playMusic(this.state === 'loading' ? null : (this.config && this.drive ? this.config.city : this.save.city));
    },
  };

  private pause(): void {
    if (this.state !== 'drive' && this.state !== 'resuming') return;
    if (!this.drive || this.drive.ended) return;
    this.state = 'paused';
    this.gasSources.clear();
    this.brakeSources.clear();
    this.sound.engineOff();
    this.menuReturn = 'pause';
    this.screens.show('pause', pauseHtml());
  }

  // ---------- Frame loop ----------
  private loop(now: number): void {
    const interval = now - this.lastTime;
    const dt = Math.min(0.05, interval / 1000);
    this.lastTime = now;
    const t0 = performance.now();
    try {
      this.frame(dt);
    } catch (err) {
      console.error(err);
    }
    // Frame timings for profiling (?debug): main-thread work and time between frames.
    const p = this.timings;
    p.work[p.i % 240] = performance.now() - t0;
    p.gap[p.i % 240] = interval;
    p.i++;
    requestAnimationFrame((t) => this.loop(t));
  }
  private readonly timings = { i: 0, work: new Array<number>(240).fill(0), gap: new Array<number>(240).fill(0) };

  /** Profiling summary for ?debug tests: frame work and spacing, draw calls, triangles and GPU memory counts. */
  perfStats(): Record<string, number> {
    const n = Math.min(240, this.timings.i);
    const pick = (a: number[]): number[] => a.slice(0, n).sort((x, y) => x - y);
    const work = pick(this.timings.work);
    const gap = pick(this.timings.gap);
    const avg = (a: number[]): number => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    const pct = (a: number[], q: number): number => a[Math.min(a.length - 1, Math.floor(a.length * q))] ?? 0;
    const info = this.stage.renderer.info;
    return {
      frames: n,
      workAvgMs: +avg(work).toFixed(2),
      workP95Ms: +pct(work, 0.95).toFixed(2),
      gapAvgMs: +avg(gap).toFixed(1),
      gapP95Ms: +pct(gap, 0.95).toFixed(1),
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
    };
  }

  /** Clear the frame-time samples (start a fresh measurement). */
  perfReset(): void {
    this.timings.i = 0;
  }

  /** Apply a graphics tier everywhere it matters. */
  applyQuality(q: Quality): void {
    this.stage.setQuality(q);
    this.streets.ahead = TIERS[q].ahead;
    setSurfaceDetail(TIERS[q].detail);
    setReflections(null, q !== 'low');
    this.streets.setBuildingShadows(q === 'high');
  }

  /** Watch the frame rate while driving on Auto; step down a tier at a time if the device is struggling. */
  private perf = { t: 0, frames: 0, slow: 0 };
  private watchPerformance(dt: number): void {
    if (this.save.settings.graphics !== 'auto' || this.stage.quality === 'low' || this.state !== 'drive' || params.has('debug')) return;
    const p = this.perf;
    p.t += dt;
    p.frames++;
    if (p.t < 2) return;
    const fps = p.frames / p.t;
    p.slow = fps < 38 ? p.slow + 1 : 0;
    p.t = 0;
    p.frames = 0;
    if (p.slow >= 2) {
      p.slow = 0;
      this.applyQuality(this.stage.quality === 'high' ? 'medium' : 'low');
    }
  }

  private frame(dt: number): void {
    this.watchPerformance(dt);
    const d = this.drive;
    const reduce = this.save.settings.reducedMotion;
    if (d && (this.state === 'drive' || this.state === 'resuming' || this.state === 'end' || this.state === 'paused')) {
      if (this.state === 'resuming') {
        this.resumeT -= dt;
        if (this.resumeT <= 0) this.state = 'drive';
      }
      const running = this.state === 'drive' || this.state === 'end';
      if (running) {
        this.simulate(d, dt);
        this.player.update(dt, { speed: d.speed, vx: d.vx, ax: d.ax, accel: d.longAccel, doorOpen: d.doorOpen, reduceMotion: reduce });
        this.sound.engine(d.speed / d.setup.vehicle.top, d.gas, d.setup.vehicle.style);
        this.sound.brakes(d.brake && d.speed > 3 ? Math.min(1, -d.longAccel / d.setup.vehicle.brake) : 0);
      }
      this.player.group.position.set(d.x, 0, 0);
      this.player.group.visible = !(d.invuln > 0 && Math.floor(d.invuln * 10) % 2 === 1);
      this.stage.follow(d.dist, d.x, dt);
      this.streets.update(d.dist, dt);
      this.crowd.update(running ? dt : 0, reduce);
      const v = d.setup.vehicle;
      this.cam.update(this.stage.camera, dt, { x: d.x, l: v.l, h: v.h, rush: d.gas ? clamp((d.speed - v.cruise) / (v.top - v.cruise), 0, 1) : 0, shake: d.shake, accel: running ? d.longAccel : 0 });
      this.renderHud(d);
      this.hud.tick(running ? dt : 0);
      if (running) this.checkEnd(d, dt);
    } else {
      // Home, menus and garage: the showcase keeps cruising.
      const def = VEHICLES[this.vehicle()];
      const moving = this.state !== 'garage' && this.state !== 'loading';
      const speed = moving ? def.cruise * 0.8 : 0;
      this.show.dist += speed * dt;
      if (this.show.layout) {
        this.traffic.update(dt, this.showEnv());
        this.streets.update(this.show.dist, dt);
      }
      this.player.group.position.set(this.show.x, 0, 0);
      this.player.group.visible = true;
      this.player.update(dt, { speed, vx: 0, ax: 0, accel: 0, doorOpen: false, reduceMotion: reduce });
      this.crowd.update(dt, reduce);
      this.stage.follow(this.show.dist, this.show.x, dt);
      this.cam.update(this.stage.camera, dt, { x: this.show.x, l: def.l, h: def.h, rush: 0, shake: 0 });
    }
    this.contactShadows();
    this.stage.render();
    if (this.wantShot) {
      this.wantShot = false;
      this.shot = this.capture();
    }
  }

  /**
   * Advance the drive in fixed 1/120 s steps, whatever the frame rate, so speed, braking distance, lane changes and
   * collisions behave the same at 30 and 60 frames a second.
   */
  private simulate(d: Drive, dt: number): void {
    const STEP = 1 / 120;
    d.gas = this.gasSources.size > 0;
    d.brake = this.brakeSources.size > 0;
    this.simAcc = Math.min(this.simAcc + dt, 0.25);
    while (this.simAcc >= STEP) {
      d.update(STEP);
      this.simAcc -= STEP;
    }
  }
  private simAcc = 0;

  /** The drive has ended: let it roll a moment, take a picture for the share card, then show the result. */
  private checkEnd(d: Drive, dt: number): void {
    if (!d.ended || this.state !== 'drive') return;
    this.endT += dt;
    if (this.endT > 1.1 && !this.shot) this.wantShot = true;
    if (this.endT > 1.4 && (this.shot || this.endT > 2.5)) {
      this.finishDrive(false);
      this.state = 'end';
      this.hud.show(false);
      this.screens.show('end', endHtml({ complete: d.ended === 'complete', amount: money(d.eco, d.money) }));
    }
  }

  /** Contact shadows for everything that moves, placed in the world's frame. */
  private contactShadows(): void {
    const b = this.blobs;
    b.begin();
    const d = this.drive;
    const def = d ? d.setup.vehicle : VEHICLES[this.vehicle()];
    const dist = d ? d.dist : this.show.dist;
    const x = d ? d.x : this.show.x;
    if (this.player.group.visible || d) b.add(x, dist, 0, def.w * 1.3, def.l * 1.12);
    for (const c of this.traffic.cars) if (!c.flung) b.add(c.x, c.d, 0, c.w * 1.3, c.l * 1.12, c.mesh.rotation.y);
    for (const p of this.crowd.people) b.add(p.x, p.d, 0.16, 0.75, 0.75);
    b.end();
  }

  /** Small JPEG of the current frame for the share card. */
  private capture(): string | null {
    try {
      const src = this.stage.renderer.domElement;
      const w = 720;
      const h = Math.round((src.height / src.width) * w);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')?.drawImage(src, 0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.86);
    } catch {
      return null;
    }
  }

  private renderHud(d: Drive): void {
    const cfg = this.config;
    if (!cfg) return;
    const city = cityById(cfg.city);
    const counting = d.phase === 'countdown' || this.state === 'resuming';
    const count = d.phase === 'countdown' ? Math.max(1, Math.ceil(d.count)) : this.state === 'resuming' ? Math.max(1, Math.ceil(this.resumeT)) : null;
    this.hud.render({
      money: money(city.economy, d.money),
      place: `${city.name} / ${cfg.daily ? 'Daily' : cfg.mode === 'route' ? 'Route' : 'Endless'}`,
      health: Math.max(0, d.health),
      healthMax: d.setup.vehicle.health,
      passengers: cfg.passengers,
      onboard: d.riders.length,
      seats: d.seats,
      next: d.nextName,
      distance: cfg.mode === 'route' ? `To finish ${distanceText(d.toFinish)}` : `Distance ${distanceText(d.metres)}`,
      gasHeld: d.gas && !d.brake,
      progress: d.phase === 'stopped' ? d.visitProgress : null,
      count: counting ? count : null,
      countText: this.state === 'resuming' ? 'Get ready to resume' : d.setup.tutorial ? 'Practice drive' : 'Ready to drive?',
      step: d.tutorial,
      target: cfg.challenge ? `Beat ${cfg.challenge.name} · ${money(city.economy, cfg.challenge.score)}` : null,
    });
    const hint = document.body.classList.contains('touch') ? 'Hold road to speed up' : '← → lanes · ↑ gas · ↓ brake · P pause';
    const hintEl = byId('h-hint');
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
    if (count !== null && count !== this.lastCount) this.sound.play('beep');
    if (count === null && this.lastCount !== null && d.phase === 'drive') this.sound.play('go');
    this.lastCount = count;
  }
  private lastCount: number | null = null;

  /** Run the simulation forward quickly without drawing (?debug tests on slow software renderers). */
  fastForward(seconds: number): void {
    const steps = Math.ceil(seconds * 30);
    for (let i = 0; i < steps; i++) this.frameSim(1 / 30);
  }

  private frameSim(dt: number): void {
    const d = this.drive;
    if (!d || (this.state !== 'drive' && this.state !== 'end')) return;
    this.simulate(d, dt);
    this.checkEnd(d, dt);
    this.stage.follow(d.dist, d.x, dt);
    this.streets.update(d.dist, dt);
    this.crowd.update(dt, true);
    this.hud.tick(dt);
  }

  /** Debug summary for automated tests (?debug). */
  debug(): Record<string, unknown> {
    const d = this.drive;
    return {
      state: this.state,
      city: this.save.city,
      phase: d?.phase,
      dist: d ? Math.round(d.dist - d.layout.runStart) : null,
      speed: d ? Math.round(d.speed * 3.6) : null,
      slot: d?.slot,
      money: d ? Math.round(d.money) : null,
      health: d?.health,
      riders: d?.riders.length,
      cars: this.traffic.cars.length,
      people: this.crowd.people.length,
      kinds: this.streets.activeKinds(),
      calls: this.stage.renderer.info.render.calls,
      tris: this.stage.renderer.info.render.triangles,
    };
  }

  /** Quick list of cities for debug tools. */
  static cities(): readonly string[] {
    return CITIES.map((c) => c.id);
  }
}
