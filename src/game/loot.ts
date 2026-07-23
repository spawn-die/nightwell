import { nextRng, pick, randInt, randRange } from './rng.js';
import type { GameState, ItemDef, ItemSlot } from './types.js';

const WEAPON_NAMES = [
  'Ash Fang',
  'Wellspike',
  'Night Cleaver',
  'Echo Brand',
  'Grave Needle',
  'Pit Iron',
] as const;

const ARMOR_NAMES = [
  'Riven Mail',
  'Undercroft Plate',
  'Warden Shroud',
  'Boneweave',
  'Ash Mantle',
] as const;

const RELIC_NAMES = [
  'Pale Heart',
  'Whisper Stone',
  'Hollow Charm',
  'Depth Sigil',
  'Last Light',
] as const;

let itemSeq = 1;

export function rollItem(state: GameState, levelBias = 0): ItemDef {
  const slot = pick(state, ['weapon', 'armor', 'relic'] as const);
  const roll = nextRng(state);
  const rarity: ItemDef['rarity'] =
    roll > 0.92 ? 'echo' : roll > 0.7 ? 'rare' : 'common';
  const mult = rarity === 'echo' ? 1.7 : rarity === 'rare' ? 1.3 : 1;
  const base = 3 + state.level + levelBias;

  const power =
    slot === 'weapon'
      ? Math.round((base + randRange(state, 0, 4)) * mult)
      : Math.round(randRange(state, 0, 2) * mult);
  const vitality =
    slot === 'armor'
      ? Math.round((8 + base * 2 + randRange(state, 0, 6)) * mult)
      : Math.round(randRange(state, 0, 4) * mult);
  const focus =
    slot === 'relic'
      ? Math.round((6 + base + randRange(state, 0, 5)) * mult)
      : Math.round(randRange(state, 0, 3) * mult);

  const name =
    slot === 'weapon'
      ? pick(state, WEAPON_NAMES)
      : slot === 'armor'
        ? pick(state, ARMOR_NAMES)
        : pick(state, RELIC_NAMES);

  itemSeq += 1;
  return {
    id: `item_${itemSeq}_${randInt(state, 1000, 9999)}`,
    name: rarity === 'echo' ? `Echo ${name}` : rarity === 'rare' ? `Riven ${name}` : name,
    slot: slot as ItemSlot,
    power,
    vitality,
    focus,
    rarity,
  };
}

export function equipItem(state: GameState, itemId: string): boolean {
  const item = state.inventory.find((i) => i.id === itemId);
  if (!item) return false;
  const prev = state.equipped[item.slot];
  state.equipped[item.slot] = item;
  // keep in inventory; equipped is a pointer by id presence
  void prev;
  recomputePlayerStats(state);
  return true;
}

export function recomputePlayerStats(state: GameState): void {
  const p = state.player;
  const baseHp = 120 + (state.level - 1) * 18;
  const baseDmg = 12 + (state.level - 1) * 2;
  const baseFocus = 50 + (state.level - 1) * 5;

  let vit = 0;
  let pow = 0;
  let foc = 0;
  for (const slot of ['weapon', 'armor', 'relic'] as const) {
    const it = state.equipped[slot];
    if (!it) continue;
    vit += it.vitality;
    pow += it.power;
    foc += it.focus;
  }

  const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
  p.maxHp = baseHp + vit;
  p.hp = Math.max(1, Math.min(p.maxHp, Math.round(p.maxHp * ratio)));
  p.damage = baseDmg + pow;
  state.maxFocus = baseFocus + foc;
  state.focus = Math.min(state.focus, state.maxFocus);
}

export function grantXp(state: GameState, amount: number): void {
  state.xp += amount;
  while (state.xp >= state.xpToLevel) {
    state.xp -= state.xpToLevel;
    state.level += 1;
    state.xpToLevel = Math.floor(state.xpToLevel * 1.35);
    recomputePlayerStats(state);
    state.player.hp = state.player.maxHp;
    state.focus = state.maxFocus;
    state.message = `LEVEL ${state.level}`;
    state.messageT = 2;
  }
}
