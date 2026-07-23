import { buildDungeon, spawnRoomEnemies } from './dungeon.js';
import { recomputePlayerStats } from './loot.js';
import { hashSeed } from './rng.js';
import type { GameState, InputState } from './types.js';

const META_KEY = 'nightwell-meta-v1';

export function loadMeta(): GameState['meta'] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { bestKills: 0, runs: 0, wellbornSlain: 0 };
    return { ...{ bestKills: 0, runs: 0, wellbornSlain: 0 }, ...JSON.parse(raw) };
  } catch {
    return { bestKills: 0, runs: 0, wellbornSlain: 0 };
  }
}

export function saveMeta(meta: GameState['meta']): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function createInput(): InputState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    strike: false,
    bolt: false,
    dash: false,
    interact: false,
    toggleInv: false,
    aimX: 0,
    aimZ: 4,
    start: false,
  };
}

export function createGameState(seed = Date.now() >>> 0): GameState {
  const meta = typeof localStorage !== 'undefined' ? loadMeta() : { bestKills: 0, runs: 0, wellbornSlain: 0 };
  const state: GameState = {
    phase: 'title',
    seed: hashSeed(seed),
    rng: hashSeed(seed),
    time: 0,
    roomIndex: 0,
    rooms: [],
    player: {
      id: 'player',
      kind: 'player',
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      facing: 0,
      radius: 0.55,
      hp: 100,
      maxHp: 100,
      damage: 12,
      speed: 7.2,
      attackCd: 0,
      attackRange: 2.1,
      hitFlash: 0,
      alive: true,
    },
    enemies: [],
    projectiles: [],
    pickups: [],
    inventory: [],
    equipped: { weapon: null, armor: null, relic: null },
    level: 1,
    xp: 0,
    xpToLevel: 40,
    gold: 0,
    kills: 0,
    focus: 50,
    maxFocus: 50,
    dashCd: 0,
    strikeCd: 0,
    boltCd: 0,
    invuln: 0,
    message: '',
    messageT: 0,
    shake: 0,
    runId: `run_${seed.toString(36)}`,
    fxQueue: [],
    meta,
  };
  return state;
}

export function startRun(state: GameState, seed?: number): void {
  const s = seed ?? (Date.now() >>> 0);
  const meta = state.meta;
  const fresh = createGameState(s);
  Object.assign(state, fresh);
  state.meta = meta;
  state.phase = 'playing';
  buildDungeon(state);
  const room = state.rooms[0]!;
  state.player.x = room.cx;
  state.player.z = room.cz;
  recomputePlayerStats(state);
  state.player.hp = state.player.maxHp;
  state.focus = state.maxFocus;
  spawnRoomEnemies(state, room);
  state.message = 'SLAY THE SHADES · THEN ENTER THE GATE';
  state.messageT = 3.5;
}

/** Node-safe meta for tests */
export function createGameStateNode(seed = 0xc011): GameState {
  const state = createGameState(seed);
  state.meta = { bestKills: 0, runs: 0, wellbornSlain: 0 };
  return state;
}
