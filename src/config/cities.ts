// Cities, areas and their stretches of road. Stop and street names are real places; the distances between them are invented.

export type CityId = 'london' | 'lagos';

/** Scenery theme for a stretch of road. */
export type Theme =
  | 'london-street'
  | 'london-warehouse'
  | 'london-quay'
  | 'london-bridge'
  | 'lagos-marina'
  | 'lagos-island'
  | 'lagos-market'
  | 'lagos-ikeja'
  | 'lagos-vi'
  | 'lagos-lagoon';

export interface Stretch {
  readonly from: number;
  readonly to: number;
  readonly theme: Theme;
  readonly name: string;
}

export interface StopDef {
  /** Centre of the bay, metres from the start of the area. */
  readonly at: number;
  readonly name: string;
  /** How many people usually wait, 1–6. */
  readonly busy: number;
}

export type LandmarkKind = 'tower-bridge' | 'cathedral';

export interface Landmark {
  readonly kind: LandmarkKind;
  /** Metres from the start of the area. */
  readonly at: number;
}

export interface AreaDef {
  readonly id: string;
  readonly city: CityId;
  readonly name: string;
  /** Short place name for the home-screen pill, e.g. "TOWER BRIDGE". */
  readonly place: string;
  readonly blurb: string;
  /** Route mode ends here; endless mode keeps going. */
  readonly length: number;
  readonly stretches: readonly Stretch[];
  readonly stops: readonly StopDef[];
  readonly landmarks: readonly Landmark[];
}

export interface Economy {
  readonly symbol: '£' | '₦';
  /** Pay for every kilometre driven at cruising speed. */
  readonly perKm: number;
  /** Bonus for passing traffic close at speed. */
  readonly closePass: number;
  /** Bonus for each kilometre without damage. */
  readonly cleanKm: number;
  /** Fare for one rider, plus a little for every stop ridden. */
  readonly fareBase: number;
  readonly farePerStop: number;
  /** Money is shown and paid in steps of this size. */
  readonly step: number;
}

export interface CityDef {
  readonly id: CityId;
  readonly name: string;
  /** Side of the road with the kerb and the stopping bays: London drives on the left, Lagos on the right. */
  readonly side: -1 | 1;
  readonly economy: Economy;
  readonly areas: readonly AreaDef[];
}

export const LONDON: CityDef = {
  id: 'london',
  name: 'London',
  side: -1,
  economy: { symbol: '£', perKm: 60, closePass: 3, cleanKm: 20, fareBase: 5, farePerStop: 2, step: 1 },
  areas: [
    {
      id: 'river-run',
      city: 'london',
      name: 'London River Run',
      place: 'Tower Bridge',
      blurb: 'Over Tower Bridge and along the South Bank',
      length: 3300,
      stretches: [
        { from: 0, to: 430, theme: 'london-street', name: 'Tower Hill' },
        { from: 430, to: 820, theme: 'london-bridge', name: 'Tower Bridge' },
        { from: 820, to: 1720, theme: 'london-street', name: 'Tooley Street' },
        { from: 1720, to: 2380, theme: 'london-quay', name: 'Bankside' },
        { from: 2380, to: 3300, theme: 'london-street', name: 'Southwark Street' },
      ],
      stops: [
        { at: 240, name: 'Tower Hill', busy: 4 },
        { at: 1000, name: 'Tooley Street', busy: 4 },
        { at: 1440, name: 'London Bridge', busy: 6 },
        { at: 1980, name: 'Bankside', busy: 3 },
        { at: 2620, name: 'Southwark', busy: 4 },
        { at: 3100, name: 'Blackfriars', busy: 5 },
      ],
      landmarks: [{ kind: 'tower-bridge', at: 625 }],
    },
    {
      id: 'wapping',
      city: 'london',
      name: 'Wapping Streets',
      place: 'Wapping',
      blurb: 'Old warehouses beside the Thames',
      length: 3200,
      stretches: [
        { from: 0, to: 720, theme: 'london-warehouse', name: 'St Katharine Docks' },
        { from: 720, to: 1500, theme: 'london-quay', name: 'Wapping High Street' },
        { from: 1500, to: 2200, theme: 'london-warehouse', name: 'Shadwell' },
        { from: 2200, to: 3200, theme: 'london-street', name: 'Narrow Street' },
      ],
      stops: [
        { at: 220, name: 'St Katharine Docks', busy: 4 },
        { at: 900, name: 'Wapping', busy: 3 },
        { at: 1350, name: 'Wapping Wall', busy: 3 },
        { at: 1780, name: 'Shadwell Basin', busy: 4 },
        { at: 2500, name: 'Limehouse', busy: 5 },
        { at: 3000, name: 'Westferry', busy: 4 },
      ],
      landmarks: [],
    },
    {
      id: 'bridge-approach',
      city: 'london',
      name: 'Bridge Approach',
      place: 'Bermondsey',
      blurb: 'From Bermondsey over the bridge to Whitechapel',
      length: 3000,
      stretches: [
        { from: 0, to: 900, theme: 'london-street', name: 'Bermondsey Street' },
        { from: 900, to: 1290, theme: 'london-bridge', name: 'Tower Bridge' },
        { from: 1290, to: 2100, theme: 'london-street', name: 'Tower Hill' },
        { from: 2100, to: 3000, theme: 'london-street', name: 'Whitechapel Road' },
      ],
      stops: [
        { at: 220, name: 'Bermondsey', busy: 4 },
        { at: 660, name: 'Shad Thames', busy: 3 },
        { at: 1480, name: 'Tower Hill', busy: 5 },
        { at: 1900, name: 'Aldgate', busy: 6 },
        { at: 2350, name: 'Whitechapel', busy: 5 },
        { at: 2820, name: 'Stepney Green', busy: 3 },
      ],
      landmarks: [{ kind: 'tower-bridge', at: 1095 }],
    },
  ],
};

export const LAGOS: CityDef = {
  id: 'lagos',
  name: 'Lagos',
  side: 1,
  economy: { symbol: '₦', perKm: 3000, closePass: 150, cleanKm: 1000, fareBase: 250, farePerStop: 100, step: 50 },
  areas: [
    {
      id: 'marina',
      city: 'lagos',
      name: 'Marina City Drive',
      place: 'Lagos Island',
      blurb: 'The Marina, Broad Street and Balogun Market',
      length: 3400,
      stretches: [
        { from: 0, to: 820, theme: 'lagos-marina', name: 'Marina' },
        { from: 820, to: 1620, theme: 'lagos-island', name: 'Broad Street' },
        { from: 1620, to: 2420, theme: 'lagos-market', name: 'Balogun Market' },
        { from: 2420, to: 3400, theme: 'lagos-island', name: 'Obalende' },
      ],
      stops: [
        { at: 200, name: 'CMS', busy: 6 },
        { at: 640, name: 'Marina', busy: 4 },
        { at: 1020, name: 'Broad Street', busy: 4 },
        { at: 1420, name: 'Tinubu Square', busy: 3 },
        { at: 1800, name: 'Balogun', busy: 6 },
        { at: 2220, name: 'Idumota', busy: 6 },
        { at: 2680, name: 'Obalende', busy: 5 },
        { at: 3160, name: 'TBS', busy: 3 },
      ],
      landmarks: [{ kind: 'cathedral', at: 420 }],
    },
    {
      id: 'ikeja',
      city: 'lagos',
      name: 'Ikeja Avenue Drive',
      place: 'Ikeja',
      blurb: 'Allen Avenue and Computer Village',
      length: 3300,
      stretches: [
        { from: 0, to: 900, theme: 'lagos-ikeja', name: 'Allen Avenue' },
        { from: 900, to: 1620, theme: 'lagos-market', name: 'Computer Village' },
        { from: 1620, to: 2600, theme: 'lagos-ikeja', name: 'Obafemi Awolowo Way' },
        { from: 2600, to: 3300, theme: 'lagos-ikeja', name: 'Ikeja GRA' },
      ],
      stops: [
        { at: 200, name: 'Allen Junction', busy: 5 },
        { at: 640, name: 'Opebi', busy: 4 },
        { at: 1100, name: 'Computer Village', busy: 6 },
        { at: 1460, name: 'Ikeja Along', busy: 6 },
        { at: 1880, name: 'Alausa', busy: 4 },
        { at: 2320, name: 'Toyin Street', busy: 4 },
        { at: 2800, name: 'Ikeja GRA', busy: 3 },
        { at: 3140, name: 'Oba Akran', busy: 4 },
      ],
      landmarks: [],
    },
    {
      id: 'victoria-island',
      city: 'lagos',
      name: 'Victoria Island Drive',
      place: 'Victoria Island',
      blurb: 'Glass towers, palms and the lagoon',
      length: 3400,
      stretches: [
        { from: 0, to: 1000, theme: 'lagos-vi', name: 'Ahmadu Bello Way' },
        { from: 1000, to: 1700, theme: 'lagos-lagoon', name: 'Ozumba Mbadiwe' },
        { from: 1700, to: 2500, theme: 'lagos-vi', name: 'Adeola Odeku' },
        { from: 2500, to: 3400, theme: 'lagos-market', name: 'Falomo' },
      ],
      stops: [
        { at: 200, name: 'Bar Beach', busy: 4 },
        { at: 640, name: 'Ahmadu Bello', busy: 4 },
        { at: 1180, name: 'Ozumba Mbadiwe', busy: 3 },
        { at: 1560, name: 'Lagoon Front', busy: 3 },
        { at: 1880, name: 'Adeola Odeku', busy: 5 },
        { at: 2300, name: 'Akin Adesola', busy: 4 },
        { at: 2720, name: 'Falomo', busy: 6 },
        { at: 3160, name: 'Awolowo Road', busy: 5 },
      ],
      landmarks: [],
    },
  ],
};

export const CITIES: readonly CityDef[] = [LONDON, LAGOS];

export function cityById(id: CityId): CityDef {
  return id === 'london' ? LONDON : LAGOS;
}

export function areaById(city: CityId, id: string): AreaDef {
  const areas = cityById(city).areas;
  const found = areas.find((a) => a.id === id) ?? areas[0];
  if (!found) throw new Error(`City ${city} has no areas`);
  return found;
}

/** Stretch at an area-local position; positions wrap every lap in endless mode. */
export function stretchAt(area: AreaDef, local: number): Stretch {
  const x = ((local % area.length) + area.length) % area.length;
  const found = area.stretches.find((s) => x >= s.from && x < s.to);
  const fallback = area.stretches[area.stretches.length - 1];
  if (!fallback) throw new Error(`Area ${area.id} has no stretches`);
  return found ?? fallback;
}

/** Bridges carry no buildings and no stops. */
export const isBridge = (theme: Theme): boolean => theme === 'london-bridge';
