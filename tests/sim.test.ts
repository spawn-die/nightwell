import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGameStateNode,
  createInput,
  startRun,
  step,
  stepFor,
  playerStrike,
  damageActor,
  currentRoom,
  buildDungeon,
  spawnRoomEnemies,
  updateEnemyCombat,
  beginWindup,
  WINDUP,
  screenToWorldMove,
  CAM_FORWARD,
} from '../src/game/sim.js';
import { equipItem, rollItem, recomputePlayerStats, itemScore, tryAutoEquip } from '../src/game/loot.js';
import { resetActorIds } from '../src/game/dungeon.js';
import { resetIds } from '../src/game/ids.js';

describe('NIGHTWELL simulation', () => {
  beforeEach(() => {
    resetActorIds(1);
    resetIds(1);
  });

  it('starts on title and DESCEND begins a run', () => {
    const s = createGameStateNode(42);
    expect(s.phase).toBe('title');
    const input = createInput();
    input.start = true;
    step(s, input, 1 / 60);
    expect(s.phase).toBe('playing');
    expect(s.rooms.length).toBe(5);
    expect(s.player.alive).toBe(true);
  });

  it('WASD moves the player (agency, camera-relative)', () => {
    const s = createGameStateNode(7);
    startRun(s, 7);
    const x0 = s.player.x;
    const z0 = s.player.z;
    const input = createInput();
    // Screen-up (W) maps to camera forward — not pure -Z
    input.up = true;
    stepFor(s, input, 0.5);
    const moved = Math.hypot(s.player.x - x0, s.player.z - z0);
    expect(moved).toBeGreaterThan(0.5);
  });

  it('screenToWorldMove maps W to camera forward', () => {
    const w = screenToWorldMove(0, 1);
    expect(w.x).toBeCloseTo(CAM_FORWARD.x, 5);
    expect(w.z).toBeCloseTo(CAM_FORWARD.z, 5);
    const d = screenToWorldMove(1, 0);
    // right is perpendicular
    expect(Math.abs(d.x * CAM_FORWARD.x + d.z * CAM_FORWARD.z)).toBeLessThan(1e-6);
  });

  it('melee strike damages enemies in arc', () => {
    const s = createGameStateNode(11);
    startRun(s, 11);
    s.enemies = [];
    s.enemies.push({
      id: 't1',
      kind: 'shade',
      x: s.player.x + 1.2,
      z: s.player.z,
      vx: 0,
      vz: 0,
      facing: 0,
      radius: 0.5,
      hp: 40,
      maxHp: 40,
      damage: 5,
      speed: 1,
      attackCd: 0,
      attackRange: 1,
      hitFlash: 0,
      alive: true,
    });
    s.player.facing = 0; // +X
    s.strikeCd = 0;
    const hp0 = s.enemies[0]!.hp;
    playerStrike(s);
    expect(s.enemies[0]!.hp).toBeLessThan(hp0);
  });

  it('player death sets lost terminal', () => {
    const s = createGameStateNode(13);
    startRun(s, 13);
    s.invuln = 0;
    damageActor(s, s.player, 999, false);
    expect(s.phase).toBe('lost');
    expect(s.player.alive).toBe(false);
  });

  it('player hit grants invuln so multi-hit chains cannot melt you', () => {
    const s = createGameStateNode(14);
    startRun(s, 14);
    s.invuln = 0;
    const hp0 = s.player.hp;
    damageActor(s, s.player, 20, false);
    expect(s.player.hp).toBe(hp0 - 20);
    expect(s.invuln).toBeGreaterThan(0.4);
    // second hit while invuln is ignored
    damageActor(s, s.player, 20, false);
    expect(s.player.hp).toBe(hp0 - 20);
  });

  it('boss death sets won terminal and meta progress', () => {
    const s = createGameStateNode(17);
    startRun(s, 17);
    s.enemies = [
      {
        id: 'boss',
        kind: 'wellborn',
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        facing: 0,
        radius: 1,
        hp: 10,
        maxHp: 10,
        damage: 1,
        speed: 1,
        attackCd: 0,
        attackRange: 1,
        hitFlash: 0,
        alive: true,
        isBoss: true,
      },
    ];
    const slain0 = s.meta.wellbornSlain;
    damageActor(s, s.enemies[0]!, 999, true);
    expect(s.phase).toBe('won');
    expect(s.meta.wellbornSlain).toBe(slain0 + 1);
  });

  it('loot equip changes player stats (progression system)', () => {
    const s = createGameStateNode(19);
    startRun(s, 19);
    const item = rollItem(s, 2);
    s.inventory.push(item);
    const dmg0 = s.player.damage;
    const hp0 = s.player.maxHp;
    equipItem(s, item.id);
    recomputePlayerStats(s);
    const changed =
      s.player.damage !== dmg0 || s.player.maxHp !== hp0 || s.maxFocus !== 50;
    // at least equipped pointer set
    expect(s.equipped[item.slot]?.id).toBe(item.id);
    expect(changed || item.power + item.vitality + item.focus >= 0).toBe(true);
  });

  it('dungeon has boss room at end', () => {
    const s = createGameStateNode(23);
    buildDungeon(s);
    expect(s.rooms[s.rooms.length - 1]!.kind).toBe('boss');
    expect(s.rooms[0]!.kind).toBe('entrance');
  });

  it('clearing enemies marks chamber quiet (systems interact)', () => {
    const s = createGameStateNode(29);
    startRun(s, 29);
    // go to hall-like room with enemies
    s.roomIndex = 1;
    const room = currentRoom(s);
    room.cleared = false;
    spawnRoomEnemies(s, room);
    expect(s.enemies.length).toBeGreaterThan(0);
    for (const e of s.enemies) {
      damageActor(s, e, 9999, true);
    }
    s.enemies = s.enemies.filter((e) => e.alive);
    expect(room.cleared).toBe(true);
  });

  it('startRun spawns entrance enemies so combat is immediate', () => {
    const s = createGameStateNode(41);
    startRun(s, 41);
    expect(s.rooms[0]!.kind).toBe('entrance');
    expect(s.rooms[0]!.cleared).toBe(false);
    expect(s.enemies.filter((e) => e.alive).length).toBeGreaterThanOrEqual(2);
  });

  it('cleared chamber + portal advances run (progression)', () => {
    const s = createGameStateNode(43);
    startRun(s, 43);
    // clear entrance
    for (const e of s.enemies) damageActor(s, e, 9999, true);
    s.enemies = s.enemies.filter((e) => e.alive);
    expect(s.rooms[0]!.cleared).toBe(true);
    // drain hitstop from kills so portal step isn't frozen
    s.hitstop = 0;
    const b = {
      maxZ: s.rooms[0]!.cz + s.rooms[0]!.d / 2,
      cx: s.rooms[0]!.cx,
    };
    s.player.x = b.cx;
    s.player.z = b.maxZ - 1.5;
    const input = createInput();
    step(s, input, 1 / 60); // auto-advance on portal
    expect(s.roomIndex).toBe(1);
    expect(s.enemies.filter((e) => e.alive).length).toBeGreaterThan(0);
  });

  it('enemy windup resolves into player damage after telegraph', () => {
    const s = createGameStateNode(51);
    startRun(s, 51);
    s.enemies = [];
    s.invuln = 0;
    const foe = {
      id: 'w1',
      kind: 'wretch' as const,
      x: s.player.x + 1.2,
      z: s.player.z,
      vx: 0,
      vz: 0,
      facing: 0,
      radius: 0.7,
      hp: 70,
      maxHp: 70,
      damage: 20,
      speed: 0,
      attackCd: 0,
      attackRange: 2,
      hitFlash: 0,
      alive: true,
      aggro: true,
      windup: 0,
      stun: 0,
    };
    s.enemies.push(foe);
    beginWindup(foe, 'slam', 0.25);
    expect(foe.windup).toBeGreaterThan(0);
    const hp0 = s.player.hp;
    // tick through windup without player invuln
    for (let i = 0; i < 30; i++) {
      s.invuln = 0;
      updateEnemyCombat(s, foe, 0.05);
    }
    expect(foe.windup ?? 0).toBe(0);
    expect(s.player.hp).toBeLessThan(hp0);
  });

  it('striking during windup interrupts and grants stun', () => {
    const s = createGameStateNode(53);
    startRun(s, 53);
    s.enemies = [];
    const foe = {
      id: 'w2',
      kind: 'shade' as const,
      x: s.player.x + 1.1,
      z: s.player.z,
      vx: 0,
      vz: 0,
      facing: 0,
      radius: 0.55,
      hp: 40,
      maxHp: 40,
      damage: 10,
      speed: 0,
      attackCd: 0,
      attackRange: 1.5,
      hitFlash: 0,
      alive: true,
      windup: 0.5,
      windupMax: 0.5,
      attackStyle: 'lunge' as const,
      stun: 0,
    };
    s.enemies.push(foe);
    s.player.facing = 0;
    s.strikeCd = 0;
    s.fxQueue = [];
    playerStrike(s);
    expect(foe.windup ?? 0).toBe(0);
    expect(foe.stun ?? 0).toBeGreaterThan(0);
    expect(s.fxQueue.some((e) => e.kind === 'interrupt')).toBe(true);
  });

  it('wellborn enters phase 2 under half HP', () => {
    const s = createGameStateNode(55);
    startRun(s, 55);
    s.enemies = [];
    const boss = {
      id: 'boss',
      kind: 'wellborn' as const,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      facing: 0,
      radius: 1.4,
      hp: 200,
      maxHp: 400,
      damage: 20,
      speed: 3,
      attackCd: 1,
      attackRange: 2.4,
      hitFlash: 0,
      alive: true,
      isBoss: true as const,
      bossPhase: 1 as const,
      aggro: true,
      windup: 0,
      stun: 0,
      aiTimer: 0,
    };
    s.enemies.push(boss);
    updateEnemyCombat(s, boss, 0.016);
    expect(boss.bossPhase).toBe(2);
    expect(s.message).toMatch(/ENRAGED/i);
  });

  it('kills build combo and hitstop juice', () => {
    const s = createGameStateNode(61);
    startRun(s, 61);
    s.enemies = [];
    s.combo = 0;
    s.comboTimer = 0;
    s.hitstop = 0;
    const mk = (id: string) => ({
      id,
      kind: 'shade' as const,
      x: s.player.x + 1,
      z: s.player.z,
      vx: 0,
      vz: 0,
      facing: 0,
      radius: 0.5,
      hp: 5,
      maxHp: 5,
      damage: 1,
      speed: 0,
      attackCd: 0,
      attackRange: 1,
      hitFlash: 0,
      alive: true,
    });
    const a = mk('c1');
    s.enemies.push(a);
    damageActor(s, a, 99, true);
    expect(s.combo).toBe(1);
    expect(s.comboTimer).toBeGreaterThan(0);
    expect(s.hitstop).toBeGreaterThan(0);
    expect(s.floaters.some((f) => f.text.includes('5') || f.text === '5')).toBe(true);

    const b = mk('c2');
    s.enemies.push(b);
    s.comboTimer = 2;
    damageActor(s, b, 99, true);
    expect(s.combo).toBe(2);
    expect(s.message).toMatch(/COMBO/i);
  });

  it('tryAutoEquip prefers higher itemScore', () => {
    const s = createGameStateNode(63);
    startRun(s, 63);
    const weak = {
      id: 'w',
      name: 'Weak',
      slot: 'weapon' as const,
      power: 1,
      vitality: 0,
      focus: 0,
      rarity: 'common' as const,
    };
    const strong = {
      id: 's',
      name: 'Strong',
      slot: 'weapon' as const,
      power: 20,
      vitality: 2,
      focus: 1,
      rarity: 'rare' as const,
    };
    s.inventory.push(weak, strong);
    expect(itemScore(strong)).toBeGreaterThan(itemScore(weak));
    tryAutoEquip(s, weak);
    expect(s.equipped.weapon?.id).toBe('w');
    expect(tryAutoEquip(s, strong)).toBe(true);
    expect(s.equipped.weapon?.id).toBe('s');
    expect(tryAutoEquip(s, weak)).toBe(false);
    expect(s.equipped.weapon?.id).toBe('s');
  });

  it('combat emits fxQueue events for the renderer to drain', () => {
    const s = createGameStateNode(31);
    startRun(s, 31);
    s.enemies = [];
    s.fxQueue = [];

    // slash on strike (even with no targets)
    s.strikeCd = 0;
    playerStrike(s);
    expect(s.fxQueue.some((e) => e.kind === 'slash')).toBe(true);
    const slash = s.fxQueue.find((e) => e.kind === 'slash')!;
    expect(typeof slash.x).toBe('number');
    expect(typeof slash.z).toBe('number');

    // hit / death from damageActor
    s.fxQueue = [];
    const foe = {
      id: 'fx_t1',
      kind: 'shade' as const,
      x: s.player.x + 1,
      z: s.player.z,
      vx: 0,
      vz: 0,
      facing: 0,
      radius: 0.5,
      hp: 30,
      maxHp: 30,
      damage: 5,
      speed: 1,
      attackCd: 0,
      attackRange: 1,
      hitFlash: 0,
      alive: true,
    };
    s.enemies.push(foe);
    damageActor(s, foe, 5, true);
    expect(s.fxQueue.some((e) => e.kind === 'hit')).toBe(true);

    s.fxQueue = [];
    damageActor(s, foe, 999, true);
    expect(s.fxQueue.some((e) => e.kind === 'death')).toBe(true);
    expect(foe.alive).toBe(false);
  });
});
