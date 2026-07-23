import type { GameState } from './types.js';

/** Mulberry32 — deterministic, stored on state */
export function nextRng(state: { rng: number }): number {
  let t = (state.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(state: { rng: number }, min: number, max: number): number {
  return min + nextRng(state) * (max - min);
}

export function randInt(state: { rng: number }, min: number, maxInclusive: number): number {
  return Math.floor(randRange(state, min, maxInclusive + 1));
}

export function pick<T>(state: { rng: number }, arr: readonly T[]): T {
  return arr[Math.floor(nextRng(state) * arr.length)]!;
}

export function hashSeed(n: number): number {
  return (n >>> 0) || 0x51a7e;
}

export type RngState = Pick<GameState, 'rng'>;
