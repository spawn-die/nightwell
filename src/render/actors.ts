import * as THREE from 'three';
import { HERO_IDENTITY } from '../game/presentation.js';
import type { Actor, GameState } from '../game/types.js';

function mat(color: number, emissive = 0x000000, em = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: em,
    roughness: 0.65,
    metalness: 0.15,
  });
}

/** Camera-relative yaw so the hero card always faces the isometric camera. */
const CAM_FACE_YAW = Math.atan2(-7.2, 10);

export class ActorRenderer {
  group = new THREE.Group();
  private meshes = new Map<string, THREE.Group>();
  private heroMap: THREE.Texture;
  private heroIdleMaps: THREE.Texture[] = [];
  private walkPhase = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const loader = new THREE.TextureLoader();
    const prep = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      return tex;
    };
    // Bundled URLs — load immediately (cached by browser/vite)
    this.heroMap = prep(loader.load(HERO_IDENTITY.canonBase));
    this.heroIdleMaps = HERO_IDENTITY.idleFrames.map((url) => prep(loader.load(url)));
  }

  sync(state: GameState): void {
    const seen = new Set<string>();
    const all: Actor[] = [state.player, ...state.enemies];
    const moving =
      state.player.alive &&
      (Math.abs(state.player.vx) > 0.15 || Math.abs(state.player.vz) > 0.15);
    if (moving) this.walkPhase += 0.14;
    else this.walkPhase += 0.04;

    for (const a of all) {
      if (!a.alive && a.hitFlash <= 0 && a.kind !== 'player') continue;
      seen.add(a.id);
      let g = this.meshes.get(a.id);
      if (!g) {
        g = this.buildActor(a);
        this.meshes.set(a.id, g);
        this.group.add(g);
      }
      g.visible = a.alive || a.hitFlash > 0;
      g.position.set(a.x, 0, a.z);

      if (a.kind === 'player') {
        // Billboard: always face camera so character art is readable
        g.rotation.y = CAM_FACE_YAW;
      } else {
        g.rotation.y = -a.facing + Math.PI / 2;
      }

      const windup = a.windup ?? 0;
      const windupMax = a.windupMax ?? 1;
      const windupT = windup > 0 ? 1 - windup / windupMax : 0;
      const styleMul = a.attackStyle === 'slam' ? 1.55 : a.attackStyle === 'lunge' ? 1.35 : 1.1;
      const hitRadius = (a.attackRange ?? 1.5) * styleMul + 0.7;

      g.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
          if (o.name === 'heroCard') {
            const hm = o.material;
            const frames = this.heroIdleMaps.length > 0 ? this.heroIdleMaps : [this.heroMap];
            const idx = Math.floor(this.walkPhase) % frames.length;
            const frame = frames[idx]!;
            if (hm.map !== frame) {
              hm.map = frame;
              hm.needsUpdate = true;
            }
            if (a.hitFlash > 0) {
              hm.emissiveIntensity = 1.9;
            } else if (windup > 0) {
              hm.emissiveIntensity = 0.55 + windupT * 0.9;
            } else {
              hm.emissiveIntensity = (hm.userData.baseEm as number) ?? 0.5;
            }
            return;
          }
          if (a.hitFlash > 0) {
            o.material.emissiveIntensity = 2.2;
          } else if (windup > 0) {
            o.material.emissiveIntensity = (o.userData.baseEm ?? 0.2) + 1.0 + windupT * 1.6;
          } else {
            o.material.emissiveIntensity = o.userData.baseEm ?? 0;
          }
        }
        if ((o.name === 'telegraphDisk' || o.name === 'telegraphRing') && o instanceof THREE.Mesh) {
          o.visible = windup > 0 && a.alive;
          o.scale.setScalar(Math.max(0.8, hitRadius));
          const m = o.material as THREE.MeshBasicMaterial;
          const hot = windupT > 0.65;
          m.color.setHex(hot ? 0xff2244 : a.isBoss ? 0xe0a0ff : 0xffaa33);
          if (o.name === 'telegraphDisk') {
            m.opacity = 0.18 + windupT * 0.42;
          } else {
            m.opacity = 0.55 + windupT * 0.4;
          }
        }
      });

      if (!a.alive) {
        g.position.y = -0.4;
        g.scale.setScalar(0.85);
      } else {
        g.scale.setScalar(1);
      }

      if (a.kind === 'player') {
        const inv = state.invuln > 0;
        g.traverse((o) => {
          if (o.name === 'playerRing' && o instanceof THREE.Mesh) {
            const m = o.material as THREE.MeshBasicMaterial;
            m.opacity = inv
              ? 0.45 + Math.sin(Date.now() * 0.03) * 0.4
              : 0.9 + Math.sin(Date.now() * 0.008) * 0.08;
            m.color.setHex(inv ? 0xffffff : 0x60ffe0);
          }
        });
        g.visible = a.alive && (!inv || Math.sin(Date.now() * 0.04) > -0.35);
      }
    }

    for (const [id, g] of this.meshes) {
      if (!seen.has(id)) {
        this.group.remove(g);
        this.meshes.delete(id);
      }
    }
  }

  private buildPlayerCard(): THREE.Group {
    const g = new THREE.Group();
    g.userData.kind = 'player';
    g.userData.identityProxy = HERO_IDENTITY.proxy;

    const { w, h } = HERO_IDENTITY.cardSize;
    const cardMat = new THREE.MeshStandardMaterial({
      map: this.heroMap,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.08,
      roughness: 0.48,
      metalness: 0.08,
      emissive: 0x248868,
      emissiveIntensity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    cardMat.userData.baseEm = 0.55;

    const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cardMat);
    card.position.y = h * 0.48;
    card.castShadow = true;
    card.name = 'heroCard';
    card.userData.identityProxy = 'card';
    card.userData.baseEm = 0.55;
    g.add(card);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.2, 48),
      new THREE.MeshBasicMaterial({
        color: 0x60ffe0,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    ring.name = 'playerRing';
    g.add(ring);

    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 32),
      new THREE.MeshBasicMaterial({
        color: 0x40ffc0,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.05;
    g.add(pad);

    const glow = new THREE.PointLight(0x70ffe0, 5.5, 20, 1.4);
    glow.position.y = 1.8;
    g.add(glow);

    return g;
  }

  private buildActor(a: Actor): THREE.Group {
    if (a.kind === 'player') {
      return this.buildPlayerCard();
    }

    const g = new THREE.Group();
    g.userData.kind = a.kind;

    if (a.kind === 'shade') {
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1.75, 6),
        mat(0xc040ff, 0xff40e0, 1.1),
      );
      body.position.y = 0.95;
      body.castShadow = true;
      body.userData.baseEm = 1.1;
      g.add(body);
      const mid = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 8),
        mat(0x3a2060, 0x9b6dff, 0.8),
      );
      mid.position.y = 1.15;
      mid.userData.baseEm = 0.8;
      g.add(mid);
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 8),
        mat(0xff6699, 0xff2266, 1.4),
      );
      eye.position.set(0, 1.4, 0.28);
      eye.userData.baseEm = 1.4;
      g.add(eye);
      for (const sx of [-1, 1]) {
        const wisp = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 0.7, 4),
          mat(0x3a2068, 0x7b4dff, 0.5),
        );
        wisp.position.set(sx * 0.4, 0.55, -0.15);
        wisp.rotation.z = sx * 0.4;
        wisp.userData.baseEm = 0.5;
        g.add(wisp);
      }
    } else if (a.kind === 'bone') {
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.45), mat(0xfff0e0, 0xffccaa, 0.35));
      torso.position.y = 1.1;
      torso.castShadow = true;
      torso.userData.baseEm = 0.35;
      g.add(torso);
      const ribs = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.5, 0.08),
        mat(0x1a1010, 0xff6688, 0.9),
      );
      ribs.position.set(0, 1.15, 0.22);
      ribs.userData.baseEm = 0.45;
      g.add(ribs);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), mat(0xf0e8d8));
      skull.position.y = 1.8;
      g.add(skull);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.2), mat(0xe0d8c8));
      jaw.position.set(0, 1.58, 0.18);
      g.add(jaw);
      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.95, 0.16), mat(0xd8d0c0));
        arm.position.set(sx * 0.55, 1.05, 0);
        arm.rotation.z = sx * 0.15;
        g.add(arm);
      }
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), mat(0xc8c0b0));
        leg.position.set(sx * 0.2, 0.4, 0);
        g.add(leg);
      }
    } else if (a.kind === 'wretch') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.78, 10, 10), mat(0xe06040, 0xff6030, 0.75));
      body.position.y = 0.75;
      body.scale.set(1.05, 0.85, 1.15);
      body.castShadow = true;
      body.userData.baseEm = 0.75;
      g.add(body);
      for (const sx of [-1, 1]) {
        const shoulder = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 8, 8),
          mat(0x4a2818, 0xff4d6d, 0.15),
        );
        shoulder.position.set(sx * 0.55, 1.05, 0.1);
        shoulder.userData.baseEm = 0.15;
        g.add(shoulder);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 8), mat(0x4a2818, 0xff3344, 0.2));
      head.position.set(0, 1.48, 0.38);
      head.userData.baseEm = 0.2;
      g.add(head);
      const maw = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 6, 6),
        mat(0x1a0808, 0xff2244, 0.9),
      );
      maw.position.set(0, 1.4, 0.62);
      maw.userData.baseEm = 0.9;
      g.add(maw);
    } else if (a.kind === 'wellborn') {
      const skirt = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 1.6, 8),
        mat(0x0c0618, 0x8a4dff, 0.4),
      );
      skirt.position.y = 0.7;
      skirt.rotation.x = Math.PI;
      skirt.userData.baseEm = 0.4;
      g.add(skirt);
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 1.25, 2.5, 8),
        mat(0x140820, 0xc77dff, 0.85),
      );
      core.position.y = 1.5;
      core.castShadow = true;
      core.userData.baseEm = 0.85;
      g.add(core);
      const sigil = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        mat(0xff88cc, 0xff4d6d, 1.3),
      );
      sigil.position.set(0, 1.8, 0.9);
      sigil.userData.baseEm = 1.3;
      g.add(sigil);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 1.3, 5),
        mat(0x2a1040, 0xff4d6d, 0.95),
      );
      crown.position.y = 3.35;
      crown.userData.baseEm = 0.95;
      g.add(crown);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.1, 0.55, 4),
          mat(0x3a1860, 0xc77dff, 0.7),
        );
        spike.position.set(Math.cos(ang) * 0.7, 3.85, Math.sin(ang) * 0.7);
        spike.userData.baseEm = 0.7;
        g.add(spike);
      }
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.45, 0.09, 8, 28),
        mat(0x000000, 0x5ce1ff, 1.5),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2.3;
      ring.userData.baseEm = 1.5;
      g.add(ring);
      for (let i = 0; i < 3; i++) {
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 8, 8),
          mat(0xffffff, 0xff66aa, 1.6),
        );
        const ang = (i / 3) * Math.PI * 2;
        orb.position.set(Math.cos(ang) * 1.45, 2.3, Math.sin(ang) * 1.45);
        orb.userData.baseEm = 1.6;
        g.add(orb);
      }
    }

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(a.radius * 1.25, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    g.add(shadow);

    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({
        color: a.isBoss ? 0xc77dff : 0xffaa33,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    disk.rotation.x = -Math.PI / 2;
    disk.position.y = 0.07;
    disk.name = 'telegraphDisk';
    disk.visible = false;
    g.add(disk);
    const tel = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1.0, 40),
      new THREE.MeshBasicMaterial({
        color: a.isBoss ? 0xe0a0ff : 0xff3355,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    tel.rotation.x = -Math.PI / 2;
    tel.position.y = 0.09;
    tel.name = 'telegraphRing';
    tel.visible = false;
    g.add(tel);
    return g;
  }
}
