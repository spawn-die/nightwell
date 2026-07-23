import * as THREE from 'three';
import type { GameState } from '../game/types.js';

export class FxRenderer {
  group = new THREE.Group();
  private bolts = new Map<string, THREE.Mesh>();
  private pickups = new Map<string, THREE.Group>();
  private particles: { mesh: THREE.Mesh; life: number; max: number; v: THREE.Vector3 }[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  sync(state: GameState, dt: number): void {
    // projectiles
    const seenB = new Set<string>();
    for (const pr of state.projectiles) {
      seenB.add(pr.id);
      let m = this.bolts.get(pr.id);
      if (!m) {
        m = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 8, 8),
          new THREE.MeshStandardMaterial({
            color: 0xaaddff,
            emissive: 0x44ccff,
            emissiveIntensity: 2,
          }),
        );
        this.bolts.set(pr.id, m);
        this.group.add(m);
      }
      m.position.set(pr.x, 1.1, pr.z);
    }
    for (const [id, m] of this.bolts) {
      if (!seenB.has(id)) {
        this.group.remove(m);
        this.bolts.delete(id);
      }
    }

    // pickups
    const seenP = new Set<string>();
    for (const pk of state.pickups) {
      seenP.add(pk.id);
      let g = this.pickups.get(pk.id);
      if (!g) {
        g = new THREE.Group();
        const color =
          pk.item.rarity === 'echo' ? 0xc77dff : pk.item.rarity === 'rare' ? 0x5ce1ff : 0xe8c872;
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28, 0),
          new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.9,
            metalness: 0.5,
            roughness: 0.3,
          }),
        );
        gem.position.y = 0.7;
        g.add(gem);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.4, 0.04, 6, 16),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.15;
        g.add(ring);
        this.pickups.set(pk.id, g);
        this.group.add(g);
      }
      g.position.set(pk.x, 0, pk.z);
      g.rotation.y += dt * 2;
      g.position.y = Math.sin(state.time * 4 + pk.x) * 0.1;
    }
    for (const [id, g] of this.pickups) {
      if (!seenP.has(id)) {
        this.group.remove(g);
        this.pickups.delete(id);
      }
    }

    // ambient dust
    if (Math.random() < 0.15) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 4, 4),
        new THREE.MeshBasicMaterial({
          color: 0xaa88ff,
          transparent: true,
          opacity: 0.5,
        }),
      );
      const px = state.player.x + (Math.random() - 0.5) * 14;
      const pz = state.player.z + (Math.random() - 0.5) * 14;
      mesh.position.set(px, 1 + Math.random() * 3, pz);
      this.group.add(mesh);
      this.particles.push({
        mesh,
        life: 1.5,
        max: 1.5,
        v: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3),
      });
    }

    for (const p of this.particles) {
      p.life -= dt;
      p.mesh.position.addScaledVector(p.v, dt);
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, p.life / p.max) * 0.5;
    }
    this.particles = this.particles.filter((p) => {
      if (p.life > 0) return true;
      this.group.remove(p.mesh);
      return false;
    });
  }

  burst(x: number, z: number, color = 0xff66aa): void {
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 4, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
      );
      mesh.position.set(x, 1, z);
      this.group.add(mesh);
      const ang = Math.random() * Math.PI * 2;
      this.particles.push({
        mesh,
        life: 0.45,
        max: 0.45,
        v: new THREE.Vector3(Math.cos(ang) * 4, 2 + Math.random() * 3, Math.sin(ang) * 4),
      });
    }
  }
}
