import { clampToRoom, currentRoom, markRoomClear } from './dungeon.js';
import { grantXp, rollItem } from './loot.js';
import { nextRng } from './rng.js';
import type { Actor, GameState, Projectile } from './types.js';

let projSeq = 1;

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
    // enemy death
    state.kills += 1;
    const xp = target.isBoss ? 120 : target.kind === 'wretch' ? 28 : target.kind === 'bone' ? 18 : 12;
    grantXp(state, xp);
    state.gold += target.isBoss ? 80 : 4 + Math.floor(nextRng(state) * 6);

    // loot drop chance
    const dropChance = target.isBoss ? 1 : 0.35;
    if (nextRng(state) < dropChance) {
      const item = rollItem(state, target.isBoss ? 3 : 0);
      state.pickups.push({
        id: `pk_${++projSeq}`,
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
  state.strikeCd = 0.32;
  const range = p.attackRange;
  const arc = 0.95;
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
    damageActor(state, e, p.damage, true);
    // knock lightly
    e.x += Math.cos(ang) * 0.35;
    e.z += Math.sin(ang) * 0.35;
    hit = true;
  }
  return hit;
}

export function playerBolt(state: GameState): boolean {
  if (state.boltCd > 0) return false;
  if (state.focus < 12) return false;
  state.focus -= 12;
  state.boltCd = 0.45;
  const p = state.player;
  const speed = 18;
  const pr: Projectile = {
    id: `bolt_${++projSeq}`,
    x: p.x + Math.cos(p.facing) * 0.8,
    z: p.z + Math.sin(p.facing) * 0.8,
    vx: Math.cos(p.facing) * speed,
    vz: Math.sin(p.facing) * speed,
    life: 1.2,
    damage: p.damage * 0.85 + 4,
    radius: 0.25,
    owner: 'player',
  };
  state.projectiles.push(pr);
  return true;
}

export function tryDash(state: GameState, dx: number, dz: number): boolean {
  if (state.dashCd > 0) return false;
  if (state.focus < 8) return false;
  const len = Math.hypot(dx, dz) || 1;
  const p = state.player;
  p.x += (dx / len) * 3.2;
  p.z += (dz / len) * 3.2;
  const c = clampToRoom(p.x, p.z, currentRoom(state), p.radius);
  p.x = c.x;
  p.z = c.z;
  state.dashCd = 0.75;
  state.focus -= 8;
  state.invuln = 0.22;
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
        pr.life = 0;
      }
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.life > 0);
}
