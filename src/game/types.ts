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
  /** One-frame visual events drained by the renderer */
  fxQueue: FxEvent[];
  meta: {
    bestKills: number;
    runs: number;
    wellbornSlain: number;
  };
};

export type FxEvent = {
  kind: 'hit' | 'death' | 'slash' | 'bolt' | 'dash';
  x: number;
  z: number;
  color?: number;
};
