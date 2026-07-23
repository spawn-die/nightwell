import { clampToRoom, currentRoom, markRoomClear } from './dungeon.js';
import { nextId } from './ids.js';
import { grantXp, rollItem } from './loot.js';
import { nextRng } from './rng.js';
import type { Actor, GameState, Projectile } from './types.js';

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.sqrt(dist2(ax, az, bx, bz));
}

export function damageActor(
  state: GameState,
  target: Actor,
  amount: number,
  fromPlayer: boolean,
): boolean {
  if (!target.alive) return false;
  if (target.kind === 'player' && state.invuln > 0) return false;

  target.hp -= amount;
  target.hitFlash = 0.12;
  state.shake = Math.min(0.55, state.shake + (target.isBoss ? 0.25 : 0.08));
  state.fxQueue.push({
    kind: target.hp <= 0 ? 'death' : 'hit',
    x: target.x,
    z: target.z,
    color: target.isBoss ? 0xc77dff : target.kind === 'player' ? 0xff4d6d : 0xff88aa,
  });

  // Melee/bolt hits interrupt enemy telegraphs (dash-through-windup reward)
  if (fromPlayer && target.kind !== 'player' && (target.windup ?? 0) > 0) {
    target.windup = 0;
    target.windupMax = 0;
    target.stun = 0.55;
    target.attackCd = Math.max(target.attackCd, 0.4);
    target.attackStyle = undefined;
    state.fxQueue.push({ kind: 'interrupt', x: target.x, z: target.z, color: 0xffe066 });
    state.message = 'INTERRUPTED';
    state.messageT = 0.65;
  }

  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    if (target.kind === 'player') {
      state.phase = 'lost';
      state.message = 'CLAIMED';
      state.messageT = 99;
      state.meta.runs += 1;
      return true;
    }
    state.kills += 1;
    const xp = target.isBoss ? 120 : target.kind === 'wretch' ? 28 : target.kind === 'bone' ? 18 : 12;
    grantXp(state, xp);
    state.gold += target.isBoss ? 80 : 4 + Math.floor(nextRng(state) * 6);

    const dropChance = target.isBoss ? 1 : 0.4;
    if (nextRng(state) < dropChance) {
      const item = rollItem(state, target.isBoss ? 3 : 0);
      state.pickups.push({
        id: nextId('pk'),
        x: target.x,
        z: target.z,
        item,
        life: 45,
      });
      state.message = item.name;
      state.messageT = 1.6;
    }

    if (target.isBoss) {
      state.phase = 'won';
      state.meta.wellbornSlain += 1;
      state.meta.bestKills = Math.max(state.meta.bestKills, state.kills);
      state.meta.runs += 1;
    }

    markRoomClear(state);
    return true;
  }
  return false;
}

export function playerStrike(state: GameState): boolean {
  if (state.strikeCd > 0) return false;
  const p = state.player;
  state.strikeCd = 0.28;
  const range = p.attackRange;
  const arc = 1.05;
  state.fxQueue.push({
    kind: 'slash',
    x: p.x + Math.cos(p.facing) * 1.1,
    z: p.z + Math.sin(p.facing) * 1.1,
    color: 0x9bffea,
  });
  let hit = false;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist(p.x, p.z, e.x, e.z);
    if (d > range + e.radius) continue;
    const ang = Math.atan2(e.z - p.z, e.x - p.x);
    let diff = ang - p.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > arc) continue;
    // bonus damage vs winding enemies
    const bonus = (e.windup ?? 0) > 0 ? 1.25 : 1;
    damageActor(state, e, p.damage * bonus, true);
    e.x += Math.cos(ang) * 0.45;
    e.z += Math.sin(ang) * 0.45;
    hit = true;
  }
  return hit;
}

export function playerBolt(state: GameState): boolean {
  if (state.boltCd > 0) return false;
  if (state.focus < 10) return false;
  state.focus -= 10;
  state.boltCd = 0.38;
  const p = state.player;
  const speed = 20;
  const pr: Projectile = {
    id: nextId('bolt'),
    x: p.x + Math.cos(p.facing) * 0.8,
    z: p.z + Math.sin(p.facing) * 0.8,
    vx: Math.cos(p.facing) * speed,
    vz: Math.sin(p.facing) * speed,
    life: 1.3,
    damage: p.damage * 0.9 + 5,
    radius: 0.28,
    owner: 'player',
  };
  state.projectiles.push(pr);
  state.fxQueue.push({ kind: 'bolt', x: pr.x, z: pr.z, color: 0x6ec8ff });
  return true;
}

export function tryDash(state: GameState, dx: number, dz: number): boolean {
  if (state.dashCd > 0) return false;
  if (state.focus < 7) return false;
  const len = Math.hypot(dx, dz) || 1;
  const p = state.player;
  p.x += (dx / len) * 3.6;
  p.z += (dz / len) * 3.6;
  const c = clampToRoom(p.x, p.z, currentRoom(state), p.radius);
  p.x = c.x;
  p.z = c.z;
  state.dashCd = 0.7;
  state.focus -= 7;
  state.invuln = 0.32; // usable dodge through telegraphs
  state.fxQueue.push({ kind: 'dash', x: p.x, z: p.z, color: 0x5ce1ff });
  return true;
}

export function updateProjectiles(state: GameState, dt: number): void {
  for (const pr of state.projectiles) {
    pr.x += pr.vx * dt;
    pr.z += pr.vz * dt;
    pr.life -= dt;
    if (pr.owner === 'player') {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(pr.x, pr.z, e.x, e.z) <= pr.radius + e.radius) {
          damageActor(state, e, pr.damage, true);
          pr.life = 0;
          break;
        }
      }
    } else if (state.player.alive) {
      if (dist(pr.x, pr.z, state.player.x, state.player.z) <= pr.radius + state.player.radius) {
        damageActor(state, state.player, pr.damage, false);
        state.invuln = Math.max(state.invuln, 0.2);
        pr.life = 0;
      }
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.life > 0);
}
