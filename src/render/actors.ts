import * as THREE from 'three';
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

export class ActorRenderer {
  group = new THREE.Group();
  private meshes = new Map<string, THREE.Group>();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  sync(state: GameState): void {
    const seen = new Set<string>();
    const all: Actor[] = [state.player, ...state.enemies];
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
      g.rotation.y = -a.facing + Math.PI / 2;
      // hit flash / windup pulse
      const windup = a.windup ?? 0;
      const windupMax = a.windupMax ?? 1;
      const windupT = windup > 0 ? 1 - windup / windupMax : 0;
      // Real hit footprint (matches resolveWindup ranges closely)
      const styleMul = a.attackStyle === 'slam' ? 1.55 : a.attackStyle === 'lunge' ? 1.35 : 1.1;
      const hitRadius = (a.attackRange ?? 1.5) * styleMul + 0.7;
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
          if (a.hitFlash > 0) {
            o.material.emissiveIntensity = 2.2;
          } else if (windup > 0) {
            o.material.emissiveIntensity = (o.userData.baseEm ?? 0.2) + 1.0 + windupT * 1.6;
          } else {
            o.material.emissiveIntensity = o.userData.baseEm ?? 0;
          }
        }
        // Filled danger disk + outer ring — yellow → red as strike lands
        if ((o.name === 'telegraphDisk' || o.name === 'telegraphRing') && o instanceof THREE.Mesh) {
          o.visible = windup > 0 && a.alive;
          o.scale.setScalar(Math.max(0.8, hitRadius));
          const mat = o.material as THREE.MeshBasicMaterial;
          const hot = windupT > 0.65;
          mat.color.setHex(hot ? 0xff2244 : a.isBoss ? 0xe0a0ff : 0xffaa33);
          if (o.name === 'telegraphDisk') {
            mat.opacity = 0.18 + windupT * 0.42;
          } else {
            mat.opacity = 0.55 + windupT * 0.4;
          }
        }
      });
      // death sink
      if (!a.alive) {
        g.position.y = -0.4;
        g.scale.setScalar(0.85);
      } else {
        g.scale.setScalar(1);
      }
      // player ground ring pulse + invuln blink
      if (a.kind === 'player') {
        const inv = state.invuln > 0;
        g.traverse((o) => {
          if (o.name === 'playerRing' && o instanceof THREE.Mesh) {
            const mat = o.material as THREE.MeshBasicMaterial;
            mat.opacity = inv
              ? 0.45 + Math.sin(Date.now() * 0.03) * 0.4
              : 0.9 + Math.sin(Date.now() * 0.008) * 0.08;
            mat.color.setHex(inv ? 0xffffff : 0x60ffe0);
          }
        });
        g.visible = a.alive && (!inv || Math.sin(Date.now() * 0.04) > -0.35);
      }
    }
    // remove stale
    for (const [id, g] of this.meshes) {
      if (!seen.has(id)) {
        this.group.remove(g);
        this.meshes.delete(id);
      }
    }
  }

  private buildActor(a: Actor): THREE.Group {
    const g = new THREE.Group();
    if (a.kind === 'player') {
      // Bright cyan warden — must pop against purple floors (slightly oversized)
      const cloak = new THREE.Mesh(
        new THREE.ConeGeometry(0.68, 1.3, 8),
        mat(0x2a6080, 0x50f0ff, 0.9),
      );
      cloak.position.y = 0.75;
      cloak.rotation.x = Math.PI;
      cloak.userData.baseEm = 0.9;
      g.add(cloak);
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.45, 0.85, 4, 8),
        mat(0x60ffb0, 0x80ffd0, 1.2),
      );
      body.position.y = 1.1;
      body.castShadow = true;
      body.userData.baseEm = 1.2;
      g.add(body);
      // thick ground ring — always find yourself
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.65, 0.95, 32),
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
      // soft fill disk under feet
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 24),
        new THREE.MeshBasicMaterial({
          color: 0x40ffc0,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.05;
      g.add(pad);
      // point light so player always lights nearby floor
      const glow = new THREE.PointLight(0x70ffe0, 4.5, 16, 1.6);
      glow.position.y = 1.5;
      g.add(glow);
      for (const sx of [-1, 1]) {
        const shoulder = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 8, 8),
          mat(0x80ffe0, 0x5ce1ff, 1.0),
        );
        shoulder.position.set(sx * 0.5, 1.45, 0);
        shoulder.scale.set(1.1, 0.7, 1);
        shoulder.userData.baseEm = 1.0;
        g.add(shoulder);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 12), mat(0xffe8d0, 0xffcc88, 0.35));
      head.position.y = 1.95;
      head.castShadow = true;
      head.userData.baseEm = 0.35;
      g.add(head);
      const hood = new THREE.Mesh(
        new THREE.ConeGeometry(0.48, 0.58, 8),
        mat(0x30a0c0, 0x50ffff, 1.0),
      );
      hood.position.y = 2.2;
      hood.userData.baseEm = 1.0;
      g.add(hood);
      // belt buckle glow
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.1, 0.35),
        mat(0x2a3040, 0x88ccff, 0.35),
      );
      belt.position.set(0, 0.85, 0.1);
      belt.userData.baseEm = 0.35;
      g.add(belt);
      // blade
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.28), mat(0x3a3048, 0x5ce1ff, 0.3));
      hilt.position.set(0.45, 1.1, 0);
      hilt.userData.baseEm = 0.3;
      g.add(hilt);
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, 1.35),
        mat(0xc0d0e0, 0x88ccff, 0.55),
      );
      blade.position.set(0.45, 1.1, 0.55);
      blade.userData.baseEm = 0.55;
      g.add(blade);
    } else if (a.kind === 'shade') {
      // Magenta void cone — high contrast vs floor
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
      // side wisps
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
      // jaw
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.2), mat(0xe0d8c8));
      jaw.position.set(0, 1.58, 0.18);
      g.add(jaw);
      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.95, 0.16), mat(0xd8d0c0));
        arm.position.set(sx * 0.55, 1.05, 0);
        arm.rotation.z = sx * 0.15;
        g.add(arm);
      }
      // legs
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
      // hunched shoulders
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
      // maw
      const maw = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 6, 6),
        mat(0x1a0808, 0xff2244, 0.9),
      );
      maw.position.set(0, 1.4, 0.62);
      maw.userData.baseEm = 0.9;
      g.add(maw);
    } else if (a.kind === 'wellborn') {
      // boss — tall crowned void entity with layered silhouette
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
      // chest sigil
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
      // crown spikes
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
    // shadow blob
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(a.radius * 1.25, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    g.add(shadow);

    if (a.kind !== 'player') {
      // Unit-radius disk scaled to real hit radius in sync()
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
    }
    return g;
  }
}
