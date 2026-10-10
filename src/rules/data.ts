// Game data for Wole Wole. All names, numbers and dialogue are original to this game.
// Stop names are real Lagos places; distances between them are invented.

// ---------- Road geometry ----------
export const TILE = 30;
export const LANES = 4;
export const KERB = 3;
export const LANE_W = 3.2;
export const ROAD_W = LANES * LANE_W;
export const KERB_X = ROAD_W / 2;
export const laneX = (lane: number): number => (lane - (LANES - 1) / 2) * LANE_W;

export const TUNING = {
  speedStart: 13,
  speedMax: 28,
  speedRamp: 0.1,
  accel: 6.5,
  coast: 5,
  brake: 19,
  parkBelow: 2.2,
  hopV: 8.5,
  gravity: 24,
  zoneBefore: 14,
  zoneAfter: 16,
  baseSeats: 12,
  baseBody: 3,
  baseTank: 40,
  litresPerMetre: 1 / 120,
  pumpRate: 7,
  fareBase: 150,
  farePerKm: 250,
  noteValue: 20,
  clockRate: 0.05,
  wardenFine: 500,
  brtFine: 1500,
  toll: 200,
  changeSeconds: 7,
} as const;

// ---------- Routes ----------
export type StretchKind = 'city' | 'market' | 'bridge' | 'expressway';
export interface Stretch {
  readonly from: number;
  readonly to: number;
  readonly kind: StretchKind;
  readonly name: string;
  readonly brt?: boolean;
}
export interface StopDef {
  readonly at: number;
  readonly name: string;
  readonly busy: number;
}
export type RouteId = 'ikorodu' | 'mainland' | 'lekki';
export interface RouteDef {
  readonly id: RouteId;
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly blurb: string;
  readonly length: number;
  readonly unlockLevel: number;
  readonly fareScale: number;
  readonly stretches: readonly Stretch[];
  readonly stops: readonly StopDef[];
  readonly stations: readonly number[];
  readonly junctions: readonly number[];
  readonly tolls: readonly number[];
  readonly brtCameras: readonly number[];
}

export const ROUTES: readonly RouteDef[] = [
  {
    id: 'ikorodu',
    name: 'Ikorodu Road',
    from: 'Mile 12',
    to: 'Fadeyi',
    blurb: 'Market crowds at Mile 12, then a long run down Ikorodu Road with a BRT corridor.',
    length: 4200,
    unlockLevel: 1,
    fareScale: 1,
    stretches: [
      { from: 0, to: 600, kind: 'market', name: 'Mile 12 Market' },
      { from: 600, to: 2580, kind: 'city', name: 'Ikorodu Road' },
      { from: 2580, to: 3420, kind: 'expressway', name: 'Ikorodu Road BRT corridor', brt: true },
      { from: 3420, to: 4200, kind: 'city', name: 'Ikorodu Road' },
    ],
    stops: [
      { at: 150, name: 'Mile 12', busy: 5 },
      { at: 690, name: 'Ketu', busy: 4 },
      { at: 1230, name: 'Ojota', busy: 4 },
      { at: 1800, name: 'Maryland', busy: 5 },
      { at: 2340, name: 'Anthony', busy: 2 },
      { at: 2910, name: 'Obanikoro', busy: 2 },
      { at: 3390, name: 'Palmgrove', busy: 3 },
      { at: 3780, name: 'Onipanu', busy: 3 },
      { at: 4110, name: 'Fadeyi', busy: 4 },
    ],
    stations: [990, 3060],
    junctions: [1530, 3600],
    tolls: [],
    brtCameras: [2760, 3180],
  },
  {
    id: 'mainland',
    name: 'Third Mainland',
    from: 'Ebute Metta',
    to: 'CMS',
    blurb: 'Fill up before the long bridge over the lagoon, then fight Island traffic to CMS.',
    length: 5100,
    unlockLevel: 3,
    fareScale: 1.15,
    stretches: [
      { from: 0, to: 1020, kind: 'city', name: 'Ebute Metta' },
      { from: 1020, to: 3420, kind: 'bridge', name: 'Third Mainland Bridge' },
      { from: 3420, to: 4380, kind: 'city', name: 'Lagos Island' },
      { from: 4380, to: 5100, kind: 'market', name: 'Balogun Market' },
    ],
    stops: [
      { at: 150, name: 'Ebute Metta', busy: 4 },
      { at: 600, name: 'Oyingbo', busy: 5 },
      { at: 3570, name: 'Adeniji Adele', busy: 3 },
      { at: 4050, name: 'Idumota', busy: 5 },
      { at: 4560, name: 'Balogun', busy: 5 },
      { at: 4980, name: 'CMS', busy: 4 },
    ],
    stations: [870, 3780],
    junctions: [3870],
    tolls: [],
    brtCameras: [],
  },
  {
    id: 'lekki',
    name: 'Lekki Express',
    from: 'Lekki Phase 1',
    to: 'Ajah',
    blurb: 'Fast expressway, a toll gate and the Ajah market crush at the end. Fares pay more here.',
    length: 5400,
    unlockLevel: 6,
    fareScale: 1.3,
    stretches: [
      { from: 0, to: 4620, kind: 'expressway', name: 'Lekki–Epe Expressway' },
      { from: 4620, to: 5400, kind: 'market', name: 'Ajah Market' },
    ],
    stops: [
      { at: 150, name: 'Lekki Phase 1', busy: 4 },
      { at: 1380, name: 'Ikate', busy: 3 },
      { at: 1920, name: 'Chisco', busy: 3 },
      { at: 2430, name: 'Agungi', busy: 2 },
      { at: 2940, name: 'Jakande', busy: 3 },
      { at: 3600, name: 'Chevron', busy: 4 },
      { at: 4230, name: 'VGC', busy: 2 },
      { at: 5040, name: 'Ajah', busy: 5 },
    ],
    stations: [2160, 3900],
    junctions: [3270],
    tolls: [720],
    brtCameras: [],
  },
];

// ---------- Passengers ----------
export type PaxKind = 'regular' | 'trader' | 'student' | 'worker' | 'preacher' | 'baba' | 'hawker' | 'guest';
export interface PaxType {
  readonly kind: PaxKind;
  readonly label: string;
  readonly seats: number;
  readonly fareMult: number;
  readonly boardTime: number;
  readonly weight: number;
  readonly perk: string;
  readonly color: string;
}
export const PAX: Readonly<Record<PaxKind, PaxType>> = {
  regular: { kind: 'regular', label: 'Passenger', seats: 1, fareMult: 1, boardTime: 0.35, weight: 5, perk: 'Pays the normal fare.', color: '#d2c9b4' },
  trader: { kind: 'trader', label: 'Market woman', seats: 2, fareMult: 1.8, boardTime: 0.8, weight: 2, perk: 'Her basin takes two seats; she pays almost double.', color: '#f46036' },
  student: { kind: 'student', label: 'Student', seats: 1, fareMult: 0.6, boardTime: 0.22, weight: 2, perk: 'Quick to board, pays student fare.', color: '#3c91e6' },
  worker: { kind: 'worker', label: 'Office worker', seats: 1, fareMult: 1.2, boardTime: 0.3, weight: 2, perk: 'In a hurry: arrive in time for a 50% tip.', color: '#2e294e' },
  preacher: { kind: 'preacher', label: 'Preacher', seats: 1, fareMult: 0.8, boardTime: 0.4, weight: 0.6, perk: 'While aboard, one crash will not break your streak.', color: '#fafafa' },
  baba: { kind: 'baba', label: 'Baba', seats: 1, fareMult: 1, boardTime: 0.9, weight: 1, perk: 'Doubles his fare if the ride is smooth: no crashes, no potholes.', color: '#9b5de5' },
  hawker: { kind: 'hawker', label: 'Hawker', seats: 1, fareMult: 0.8, boardTime: 0.45, weight: 1, perk: 'Sells snacks on board: other fares tip 10% while she rides.', color: '#1b998b' },
  guest: { kind: 'guest', label: 'Owambe guest', seats: 1, fareMult: 2, boardTime: 0.5, weight: 0, perk: 'Out after dark in aso-ebi; pays double.', color: '#d4ac0d' },
};
export const PAX_KINDS = Object.keys(PAX) as PaxKind[];

// ---------- Dialogue (original lines in Nigerian Pidgin and Yoruba) ----------
export const CALLS: readonly ((stop: string) => string)[] = [
  (n) => `${n}! ${n}! Oya enter!`,
  (n) => `${n}, seats dey! No dull yourself!`,
  (n) => `Who dey go ${n}? Come, come!`,
  (n) => `${n} straight! Wole, wole!`,
];
export const OWA: readonly ((stop: string) => string)[] = [
  (n) => `Owa o! ${n} dey here!`,
  (n) => `Driver, I dey drop for ${n}!`,
  (n) => `${n}! Make I come down!`,
];
export const LINES = {
  missed: ['Driver! You pass my stop o!', 'Ah ah! Na where you dey carry me?', 'You no hear me? Na back I go trek now!'],
  crash: ['Ehen! Gently o!', 'Panel beater go chop today!', 'Driver, your eye dey where?'],
  full: ['We don full! No stopping!', 'Full load! Make we move!'],
  honk: ['Okada don comot!', 'Keke shift for you!'],
  pothole: ['Pothole! My waist o!', 'Gently! Na road be this?'],
  scare: ['Hey! You wan kill person?', 'Driver, slow down for people!', 'Ah! Mind am!'],
  wardenStop: ['Warden don raise hand. Stop!', 'Hold am! Warden say stop!'],
  wardenFine: ['Oga warden don catch you!', 'Fine don land. Na your pocket.'],
  wardenGo: ['Warden don wave. Oya go!'],
  brtFine: ['BRT camera don snap you!', 'That lane no be your own o!'],
  brtBehind: ['BRT bus dey come behind!', 'Commot for BRT lane!'],
  hawker: ['Gala! Pure water! Plantain chips!', 'Buy your groundnut!', 'Cold Zobo! Cold Zobo!'],
  changeOk: ['Correct change. You sabi!', 'Thank you conductor!', 'Change complete. No wahala.'],
  changeBad: ['Conductor, where my change?', 'You wan chop my money?', 'Count am well!'],
  fuelLow: ['Fuel dey go down o!', 'Find filling station sharp sharp!'],
  rainStart: ['Rain don start! Everybody dey find bus!', 'Rain! Close window!'],
  preacher: ['God bless this driver!', 'Your streak is covered, my son!'],
  baba: ['Smooth ride. Take extra.', 'You drive like my late brother. Well done.'],
  worker: ['On time! Take tip!', 'You save my job today!'],
  workerLate: ['My oga go vex. I don late.', 'Na because of you I late!'],
  toll: ['Toll paid. Oya pass.', 'Gate don open.'],
  tollCrash: ['You jam the toll gate!', 'Ah! That barrier cost money!'],
  stationFull: ['Tank full. Oya road!'],
  stationBroke: ['Money no reach for more fuel.'],
  night: ['Night don fall. Headlights on.'],
} as const;

// ---------- Garage ----------
export interface PaintDef {
  readonly id: string;
  readonly name: string;
  readonly body: number;
  readonly stripe: number;
  readonly roof: number;
  readonly price: number;
  readonly level: number;
}
export const PAINTS: readonly PaintDef[] = [
  { id: 'eko', name: 'Eko Yellow', body: 0xf6b800, stripe: 0x141414, roof: 0xefe7d2, price: 0, level: 1 },
  { id: 'lagoon', name: 'Lagoon Blue', body: 0x2e86c1, stripe: 0xf4f4f4, roof: 0xdfe8ee, price: 3000, level: 1 },
  { id: 'garri', name: 'Garri Cream', body: 0xf3e5ab, stripe: 0x7b3f00, roof: 0xfaf3d9, price: 4000, level: 2 },
  { id: 'asoebi', name: 'Aso-Ebi Purple', body: 0x6c3483, stripe: 0xf1c40f, roof: 0xe8daef, price: 6000, level: 2 },
  { id: 'eagles', name: 'Super Eagles Green', body: 0x008751, stripe: 0xffffff, roof: 0xe9f7ef, price: 8000, level: 3 },
  { id: 'oshodi', name: 'Oshodi Red', body: 0xb03a2e, stripe: 0x141414, roof: 0xf2d7d5, price: 10000, level: 4 },
  { id: 'night', name: 'Third Mainland Night', body: 0x1c2833, stripe: 0xf6b800, roof: 0x2c3e50, price: 15000, level: 5 },
  { id: 'chairman', name: 'Chairman Gold', body: 0xc9a227, stripe: 0x2c2c2c, roof: 0xf7e9b0, price: 30000, level: 7 },
];
export interface StickerDef {
  readonly id: string;
  readonly text: string;
  readonly price: number;
  readonly level: number;
}
export const STICKERS: readonly StickerDef[] = [
  { id: 'permanent', text: 'NO CONDITION IS PERMANENT', price: 0, level: 1 },
  { id: 'small', text: 'SMALL SMALL', price: 1500, level: 1 },
  { id: 'eyes', text: 'EYES ON THE ROAD', price: 2000, level: 1 },
  { id: 'prayer', text: "MAMA'S PRAYER", price: 2500, level: 2 },
  { id: 'shine', text: 'SHINE YOUR EYE', price: 3000, level: 2 },
  { id: 'roadlife', text: 'ROAD NA LIFE', price: 3500, level: 3 },
  { id: 'express', text: 'WOLE WOLE EXPRESS', price: 5000, level: 4 },
  { id: 'eko', text: 'EKO O NI BAJE', price: 6000, level: 5 },
];
export type HornId = 'classic' | 'trumpet' | 'tune' | 'bass';
export interface HornDef {
  readonly id: HornId;
  readonly name: string;
  readonly price: number;
  readonly level: number;
}
export const HORNS: readonly HornDef[] = [
  { id: 'classic', name: 'Two-tone', price: 0, level: 1 },
  { id: 'trumpet', name: 'Trumpet triad', price: 2500, level: 2 },
  { id: 'bass', name: 'Trailer bass', price: 4000, level: 3 },
  { id: 'tune', name: 'Owambe tune', price: 6000, level: 4 },
];
export type UpgradeId = 'tank' | 'brakes' | 'body' | 'seats';
export interface UpgradeDef {
  readonly id: UpgradeId;
  readonly name: string;
  readonly effect: string;
  readonly prices: readonly number[];
}
export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'tank', name: 'Bigger tank', effect: '+10 litres per level', prices: [3000, 7000, 12000] },
  { id: 'brakes', name: 'New brake pads', effect: '+15% braking per level', prices: [4000, 9000] },
  { id: 'body', name: 'Panel beating', effect: '+1 bodywork per level', prices: [8000, 16000] },
  { id: 'seats', name: 'Extra bench', effect: '+2 seats per level', prices: [6000, 14000] },
];

// ---------- Missions ----------
export type MissionEvent =
  | 'deliver'
  | 'earnRun'
  | 'change'
  | 'refuel'
  | 'bridge'
  | 'traderDelivered'
  | 'nightMetres'
  | 'cleanRun'
  | 'honkClear'
  | 'wardenObey'
  | 'notesRun'
  | 'streak'
  | 'hawkerSale'
  | 'toll'
  | 'rainDeliver';
export interface MissionDef {
  readonly id: MissionEvent;
  /** "run": progress resets each run. "total": progress carries across runs. */
  readonly scope: 'run' | 'total';
  /** "sum": events add up. "max": the best single value counts. */
  readonly mode: 'sum' | 'max';
  readonly minLevel: number;
  readonly target: (level: number) => number;
  readonly text: (target: number) => string;
}
export const MISSIONS: readonly MissionDef[] = [
  { id: 'deliver', scope: 'total', mode: 'sum', minLevel: 1, target: (l) => 10 + 5 * l, text: (n) => `Deliver ${n} passengers` },
  { id: 'earnRun', scope: 'run', mode: 'max', minLevel: 1, target: (l) => 3000 + 1500 * l, text: (n) => `Earn ₦${n.toLocaleString('en-NG')} in one run` },
  { id: 'change', scope: 'total', mode: 'sum', minLevel: 1, target: (l) => 5 + 2 * l, text: (n) => `Give correct change ${n} times` },
  { id: 'refuel', scope: 'total', mode: 'sum', minLevel: 1, target: () => 1, text: () => 'Refuel at a filling station' },
  { id: 'bridge', scope: 'total', mode: 'sum', minLevel: 3, target: () => 1, text: () => 'Cross the Third Mainland Bridge' },
  { id: 'traderDelivered', scope: 'total', mode: 'sum', minLevel: 1, target: (l) => 2 + l, text: (n) => `Deliver ${n} market women` },
  { id: 'nightMetres', scope: 'total', mode: 'sum', minLevel: 2, target: (l) => 1000 + 400 * l, text: (n) => `Drive ${(n / 1000).toFixed(1)} km after dark` },
  { id: 'cleanRun', scope: 'run', mode: 'max', minLevel: 1, target: (l) => 800 + 300 * l, text: (n) => `Drive ${n} m without a crash` },
  { id: 'honkClear', scope: 'total', mode: 'sum', minLevel: 1, target: (l) => 3 + l, text: (n) => `Clear ${n} okadas or kekes with your horn` },
  { id: 'wardenObey', scope: 'total', mode: 'sum', minLevel: 1, target: (l) => 2 + l, text: (n) => `Stop for the traffic warden ${n} times` },
  { id: 'notesRun', scope: 'run', mode: 'sum', minLevel: 1, target: (l) => 15 + 5 * l, text: (n) => `Collect ${n} ₦20 notes in one run` },
  { id: 'streak', scope: 'run', mode: 'max', minLevel: 1, target: (l) => (l < 3 ? 2 : l < 6 ? 2.5 : 3), text: (n) => `Reach a ×${n} fare streak` },
  { id: 'hawkerSale', scope: 'total', mode: 'sum', minLevel: 1, target: (l) => 3 + l, text: (n) => `Let passengers buy from ${n} hawkers` },
  { id: 'toll', scope: 'total', mode: 'sum', minLevel: 6, target: () => 1, text: () => 'Pay the Lekki toll' },
  { id: 'rainDeliver', scope: 'total', mode: 'sum', minLevel: 2, target: (l) => 3 + l, text: (n) => `Deliver ${n} passengers in the rain` },
];

// ---------- Daily events (weekday in West Africa Time) ----------
export type WeatherPlan = 'normal' | 'harmattan' | 'rainy';
export interface DayEvent {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly startHour: number;
  readonly trafficMult: number;
  readonly fareMult: number;
  readonly nightFareMult: number;
  readonly fuelPrice: number;
  readonly weather: WeatherPlan;
  readonly paxBoost: Partial<Record<PaxKind, number>>;
  readonly crowdMult: number;
  readonly pedestrianMult: number;
  readonly hawkerMult: number;
  readonly festive: boolean;
}
const BASE_EVENT = {
  startHour: 6.5,
  trafficMult: 1,
  fareMult: 1,
  nightFareMult: 1,
  fuelPrice: 80,
  weather: 'normal' as WeatherPlan,
  paxBoost: {},
  crowdMult: 1,
  pedestrianMult: 1,
  hawkerMult: 1,
  festive: false,
};
export const WEEKDAY_EVENTS: readonly DayEvent[] = [
  { ...BASE_EVENT, id: 'church', name: 'Church Sunday', line: 'Quiet roads, preachers everywhere, early start.', startHour: 7, trafficMult: 0.7, paxBoost: { preacher: 4 } },
  { ...BASE_EVENT, id: 'rush', name: 'Monday Rush', line: 'Office workers in a hurry and heavy traffic. Fares +10%.', startHour: 6, trafficMult: 1.3, fareMult: 1.1, paxBoost: { worker: 3 } },
  { ...BASE_EVENT, id: 'harmattan', name: 'Harmattan Tuesday', line: 'Dusty haze all day. Shine your eye.', startHour: 7, weather: 'harmattan' },
  { ...BASE_EVENT, id: 'market', name: 'Market Wednesday', line: 'Traders with basins, crowds crossing, hawkers on every lane.', paxBoost: { trader: 3 }, pedestrianMult: 2, hawkerMult: 2 },
  { ...BASE_EVENT, id: 'fuel', name: 'Fuel Queue Thursday', line: 'Fuel costs more. Fares +25% to match.', fuelPrice: 130, fareMult: 1.25 },
  { ...BASE_EVENT, id: 'owambe', name: 'Owambe Friday', line: 'Start late, party guests after dark pay extra.', startHour: 16, nightFareMult: 1.3, paxBoost: { guest: 4 } },
  { ...BASE_EVENT, id: 'rain', name: 'Rainy Saturday', line: 'Showers all day: slippery brakes, bigger crowds, fares +15%.', weather: 'rainy', fareMult: 1.15, crowdMult: 1.4 },
];
export const INDEPENDENCE: DayEvent = {
  ...BASE_EVENT,
  id: 'independence',
  name: 'Independence Day',
  line: 'Green-white-green on every street. Fares +50%.',
  fareMult: 1.5,
  festive: true,
};
