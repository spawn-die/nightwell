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
      // hit flash
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
          o.material.emissiveIntensity = a.hitFlash > 0 ? 1.5 : (o.userData.baseEm ?? 0);
        }
      });
      // death sink
      if (!a.alive) {
        g.position.y = -0.4;
        g.scale.setScalar(0.85);
      } else {
        g.scale.setScalar(1);
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
      // warden silhouette
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 8), mat(0x3d4a5c, 0x6ec8ff, 0.2));
      body.position.y = 1.0;
      body.castShadow = true;
      body.userData.baseEm = 0.2;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), mat(0xc4a882));
      head.position.y = 1.75;
      head.castShadow = true;
      g.add(head);
      // hood
      const hood = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, 0.45, 8),
        mat(0x1a2030, 0x5ce1ff, 0.15),
      );
      hood.position.y = 1.95;
      hood.userData.baseEm = 0.15;
      g.add(hood);
      // blade
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 1.3),
        mat(0xaab8c8, 0x88ccff, 0.4),
      );
      blade.position.set(0.45, 1.1, 0.35);
      blade.userData.baseEm = 0.4;
      g.add(blade);
    } else if (a.kind === 'shade') {
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 1.6, 6),
        mat(0x2a1840, 0x7b4dff, 0.55),
      );
      body.position.y = 0.9;
      body.castShadow = true;
      body.userData.baseEm = 0.55;
      g.add(body);
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        mat(0xff6699, 0xff2266, 1.2),
      );
      eye.position.set(0, 1.35, 0.25);
      eye.userData.baseEm = 1.2;
      g.add(eye);
    } else if (a.kind === 'bone') {
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), mat(0xd8d0c0, 0x444444, 0.05));
      torso.position.y = 1.1;
      torso.castShadow = true;
      g.add(torso);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), mat(0xf0e8d8));
      skull.position.y = 1.8;
      g.add(skull);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.18), mat(0xd8d0c0));
      arm.position.set(0.55, 1.1, 0);
      g.add(arm);
    } else if (a.kind === 'wretch') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 10), mat(0x3a2018, 0xff4d6d, 0.2));
      body.position.y = 0.75;
      body.scale.set(1, 0.85, 1.1);
      body.castShadow = true;
      body.userData.baseEm = 0.2;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mat(0x4a2818));
      head.position.set(0, 1.45, 0.35);
      g.add(head);
    } else if (a.kind === 'wellborn') {
      // boss — tall crowned void entity
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.2, 2.4, 8),
        mat(0x140820, 0xc77dff, 0.7),
      );
      core.position.y = 1.4;
      core.castShadow = true;
      core.userData.baseEm = 0.7;
      g.add(core);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 1.2, 5),
        mat(0x2a1040, 0xff4d6d, 0.8),
      );
      crown.position.y = 3.2;
      crown.userData.baseEm = 0.8;
      g.add(crown);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.4, 0.08, 8, 24),
        mat(0x000000, 0x5ce1ff, 1.4),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2.2;
      ring.userData.baseEm = 1.4;
      g.add(ring);
      for (let i = 0; i < 3; i++) {
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 8, 8),
          mat(0xffffff, 0xff66aa, 1.5),
        );
        const ang = (i / 3) * Math.PI * 2;
        orb.position.set(Math.cos(ang) * 1.4, 2.2, Math.sin(ang) * 1.4);
        orb.userData.baseEm = 1.5;
        g.add(orb);
      }
    }
    // shadow blob
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(a.radius * 1.2, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    g.add(shadow);
    return g;
  }
}
