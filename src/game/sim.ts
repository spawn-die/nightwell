import {
  clampToRoom,
  currentRoom,
  markRoomClear,
  nearForwardExit,
  tryAdvanceRoom,
} from './dungeon.js';
import {
  damageActor,
  dist,
  playerBolt,
  playerStrike,
  tryDash,
  updateProjectiles,
} from './combat.js';
import { updateEnemyCombat, beginWindup, WINDUP } from './enemies.js';
import { equipItem, tryAutoEquip, itemScore } from './loot.js';
import { screenToWorldMove } from './cameraBasis.js';
import { saveMeta, startRun } from './state.js';
import type { GameState, InputState } from './types.js';

export { startRun, createGameState, createGameStateNode, createInput } from './state.js';
export { equipItem, tryAutoEquip, itemScore } from './loot.js';
export {
  buildDungeon,
  spawnRoomEnemies,
  currentRoom,
  tryAdvanceRoom,
  nearForwardExit,
} from './dungeon.js';
export { damageActor, playerStrike, playerBolt, dist } from './combat.js';
export { updateEnemyCombat, beginWindup, WINDUP } from './enemies.js';
export { screenToWorldMove, CAM_FORWARD, CAM_RIGHT } from './cameraBasis.js';

/**
 * Fixed-step simulation. Pure logic — no Three.js.
 */
export function step(state: GameState, input: InputState, dt: number): GameState {
  const t = Math.max(0, Math.min(0.05, dt));

  if (state.phase === 'title') {
    if (input.start) {
      input.start = false;
      startRun(state);
    }
    return state;
  }

  if (state.phase === 'won' || state.phase === 'lost') {
    saveMeta(state.meta);
    if (input.start) {
      input.start = false;
      startRun(state);
    }
    return state;
  }

  if (input.toggleInv) {
    input.toggleInv = false;
    state.phase = state.phase === 'inventory' ? 'playing' : 'inventory';
  }

  if (state.phase === 'inventory') {
    tickFloaters(state, t);
    return state;
  }

  // Hitstop: freeze combat briefly for punchy kills/interrupts
  if (state.hitstop > 0) {
    state.hitstop = Math.max(0, state.hitstop - t);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - t * 12);
    tickFloaters(state, t);
    return state;
  }

  // playing
  state.time += t;
  if (state.messageT > 0) state.messageT = Math.max(0, state.messageT - t);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - t * 1.8);
  if (state.comboTimer > 0) {
    state.comboTimer = Math.max(0, state.comboTimer - t);
    if (state.comboTimer <= 0) state.combo = 0;
  }
  state.dashCd = Math.max(0, state.dashCd - t);
  state.strikeCd = Math.max(0, state.strikeCd - t);
  state.boltCd = Math.max(0, state.boltCd - t);
  state.invuln = Math.max(0, state.invuln - t);
  state.focus = Math.min(state.maxFocus, state.focus + 6 * t);
  tickFloaters(state, t);

  updatePlayer(state, input, t);
  updateEnemies(state, t);
  updateProjectiles(state, t);
  updatePickups(state, t);

  if (input.interact) {
    input.interact = false;
    tryAdvanceRoom(state);
  }

  markRoomClear(state);
  // Auto-descend when standing in the open +Z portal (no need to hunt for E).
  if (state.phase === 'playing' && nearForwardExit(state)) {
    tryAdvanceRoom(state);
  }

  state.enemies = state.enemies.filter((e) => e.alive || e.hitFlash > 0);

  return state;
}

function updatePlayer(state: GameState, input: InputState, dt: number): void {
  const p = state.player;
  if (!p.alive) return;

  // Screen-space stick: W = screen-up, D = screen-right (matches isometric camera)
  let sx = 0;
  let sz = 0;
  if (input.up) sz += 1;
  if (input.down) sz -= 1;
  if (input.right) sx += 1;
  if (input.left) sx -= 1;
  const stickLen = Math.hypot(sx, sz);
  let mx = 0;
  let mz = 0;
  if (stickLen > 0) {
    sx /= stickLen;
    sz /= stickLen;
    const world = screenToWorldMove(sx, sz);
    mx = world.x;
    mz = world.z;
    p.vx = mx * p.speed;
    p.vz = mz * p.speed;
  } else {
    p.vx *= 0.75;
    p.vz *= 0.75;
  }

  if (input.dash) {
    input.dash = false;
    tryDash(state, mx || Math.cos(p.facing), mz || Math.sin(p.facing));
  }

  p.x += p.vx * dt;
  p.z += p.vz * dt;
  const c = clampToRoom(p.x, p.z, currentRoom(state), p.radius);
  p.x = c.x;
  p.z = c.z;

  // face aim
  const adx = input.aimX - p.x;
  const adz = input.aimZ - p.z;
  if (adx !== 0 || adz !== 0) p.facing = Math.atan2(adz, adx);

  if (input.strike) {
    input.strike = false;
    playerStrike(state);
  }
  if (input.bolt) {
    input.bolt = false;
    playerBolt(state);
  }

  p.hitFlash = Math.max(0, p.hitFlash - dt);
}

function updateEnemies(state: GameState, dt: number): void {
  for (const e of state.enemies) {
    updateEnemyCombat(state, e, dt);
  }
}

function updatePickups(state: GameState, dt: number): void {
  const p = state.player;
  for (const pk of state.pickups) {
    pk.life -= dt;
    const d = dist(pk.x, pk.z, p.x, p.z);
    // stronger magnet when close
    if (d < 3.5 && d > 0.15) {
      const pull = (3.5 - d) * 4 * dt;
      pk.x += ((p.x - pk.x) / d) * pull;
      pk.z += ((p.z - pk.z) / d) * pull;
    }
    if (d < 1.25) {
      state.inventory.push(pk.item);
      const equipped = tryAutoEquip(state, pk.item);
      state.message = equipped ? `EQUIP ${pk.item.name}` : `+ ${pk.item.name}`;
      state.messageT = 1.5;
      state.fxQueue.push({ kind: 'hit', x: pk.x, z: pk.z, color: 0xffd166, amount: 0 });
      pk.life = 0;
    }
  }
  state.pickups = state.pickups.filter((pk) => pk.life > 0);
}

function tickFloaters(state: GameState, dt: number): void {
  for (const f of state.floaters) {
    f.life -= dt;
    // rise in world-Y is handled in HUD; track vy for vertical screen motion
    f.vy *= 0.98;
  }
  state.floaters = state.floaters.filter((f) => f.life > 0);
}

export function stepFor(state: GameState, input: InputState, seconds: number, fps = 60): void {
  const frame = 1 / fps;
  const n = Math.ceil(seconds * fps);
  for (let i = 0; i < n; i++) step(state, input, frame);
}
