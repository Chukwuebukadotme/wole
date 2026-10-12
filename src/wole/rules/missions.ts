import { MISSIONS, type MissionDef, type MissionEvent } from './data.ts';
import type { MissionState } from './progress.ts';
import { pick, type Rng } from './util.ts';

export const ACTIVE_MISSIONS = 3;

export function missionDef(id: MissionEvent): MissionDef {
  const def = MISSIONS.find((m) => m.id === id);
  if (!def) throw new Error(`Unknown mission ${id}`);
  return def;
}

export const missionText = (m: MissionState): string => missionDef(m.id).text(m.target);
export const missionDone = (m: MissionState): boolean => m.progress >= m.target;

export function newMission(level: number, rng: Rng, exclude: readonly MissionEvent[]): MissionState {
  const eligible = MISSIONS.filter((m) => m.minLevel <= level);
  const fresh = eligible.filter((m) => !exclude.includes(m.id));
  const def = pick(fresh.length > 0 ? fresh : eligible, rng);
  return { id: def.id, target: def.target(level), progress: 0, reward: 500 + 300 * level, xp: 100 + 20 * level };
}

/** Top the list up to three distinct missions. */
export function fillMissions(missions: MissionState[], level: number, rng: Rng): void {
  while (missions.length < ACTIVE_MISSIONS) missions.push(newMission(level, rng, missions.map((m) => m.id)));
}

/** Run-scoped missions start from zero each run. */
export function startRun(missions: MissionState[]): void {
  for (const m of missions) if (missionDef(m.id).scope === 'run' && !missionDone(m)) m.progress = 0;
}

/** Record progress; returns missions that became complete with this event. */
export function applyEvent(missions: readonly MissionState[], event: MissionEvent, value: number): MissionState[] {
  const completed: MissionState[] = [];
  for (const m of missions) {
    if (m.id !== event || missionDone(m)) continue;
    m.progress = missionDef(m.id).mode === 'sum' ? m.progress + value : Math.max(m.progress, value);
    if (missionDone(m)) completed.push(m);
  }
  return completed;
}

/** Remove completed missions, refill, and return the rewards earned. */
export function claim(missions: MissionState[], level: number, rng: Rng): { bank: number; xp: number; count: number } {
  let bank = 0;
  let xp = 0;
  let count = 0;
  for (let i = missions.length - 1; i >= 0; i--) {
    const m = missions[i];
    if (m && missionDone(m)) {
      bank += m.reward;
      xp += m.xp;
      count++;
      missions.splice(i, 1);
    }
  }
  fillMissions(missions, level, rng);
  return { bank, xp, count };
}
