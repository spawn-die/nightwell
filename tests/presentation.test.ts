import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { judgeLookL1 } from '@spawndie/forge';
import {
  HERO_IDENTITY,
  buildHeroL2LookClaim,
  buildLegacySphereMushClaim,
  heroIsL2Identity,
  isPrimitiveProxy,
  requiredHeroAssetPaths,
} from '../src/game/presentation.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function publicPath(urlPath: string): string {
  // HERO paths are like /assets/... → public/assets/...
  return join(root, 'public', urlPath.replace(/^\//, ''));
}

describe('Nightwell L2 hero presentation', () => {
  it('hero primary identity is not a primitive-only proxy', () => {
    expect(HERO_IDENTITY.proxy).toBe('card');
    expect(isPrimitiveProxy(HERO_IDENTITY.proxy)).toBe(false);
    expect(heroIsL2Identity()).toBe(true);
    expect(HERO_IDENTITY.stage).toBe('L2');
    expect(HERO_IDENTITY.publicCanonBase).toMatch(/hero_base\.png$/);
    expect(String(HERO_IDENTITY.canonBase).length).toBeGreaterThan(0);
  });

  it('committed hero identity PNG assets exist and are non-trivial PNGs', () => {
    const paths = requiredHeroAssetPaths();
    expect(paths.length).toBeGreaterThanOrEqual(3);
    for (const p of paths) {
      const disk = publicPath(p);
      expect(existsSync(disk), `missing ${disk}`).toBe(true);
      const buf = readFileSync(disk);
      // PNG signature
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);
      expect(buf.length).toBeGreaterThan(8_000);
    }
  });

  it('ActorRenderer source builds a heroCard, not sphere/capsule body as primary', () => {
    const src = readFileSync(join(root, 'src/render/actors.ts'), 'utf8');
    expect(src).toContain("name = 'heroCard'");
    expect(src).toContain('HERO_IDENTITY');
    expect(src).toContain('PlaneGeometry');
    expect(src).toContain('buildPlayerCard');
    expect(src).toMatch(/identityProxy.*card|proxy.*card/);
    const playerSection = src.slice(src.indexOf('buildPlayerCard'), src.indexOf('private buildActor'));
    // Primary body is boxy humanoid + card — no sphere/capsule player torso
    expect(playerSection).not.toContain('CapsuleGeometry');
    expect(playerSection).not.toContain('SphereGeometry');
    expect(playerSection).toContain('BoxGeometry');
    expect(playerSection).toContain('heroCard');
    // Ground marker must not be a full circle ring (cyan-circle bug)
    expect(playerSection).not.toMatch(/RingGeometry\(\s*0\.\d+\s*,\s*0\.\d+\s*,\s*3[2-9]/);
    expect(playerSection).toContain('CircleGeometry(1.05, 4)'); // diamond
  });
});

describe('Look Court L1 via shipped @spawndie/forge', () => {
  it('legacy Nightwell sphere mush still FAIL at L2', () => {
    const claim = buildLegacySphereMushClaim();
    const verdict = judgeLookL1(claim);
    expect(verdict.verdict).toBe('FAIL');
    expect(verdict.blocking.some((b) => b.gate === 'primitive_ban')).toBe(true);
  });

  it('current hero L2 claim PASSES Look Court L1', () => {
    const claim = buildHeroL2LookClaim();
    expect(claim.captures[0]!.heroProxy).toBe(HERO_IDENTITY.proxy);
    expect(isPrimitiveProxy(claim.captures[0]!.heroProxy)).toBe(false);
    const verdict = judgeLookL1(claim);
    expect(verdict.verdict).toBe('PASS');
    expect(verdict.blocking).toEqual([]);
  });
});
