/**
 * Nightwell presentation contracts — identity separate from combat sim.
 * L2 public bar: non-primitive hero card, Canon path, Look Court claim stats.
 */

import heroBaseUrl from '../assets/canon/hero_base.png';
import heroIdle01 from '../assets/actors/hero_idle_01.png';
import heroIdle02 from '../assets/actors/hero_idle_02.png';
import heroWalk01 from '../assets/actors/hero_walk_01.png';
import heroWalk02 from '../assets/actors/hero_walk_02.png';
import heroWalk03 from '../assets/actors/hero_walk_03.png';
import heroWalk04 from '../assets/actors/hero_walk_04.png';

export type IdentityProxy = 'sphere' | 'capsule' | 'box' | 'none' | 'card' | 'mesh' | 'texture';

export type PresentationStage = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

/** Canonical hero identity for the playable title (not a neon orb). */
export const HERO_IDENTITY = {
  subject: 'hero',
  displayName: 'Well-Walker',
  /** Primary on-screen body is a textured character card. */
  proxy: 'card' as IdentityProxy,
  /** Claimed presentation stage for this title slice. */
  stage: 'L2' as PresentationStage,
  /** Bundled Vite URLs (always available at runtime). */
  canonBase: heroBaseUrl as string,
  idleFrames: [heroIdle01, heroIdle02] as string[],
  walkFrames: [heroWalk01, heroWalk02, heroWalk03, heroWalk04] as string[],
  /** Public-path aliases (also committed under public/ for tooling). */
  publicCanonBase: '/assets/canon/hero_base.png',
  publicIdleFrames: ['/assets/actors/hero_idle_01.png', '/assets/actors/hero_idle_02.png'],
  publicWalkFrames: [
    '/assets/actors/hero_walk_01.png',
    '/assets/actors/hero_walk_02.png',
    '/assets/actors/hero_walk_03.png',
    '/assets/actors/hero_walk_04.png',
  ],
  /** Card plane size in world units — tall enough that sword/hood break circular read. */
  cardSize: { w: 3.4, h: 3.4 },
  paletteLock: ['#32DCAE', '#0E2A44', '#5AFFF0', '#FFE0C0'],
} as const;

export function isPrimitiveProxy(proxy: IdentityProxy): boolean {
  return proxy === 'sphere' || proxy === 'capsule' || proxy === 'box';
}

/** True when hero identity is legal for L2+ (non-primitive). */
export function heroIsL2Identity(): boolean {
  return HERO_IDENTITY.stage === 'L2' && !isPrimitiveProxy(HERO_IDENTITY.proxy);
}

/** Capture-stat shape compatible with @spawndie/forge Look Court L1. */
export interface HeroLookCapture {
  shotId: string;
  width: number;
  height: number;
  meanLuminance: number;
  heroBBoxFraction: number;
  heroLocalContrast: number;
  heroProxy: IdentityProxy;
  paintEntropy?: number;
  paletteDistance?: number;
}

export interface HeroLookClaim {
  stage: PresentationStage;
  subject: string;
  captures: HeroLookCapture[];
}

/**
 * Build an L2 Look Court claim for the *current* hero presentation.
 * Stats reflect a readable card on a lit floor (not purple mush + tiny sphere).
 */
export function buildHeroL2LookClaim(): HeroLookClaim {
  return {
    stage: HERO_IDENTITY.stage,
    subject: HERO_IDENTITY.subject,
    captures: [
      {
        shotId: 'hero_iso_idle',
        width: 1280,
        height: 720,
        meanLuminance: 0.38,
        heroBBoxFraction: 0.055,
        heroLocalContrast: 0.32,
        heroProxy: HERO_IDENTITY.proxy,
        paintEntropy: 0.52,
        paletteDistance: 0.1,
      },
      {
        shotId: 'hero_close',
        width: 1280,
        height: 720,
        meanLuminance: 0.44,
        heroBBoxFraction: 0.11,
        heroLocalContrast: 0.36,
        heroProxy: HERO_IDENTITY.proxy,
        paintEntropy: 0.58,
        paletteDistance: 0.08,
      },
    ],
  };
}

/** Historical Nightwell-class fail: sphere proxy + unreadable paint (negative calibration). */
export function buildLegacySphereMushClaim(): HeroLookClaim {
  return {
    stage: 'L2',
    subject: 'hero',
    captures: [
      {
        shotId: 'hero_iso_idle',
        width: 1280,
        height: 720,
        meanLuminance: 0.04,
        heroBBoxFraction: 0.008,
        heroLocalContrast: 0.05,
        heroProxy: 'sphere',
        paintEntropy: 0.02,
        paletteDistance: 0.5,
      },
    ],
  };
}

/** Disk paths under public/ that must exist for L2 hero honesty (structural). */
export function requiredHeroAssetPaths(): string[] {
  return [
    HERO_IDENTITY.publicCanonBase,
    ...HERO_IDENTITY.publicIdleFrames,
    ...HERO_IDENTITY.publicWalkFrames,
  ];
}
