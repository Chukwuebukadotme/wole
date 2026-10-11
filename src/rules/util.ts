/** Random source in [0, 1). Injected so rules stay testable. */
export type Rng = () => number;

export const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rand = (lo: number, hi: number, rng: Rng = Math.random): number => lo + rng() * (hi - lo);
export const randInt = (lo: number, hi: number, rng: Rng = Math.random): number => Math.floor(rand(lo, hi + 1, rng));
export const mod = (value: number, size: number): number => ((value % size) + size) % size;

/** Pick one item; the list must not be empty. */
export function pick<T>(items: readonly T[], rng: Rng = Math.random): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick() needs a non-empty list');
  return item;
}

/** Pick by relative weight; entries with weight <= 0 are never chosen. */
export function weighted<T>(entries: ReadonlyArray<readonly [T, number]>, rng: Rng = Math.random): T {
  const usable = entries.filter(([, w]) => w > 0);
  const total = usable.reduce((sum, [, w]) => sum + w, 0);
  if (usable.length === 0 || total <= 0) throw new Error('weighted() needs a positive weight');
  let r = rng() * total;
  for (const [value, w] of usable) {
    r -= w;
    if (r < 0) return value;
  }
  const last = usable[usable.length - 1];
  if (!last) throw new Error('unreachable');
  return last[0];
}

/** Small seeded generator for repeatable layouts. */
export function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
