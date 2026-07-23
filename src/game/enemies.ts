/**
 * Enemy combat pacing: telegraphs, interruptible windups, varied AI, boss phases.
 * Pure sim — imported by sim.ts and unit tests.
 */
import { clampToRoom, currentRoom } from './dungeon.js';
import { damageActor, dist } from './combat.js';
import { nextId } from './ids.js';
import type { Actor, AttackStyle, GameState, Projectile } from './types.js';

/** Long telegraphs — red danger disks must be readable before damage lands */
export const WINDUP = {
  shade: 0.85,
  bone: 0.95,
  wretch: 1.15,
  wellbornMelee: 1.0,
  wellbornSlam: 1.35,
  wellbornBolt: 0.9,
} as const;

/** Begin a telegraphed attack if in range and not already winding up / stunned. */
export function beginWindup(e: Actor, style: AttackStyle, duration: number): void {
  if ((e.windup ?? 0) > 0 || (e.stun ?? 0) > 0) return;
  e.windup = duration;
  e.windupMax = duration;
  e.attackStyle = style;
}

function fireEnemyBolt(state: GameState, e: Actor, speed = 11): void {
  const p = state.player;
  const dx = p.x - e.x;
  const dz = p.z - e.z;
  const len = Math.hypot(dx, dz) || 1;
  const pr: Projectile = {
    id: nextId('ebolt'),
    x: e.x + (dx / len) * (e.radius + 0.3),
    z: e.z + (dz / len) * (e.radius + 0.3),
    vx: (dx / len) * speed,
    vz: (dz / len) * speed,
    life: 2.2,
    damage: e.damage * 0.75,
    radius: 0.28,
    owner: 'enemy',
  };
  state.projectiles.push(pr);
  state.fxQueue.push({ kind: 'bolt', x: pr.x, z: pr.z, color: 0xff6688 });
}

function resolveWindup(state: GameState, e: Actor): void {
  const p = state.player;
  const style = e.attackStyle ?? 'melee';
  const d = dist(e.x, e.z, p.x, p.z);

  if (style === 'bolt') {
    fireEnemyBolt(state, e);
    e.attackCd = e.isBoss ? 1.2 : 1.8;
    return;
  }

  if (style === 'lunge') {
    // snap forward toward player
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const len = Math.hypot(dx, dz) || 1;
    e.x += (dx / len) * Math.min(2.4, d * 0.55);
    e.z += (dz / len) * Math.min(2.4, d * 0.55);
    const c = clampToRoom(e.x, e.z, currentRoom(state), e.radius);
    e.x = c.x;
    e.z = c.z;
  }

  const hitRange =
    style === 'slam' ? e.attackRange * 1.55 + p.radius : e.attackRange + p.radius + 0.15;
  const d2 = dist(e.x, e.z, p.x, p.z);
  if (d2 <= hitRange) {
    const dmg = style === 'slam' ? e.damage * 1.25 : e.damage;
    damageActor(state, p, dmg, false);
    if (style === 'slam') {
      state.shake = Math.min(0.9, state.shake + 0.35);
      state.fxQueue.push({
        kind: 'slam',
        x: e.x,
        z: e.z,
        color: e.isBoss ? 0xc77dff : 0xff4d6d,
        radius: hitRange,
      });
    }
  } else if (style === 'slam') {
    // whiff slam still shows impact
    state.fxQueue.push({
      kind: 'slam',
      x: e.x + Math.cos(e.facing) * 1.2,
      z: e.z + Math.sin(e.facing) * 1.2,
      color: 0x884466,
      radius: e.attackRange,
    });
  }

  // Generous cooldowns — room to breathe / counter between attacks
  if (style === 'slam') e.attackCd = e.isBoss ? 1.8 : 1.9;
  else if (style === 'lunge') e.attackCd = 1.55;
  else e.attackCd = e.isBoss ? 1.35 : 1.7;
}

export function updateEnemyCombat(state: GameState, e: Actor, dt: number): void {
  const p = state.player;
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  e.attackCd = Math.max(0, e.attackCd - dt);
  e.stun = Math.max(0, (e.stun ?? 0) - dt);
  if (!e.alive || !p.alive) return;

  // Boss phase transition
  if (e.isBoss) {
    const phase = e.hp <= e.maxHp * 0.5 ? 2 : 1;
    if (e.bossPhase !== phase) {
      e.bossPhase = phase;
      if (phase === 2) {
        e.speed *= 1.15;
        e.damage *= 1.1;
        state.message = 'WELLBORN ENRAGED';
        state.messageT = 2;
        state.shake = Math.min(1, state.shake + 0.4);
        state.fxQueue.push({ kind: 'slam', x: e.x, z: e.z, color: 0xff44aa, radius: 4 });
      }
    }
  }

  // Tick windup
  if ((e.windup ?? 0) > 0) {
    e.windup = (e.windup ?? 0) - dt;
    // face player while winding
    e.facing = Math.atan2(p.z - e.z, p.x - e.x);
    if ((e.windup ?? 0) <= 0) {
      e.windup = 0;
      resolveWindup(state, e);
      e.attackStyle = undefined;
    }
    return; // freeze movement during telegraph
  }

  if ((e.stun ?? 0) > 0) return;

  const d = dist(e.x, e.z, p.x, p.z);
  // Short aggro — walk into them on purpose; don't pull half the room
  if (d < 6.2 || e.aggro || e.isBoss) e.aggro = true;
  if (!e.aggro) return;

  const room = currentRoom(state);
  const dx = p.x - e.x;
  const dz = p.z - e.z;
  const dl = Math.hypot(dx, dz) || 1;
  let ux = dx / dl;
  let uz = dz / dl;

  // --- Movement by kind ---
  if (e.kind === 'bone') {
    const prefer = e.preferRange ?? 7;
    if (d < prefer - 1.2) {
      // kite back
      ux = -ux;
      uz = -uz;
      e.x += ux * e.speed * 0.9 * dt;
      e.z += uz * e.speed * 0.9 * dt;
    } else if (d > prefer + 1.5) {
      e.x += ux * e.speed * dt;
      e.z += uz * e.speed * dt;
    } else {
      // strafe
      const sx = -uz;
      const sz = ux;
      e.x += sx * e.speed * 0.7 * dt;
      e.z += sz * e.speed * 0.7 * dt;
    }
  } else if (e.isBoss) {
    if (d < 4.5) {
      const tx = -uz;
      const tz = ux;
      ux = ux * 0.2 + tx * 0.8;
      uz = uz * 0.2 + tz * 0.8;
      const n = Math.hypot(ux, uz) || 1;
      ux /= n;
      uz /= n;
    }
    if (d > e.attackRange * 0.7) {
      e.x += ux * e.speed * dt;
      e.z += uz * e.speed * dt;
    }
  } else {
    // shade / wretch close in
    if (d > e.attackRange * 0.75) {
      const spd = e.kind === 'shade' ? e.speed * 1.08 : e.speed;
      e.x += ux * spd * dt;
      e.z += uz * spd * dt;
    }
  }

  const c = clampToRoom(e.x, e.z, room, e.radius);
  e.x = c.x;
  e.z = c.z;
  e.facing = Math.atan2(p.z - e.z, p.x - e.x);

  // --- Decide to windup ---
  if (e.attackCd > 0) return;

  if (e.kind === 'shade') {
    if (d <= e.attackRange + 2.2) {
      beginWindup(e, 'lunge', WINDUP.shade);
      state.fxQueue.push({ kind: 'telegraph', x: e.x, z: e.z, color: 0xff6688, radius: e.attackRange + 1.5 });
    }
  } else if (e.kind === 'bone') {
    if (d <= 11 && d >= 3) {
      beginWindup(e, 'bolt', WINDUP.bone);
      state.fxQueue.push({ kind: 'telegraph', x: e.x, z: e.z, color: 0xffaa66, radius: 1.2 });
    }
  } else if (e.kind === 'wretch') {
    if (d <= e.attackRange + 1.5) {
      beginWindup(e, 'slam', WINDUP.wretch);
      state.fxQueue.push({
        kind: 'telegraph',
        x: e.x,
        z: e.z,
        color: 0xff4444,
        radius: e.attackRange * 1.5,
      });
    }
  } else if (e.isBoss) {
    // rotate patterns
    e.aiTimer = (e.aiTimer ?? 0) + 1;
    const phase = e.bossPhase ?? 1;
    if (phase === 1) {
      if (d <= e.attackRange + 2) {
        beginWindup(e, e.aiTimer % 3 === 0 ? 'slam' : 'melee', e.aiTimer % 3 === 0 ? WINDUP.wellbornSlam : WINDUP.wellbornMelee);
        state.fxQueue.push({
          kind: 'telegraph',
          x: e.x,
          z: e.z,
          color: 0xc77dff,
          radius: e.attackRange * (e.aiTimer % 3 === 0 ? 1.6 : 1.1),
        });
      }
    } else {
      // phase 2: mix bolts and slams
      if (e.aiTimer % 2 === 0 && d <= 12) {
        beginWindup(e, 'bolt', WINDUP.wellbornBolt);
        state.fxQueue.push({ kind: 'telegraph', x: e.x, z: e.z, color: 0xff66cc, radius: 1.4 });
      } else if (d <= e.attackRange + 2.5) {
        beginWindup(e, 'slam', WINDUP.wellbornSlam * 0.85);
        state.fxQueue.push({
          kind: 'telegraph',
          x: e.x,
          z: e.z,
          color: 0xff2266,
          radius: e.attackRange * 1.7,
        });
      }
    }
  }
}
