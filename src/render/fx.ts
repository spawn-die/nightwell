import * as THREE from 'three';
import type { FxEvent, GameState } from '../game/types.js';

type Particle = {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  v: THREE.Vector3;
  spin?: number;
};

export class FxRenderer {
  group = new THREE.Group();
  private bolts = new Map<string, THREE.Mesh>();
  private pickups = new Map<string, THREE.Group>();
  private particles: Particle[] = [];
  private slashes: { mesh: THREE.Mesh; life: number; max: number }[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  /** Drain combat FX queue from pure sim */
  consumeEvents(events: FxEvent[]): void {
    for (const ev of events) {
      switch (ev.kind) {
        case 'hit':
          this.burst(ev.x, ev.z, ev.color ?? 0xff88aa, 10, 0.35);
          break;
        case 'death':
          this.burst(ev.x, ev.z, ev.color ?? 0xc77dff, 22, 0.7);
          this.ring(ev.x, ev.z, ev.color ?? 0xff66aa);
          break;
        case 'slash':
          this.slashArc(ev.x, ev.z, ev.color ?? 0x9bffea);
          break;
        case 'bolt':
          this.burst(ev.x, ev.z, ev.color ?? 0x6ec8ff, 6, 0.25);
          break;
        case 'dash':
          this.burst(ev.x, ev.z, ev.color ?? 0x5ce1ff, 8, 0.3);
          break;
      }
    }
    events.length = 0;
  }

  sync(state: GameState, dt: number): void {
    this.consumeEvents(state.fxQueue);

    // projectiles
    const seenB = new Set<string>();
    for (const pr of state.projectiles) {
      seenB.add(pr.id);
      let m = this.bolts.get(pr.id);
      if (!m) {
        m = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 10, 10),
          new THREE.MeshStandardMaterial({
            color: 0xaaddff,
            emissive: 0x44ccff,
            emissiveIntensity: 2.4,
          }),
        );
        // trail glow
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 8, 8),
          new THREE.MeshBasicMaterial({
            color: 0x66ddff,
            transparent: true,
            opacity: 0.25,
          }),
        );
        m.add(halo);
        this.bolts.set(pr.id, m);
        this.group.add(m);
      }
      m.position.set(pr.x, 1.15, pr.z);
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
          new THREE.OctahedronGeometry(0.32, 0),
          new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 1.1,
            metalness: 0.55,
            roughness: 0.25,
          }),
        );
        gem.position.y = 0.75;
        g.add(gem);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.45, 0.05, 6, 20),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.15;
        g.add(ring);
        const light = new THREE.PointLight(color, 1.2, 5, 2);
        light.position.y = 0.9;
        g.add(light);
        this.pickups.set(pk.id, g);
        this.group.add(g);
      }
      g.position.set(pk.x, 0, pk.z);
      g.rotation.y += dt * 2.2;
      g.position.y = Math.sin(state.time * 4 + pk.x) * 0.12;
    }
    for (const [id, g] of this.pickups) {
      if (!seenP.has(id)) {
        this.group.remove(g);
        this.pickups.delete(id);
      }
    }

    // ambient mote dust
    if (Math.random() < 0.22) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 4, 4),
        new THREE.MeshBasicMaterial({
          color: 0xc4a8ff,
          transparent: true,
          opacity: 0.55,
        }),
      );
      const px = state.player.x + (Math.random() - 0.5) * 16;
      const pz = state.player.z + (Math.random() - 0.5) * 16;
      mesh.position.set(px, 0.8 + Math.random() * 3.5, pz);
      this.group.add(mesh);
      this.particles.push({
        mesh,
        life: 1.8,
        max: 1.8,
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 0.35,
          0.35 + Math.random() * 0.45,
          (Math.random() - 0.5) * 0.35,
        ),
      });
    }

    for (const p of this.particles) {
      p.life -= dt;
      p.mesh.position.addScaledVector(p.v, dt);
      if (p.spin) p.mesh.rotation.y += p.spin * dt;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, (p.life / p.max) * 0.7);
    }
    this.particles = this.particles.filter((p) => {
      if (p.life > 0) return true;
      this.group.remove(p.mesh);
      return false;
    });

    for (const s of this.slashes) {
      s.life -= dt;
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, s.life / s.max);
      s.mesh.scale.multiplyScalar(1 + dt * 2.5);
    }
    this.slashes = this.slashes.filter((s) => {
      if (s.life > 0) return true;
      this.group.remove(s.mesh);
      return false;
    });
  }

  burst(x: number, z: number, color = 0xff66aa, count = 12, life = 0.45): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 4, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
      );
      mesh.position.set(x, 1 + Math.random() * 0.4, z);
      this.group.add(mesh);
      const ang = Math.random() * Math.PI * 2;
      const sp = 2.5 + Math.random() * 5;
      this.particles.push({
        mesh,
        life,
        max: life,
        v: new THREE.Vector3(Math.cos(ang) * sp, 1.5 + Math.random() * 4, Math.sin(ang) * sp),
      });
    }
  }

  ring(x: number, z: number, color: number): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.55, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.12, z);
    this.group.add(mesh);
    this.slashes.push({ mesh, life: 0.4, max: 0.4 });
  }

  slashArc(x: number, z: number, color: number): void {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.07, 6, 16, Math.PI * 1.1),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(x, 1.1, z);
    mesh.rotation.x = Math.PI / 2.4;
    mesh.rotation.z = Math.random() * 0.6;
    this.group.add(mesh);
    this.slashes.push({ mesh, life: 0.18, max: 0.18 });
    this.burst(x, z, color, 6, 0.22);
  }
}
