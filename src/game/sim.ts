import {
  clampToRoom,
  currentRoom,
  markRoomClear,
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
import { equipItem } from './loot.js';
import { saveMeta, startRun } from './state.js';
import type { GameState, InputState } from './types.js';

export { startRun, createGameState, createGameStateNode, createInput } from './state.js';
export { equipItem } from './loot.js';
export { buildDungeon, spawnRoomEnemies, currentRoom } from './dungeon.js';
export { damageActor, playerStrike, playerBolt, dist } from './combat.js';

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
    return state;
  }

  // playing
  state.time += t;
  if (state.messageT > 0) state.messageT = Math.max(0, state.messageT - t);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - t * 1.8);
  state.dashCd = Math.max(0, state.dashCd - t);
  state.strikeCd = Math.max(0, state.strikeCd - t);
  state.boltCd = Math.max(0, state.boltCd - t);
  state.invuln = Math.max(0, state.invuln - t);
  state.focus = Math.min(state.maxFocus, state.focus + 6 * t);

  updatePlayer(state, input, t);
  updateEnemies(state, t);
  updateProjectiles(state, t);
  updatePickups(state, t);

  if (input.interact) {
    input.interact = false;
    tryAdvanceRoom(state);
  }

  markRoomClear(state);
  state.enemies = state.enemies.filter((e) => e.alive || e.hitFlash > 0);

  return state;
}

function updatePlayer(state: GameState, input: InputState, dt: number): void {
  const p = state.player;
  if (!p.alive) return;

  let mx = 0;
  let mz = 0;
  if (input.up) mz -= 1;
  if (input.down) mz += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
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
  const p = state.player;
  const room = currentRoom(state);

  for (const e of state.enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.attackCd = Math.max(0, e.attackCd - dt);
    if (!e.alive || !p.alive) continue;

    const d = dist(e.x, e.z, p.x, p.z);
    if (d < 14 || e.aggro || e.isBoss) e.aggro = true;
    if (!e.aggro) continue;

    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const dl = Math.hypot(dx, dz) || 1;
    let ux = dx / dl;
    let uz = dz / dl;

    // boss orbits sometimes
    if (e.isBoss && d < 5) {
      const tx = -uz;
      const tz = ux;
      ux = ux * 0.25 + tx * 0.75;
      uz = uz * 0.25 + tz * 0.75;
      const n = Math.hypot(ux, uz) || 1;
      ux /= n;
      uz /= n;
    }

    e.facing = Math.atan2(uz, ux);
    if (d > e.attackRange * 0.85) {
      e.x += ux * e.speed * dt;
      e.z += uz * e.speed * dt;
    }
    const c = clampToRoom(e.x, e.z, room, e.radius);
    e.x = c.x;
    e.z = c.z;

    if (d <= e.attackRange + p.radius && e.attackCd <= 0) {
      e.attackCd = e.isBoss ? 0.9 : 1.1;
      damageActor(state, p, e.damage, false);
      state.invuln = Math.max(state.invuln, 0.35);
    }
  }
}

function updatePickups(state: GameState, dt: number): void {
  const p = state.player;
  for (const pk of state.pickups) {
    pk.life -= dt;
    const d = dist(pk.x, pk.z, p.x, p.z);
    if (d < 1.2) {
      state.inventory.push(pk.item);
      // auto-equip if slot empty
      if (!state.equipped[pk.item.slot]) {
        equipItem(state, pk.item.id);
      }
      state.message = `+ ${pk.item.name}`;
      state.messageT = 1.4;
      pk.life = 0;
    }
  }
  state.pickups = state.pickups.filter((pk) => pk.life > 0);
}

export function stepFor(state: GameState, input: InputState, seconds: number, fps = 60): void {
  const frame = 1 / fps;
  const n = Math.ceil(seconds * fps);
  for (let i = 0; i < n; i++) step(state, input, frame);
}
