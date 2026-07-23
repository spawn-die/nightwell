import { randInt, randRange } from './rng.js';
import type { Actor, EnemyKind, GameState, Room, RoomKind } from './types.js';

let actorSeq = 1;
function nid(prefix: string): string {
  actorSeq += 1;
  return `${prefix}_${actorSeq}`;
}

export function resetActorIds(n = 1): void {
  actorSeq = n;
}

const ROOM_LAYOUT: { kind: RoomKind; w: number; d: number }[] = [
  { kind: 'entrance', w: 28, d: 22 },
  { kind: 'hall', w: 24, d: 24 },
  { kind: 'shrine', w: 22, d: 22 },
  { kind: 'hall', w: 26, d: 20 },
  { kind: 'boss', w: 32, d: 32 },
];

/** Linear chain of rooms along +Z */
export function buildDungeon(state: GameState): Room[] {
  const rooms: Room[] = [];
  let z = 0;
  for (let i = 0; i < ROOM_LAYOUT.length; i++) {
    const layout = ROOM_LAYOUT[i]!;
    const gap = 8;
    const room: Room = {
      id: i,
      kind: layout.kind,
      cx: 0,
      cz: z + layout.d / 2,
      w: layout.w,
      d: layout.d,
      // Entrance starts uncleared so first combat is mandatory; deeper rooms clear on kill.
      cleared: false,
      doors: {
        // Dungeon advances along +Z: "s" = deeper exit (maxZ), "n" = back (minZ).
        n: i > 0,
        s: i < ROOM_LAYOUT.length - 1,
        e: false,
        w: false,
      },
    };
    rooms.push(room);
    z += layout.d + gap;
  }
  state.rooms = rooms;
  state.roomIndex = 0;
  return rooms;
}

export function roomBounds(room: Room): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return {
    minX: room.cx - room.w / 2,
    maxX: room.cx + room.w / 2,
    minZ: room.cz - room.d / 2,
    maxZ: room.cz + room.d / 2,
  };
}

export function clampToRoom(x: number, z: number, room: Room, radius: number): { x: number; z: number } {
  const b = roomBounds(room);
  const pad = radius + 0.6;
  return {
    x: Math.max(b.minX + pad, Math.min(b.maxX - pad, x)),
    z: Math.max(b.minZ + pad, Math.min(b.maxZ - pad, z)),
  };
}

function enemyStats(kind: EnemyKind, level: number): Omit<Actor, 'id' | 'x' | 'z' | 'vx' | 'vz' | 'facing'> {
  const s = 1 + (level - 1) * 0.12;
  switch (kind) {
    case 'shade':
      return {
        kind,
        radius: 0.55,
        hp: 22 * s,
        maxHp: 22 * s,
        damage: 5 * s,
        speed: 3.4,
        attackCd: 0.6, // don't swing the instant they aggro
        attackRange: 1.4,
        hitFlash: 0,
        alive: true,
        aiTimer: 0,
        aggro: false,
        windup: 0,
        stun: 0,
      };
    case 'bone':
      return {
        kind,
        radius: 0.65,
        hp: 40 * s,
        maxHp: 40 * s,
        damage: 6 * s,
        speed: 2.6,
        attackCd: 0.9,
        attackRange: 1.6,
        hitFlash: 0,
        alive: true,
        aiTimer: 0,
        aggro: false,
        preferRange: 7.2,
        windup: 0,
        stun: 0,
      };
    case 'wretch':
      return {
        kind,
        radius: 0.7,
        hp: 58 * s,
        maxHp: 58 * s,
        damage: 9 * s,
        speed: 2.2,
        attackCd: 1.0,
        attackRange: 1.8,
        hitFlash: 0,
        alive: true,
        aiTimer: 0,
        aggro: false,
        windup: 0,
        stun: 0,
      };
    case 'wellborn':
      return {
        kind,
        radius: 1.4,
        hp: 420 * s,
        maxHp: 420 * s,
        damage: 12 * s,
        speed: 2.8,
        attackCd: 1.2,
        attackRange: 2.4,
        hitFlash: 0,
        alive: true,
        isBoss: true,
        aiTimer: 0,
        aggro: true,
        bossPhase: 1,
        windup: 0,
        stun: 0,
      };
  }
}

export function spawnRoomEnemies(state: GameState, room: Room): void {
  state.enemies = state.enemies.filter((e) => e.alive);
  // clear enemies not in current room band
  const b = roomBounds(room);
  state.enemies = state.enemies.filter(
    (e) => e.x >= b.minX - 4 && e.x <= b.maxX + 4 && e.z >= b.minZ - 4 && e.z <= b.maxZ + 4,
  );

  if (room.cleared && room.kind !== 'boss') return;

  // Entrance: two shades, staggered spawn angles, not all instantly aggressive
  if (room.kind === 'entrance') {
    if (state.enemies.some((e) => e.alive)) return;
    for (let i = 0; i < 2; i++) {
      const stats = enemyStats('shade', state.level);
      const ang = Math.PI * 0.35 + i * 1.1;
      state.enemies.push({
        id: nid('en'),
        x: room.cx + Math.cos(ang) * 6.5,
        z: room.cz + Math.sin(ang) * 5.5,
        vx: 0,
        vz: 0,
        facing: 0,
        ...stats,
        aggro: false, // walk toward them; they wake at 9u
        attackCd: 0.8 + i * 0.4,
      });
    }
    return;
  }

  if (room.kind === 'boss') {
    if (!state.enemies.some((e) => e.isBoss)) {
      const stats = enemyStats('wellborn', state.level);
      state.enemies.push({
        id: nid('boss'),
        x: room.cx,
        z: room.cz + 4,
        vx: 0,
        vz: 0,
        facing: Math.PI,
        ...stats,
      });
    }
    return;
  }

  const count = room.kind === 'shrine' ? 4 : 5 + Math.floor(state.level / 2);
  const kinds: EnemyKind[] = ['shade', 'shade', 'bone', 'wretch'];
  for (let i = 0; i < count; i++) {
    const kind = kinds[randInt(state, 0, kinds.length - 1)]!;
    const stats = enemyStats(kind, state.level);
    const ang = randRange(state, 0, Math.PI * 2);
    const dist = randRange(state, 3, Math.min(room.w, room.d) * 0.35);
    state.enemies.push({
      id: nid('en'),
      x: room.cx + Math.cos(ang) * dist,
      z: room.cz + Math.sin(ang) * dist,
      vx: 0,
      vz: 0,
      facing: 0,
      ...stats,
    });
  }
}

export function currentRoom(state: GameState): Room {
  return state.rooms[state.roomIndex] ?? state.rooms[0]!;
}

/** True when player stands in the deeper (+Z) exit portal volume. */
export function nearForwardExit(state: GameState): boolean {
  const room = currentRoom(state);
  if (!room.doors.s) return false;
  const b = roomBounds(room);
  return state.player.z >= b.maxZ - 2.8 && Math.abs(state.player.x - room.cx) <= 3.2;
}

export function tryAdvanceRoom(state: GameState): boolean {
  const room = currentRoom(state);
  if (!room.cleared) {
    if (nearForwardExit(state)) {
      state.message = 'CLEAR THE CHAMBER FIRST';
      state.messageT = 1.2;
    }
    return false;
  }
  if (state.roomIndex >= state.rooms.length - 1) return false;
  if (!nearForwardExit(state)) return false;

  state.roomIndex += 1;
  const next = currentRoom(state);
  state.player.x = next.cx;
  state.player.z = roomBounds(next).minZ + 3;
  state.enemies = [];
  spawnRoomEnemies(state, next);
  state.message =
    next.kind === 'boss' ? 'THE WELLBORN STIRS' : next.kind === 'shrine' ? 'ECHO SHRINE' : 'DEEPER';
  state.messageT = 2.2;
  return true;
}

export function markRoomClear(state: GameState): void {
  const room = currentRoom(state);
  const living = state.enemies.filter((e) => e.alive);
  if (living.length === 0) {
    if (!room.cleared) {
      room.cleared = true;
      state.gold += 15 + state.roomIndex * 8;
      if (room.kind === 'boss') {
        state.message = 'WELL FALLS SILENT';
      } else if (room.doors.s) {
        state.message = 'GATE OPEN — WALK THROUGH';
      } else {
        state.message = 'CHAMBER QUIET';
      }
      state.messageT = 2.2;
    }
  }
}
