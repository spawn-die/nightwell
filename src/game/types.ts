export type Phase = 'title' | 'playing' | 'inventory' | 'won' | 'lost';

export type EnemyKind = 'shade' | 'bone' | 'wretch' | 'wellborn';

export type ItemSlot = 'weapon' | 'armor' | 'relic';

export type ItemDef = {
  id: string;
  name: string;
  slot: ItemSlot;
  power: number;
  vitality: number;
  focus: number;
  rarity: 'common' | 'rare' | 'echo';
};

/** Attack style for telegraphs / boss patterns */
export type AttackStyle = 'melee' | 'lunge' | 'slam' | 'bolt';

export type Actor = {
  id: string;
  kind: 'player' | EnemyKind;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  radius: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  attackCd: number;
  attackRange: number;
  hitFlash: number;
  alive: boolean;
  isBoss?: boolean;
  aiTimer?: number;
  aggro?: boolean;
  /** Seconds remaining in attack telegraph (0 = idle/moving) */
  windup?: number;
  windupMax?: number;
  attackStyle?: AttackStyle;
  /** Brief stun after interrupt — cannot windup */
  stun?: number;
  /** Wellborn phase 1 then 2 under 50% HP */
  bossPhase?: 1 | 2;
  /** Preferred range for kiting (bone) */
  preferRange?: number;
};

export type Projectile = {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  damage: number;
  radius: number;
  owner: 'player' | 'enemy';
};

export type Pickup = {
  id: string;
  x: number;
  z: number;
  item: ItemDef;
  life: number;
};

export type RoomKind = 'entrance' | 'hall' | 'shrine' | 'boss';

export type Room = {
  id: number;
  kind: RoomKind;
  cx: number;
  cz: number;
  w: number;
  d: number;
  cleared: boolean;
  doors: { n: boolean; s: boolean; e: boolean; w: boolean };
};

export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  strike: boolean;
  bolt: boolean;
  dash: boolean;
  interact: boolean;
  toggleInv: boolean;
  aimX: number;
  aimZ: number;
  start: boolean;
};

export type GameState = {
  phase: Phase;
  seed: number;
  rng: number;
  time: number;
  roomIndex: number;
  rooms: Room[];
  player: Actor;
  enemies: Actor[];
  projectiles: Projectile[];
  pickups: Pickup[];
  inventory: ItemDef[];
  equipped: { weapon: ItemDef | null; armor: ItemDef | null; relic: ItemDef | null };
  level: number;
  xp: number;
  xpToLevel: number;
  gold: number;
  kills: number;
  focus: number;
  maxFocus: number;
  dashCd: number;
  strikeCd: number;
  boltCd: number;
  invuln: number;
  message: string;
  messageT: number;
  shake: number;
  runId: string;
  fxQueue: FxEvent[];
  meta: {
    bestKills: number;
    runs: number;
    wellbornSlain: number;
  };
};

export type FxEvent = {
  kind: 'hit' | 'death' | 'slash' | 'bolt' | 'dash' | 'telegraph' | 'slam' | 'interrupt';
  x: number;
  z: number;
  color?: number;
  /** Optional radius for slam/telegraph rings */
  radius?: number;
};
