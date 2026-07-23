import * as THREE from 'three';
import type { GameState, Room } from '../game/types.js';
import { roomBounds } from '../game/dungeon.js';

const COL = {
  floor: 0x2a2440,
  floorAccent: 0x3d3460,
  wall: 0x1c1830,
  wallEdge: 0x6a4a9a,
  pillar: 0x2a2448,
  emissive: 0x9b6dff,
  emissiveHot: 0xff5a70,
  door: 0x7aeeff,
  shrine: 0xffd98a,
};

export class WorldRenderer {
  group = new THREE.Group();
  private roomGroups = new Map<number, THREE.Group>();
  private torchLights: THREE.PointLight[] = [];

  constructor(private scene: THREE.Scene) {
    this.scene.add(this.group);
    // ambient + hemisphere — readable gothic, not pure black
    const amb = new THREE.AmbientLight(0x4a3a70, 0.75);
    this.scene.add(amb);
    const hemi = new THREE.HemisphereLight(0xc0a8ff, 0x1a1028, 1.05);
    this.scene.add(hemi);
    // key moon shaft
    const dir = new THREE.DirectionalLight(0xe8dcff, 1.35);
    dir.position.set(-18, 45, -8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 120;
    dir.shadow.camera.left = -45;
    dir.shadow.camera.right = 45;
    dir.shadow.camera.top = 45;
    dir.shadow.camera.bottom = -45;
    dir.shadow.bias = -0.0002;
    this.scene.add(dir);
    // fill
    const fill = new THREE.DirectionalLight(0x66aaff, 0.35);
    fill.position.set(20, 20, 25);
    this.scene.add(fill);

    this.scene.background = new THREE.Color(0x0c0a18);
    this.scene.fog = new THREE.FogExp2(0x100c1c, 0.018);
  }

  rebuild(state: GameState): void {
    // clear rooms
    for (const g of this.roomGroups.values()) {
      this.group.remove(g);
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    }
    this.roomGroups.clear();
    for (const l of this.torchLights) {
      this.scene.remove(l);
      l.dispose();
    }
    this.torchLights = [];

    for (const room of state.rooms) {
      const g = this.buildRoom(room);
      this.roomGroups.set(room.id, g);
      this.group.add(g);
    }

    // connecting corridors
    for (let i = 0; i < state.rooms.length - 1; i++) {
      const a = state.rooms[i]!;
      const b = state.rooms[i + 1]!;
      const ab = roomBounds(a);
      const bb = roomBounds(b);
      const z0 = ab.maxZ;
      const z1 = bb.minZ;
      const midZ = (z0 + z1) / 2;
      const len = z1 - z0;
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.35, len),
        new THREE.MeshStandardMaterial({ color: COL.floorAccent, roughness: 0.92, metalness: 0.05 }),
      );
      floor.position.set(0, -0.15, midZ);
      floor.receiveShadow = true;
      this.group.add(floor);

      for (const side of [-1, 1]) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 5, len),
          new THREE.MeshStandardMaterial({ color: COL.wall, roughness: 0.95 }),
        );
        wall.position.set(side * 3.2, 2.2, midZ);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.group.add(wall);
      }
    }
  }

  private buildRoom(room: Room): THREE.Group {
    const g = new THREE.Group();
    g.position.set(room.cx, 0, room.cz);
    const matFloor = new THREE.MeshStandardMaterial({
      color: room.kind === 'boss' ? 0x1a1028 : COL.floor,
      roughness: 0.9,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(room.w, 0.4, room.d), matFloor);
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    g.add(floor);

    // patterned tiles
    const tileMat = new THREE.MeshStandardMaterial({
      color: COL.floorAccent,
      roughness: 0.85,
      metalness: 0.12,
      emissive: room.kind === 'boss' ? 0x2a0840 : 0x0a0618,
      emissiveIntensity: 0.25,
    });
    for (let ix = -2; ix <= 2; ix++) {
      for (let iz = -2; iz <= 2; iz++) {
        if ((ix + iz) % 2 === 0) continue;
        const tile = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 2.2), tileMat);
        tile.position.set(ix * 3.5, 0.02, iz * 3.2);
        tile.receiveShadow = true;
        g.add(tile);
      }
    }

    const wallH = room.kind === 'boss' ? 8 : 5.5;
    const wallMat = new THREE.MeshStandardMaterial({
      color: COL.wall,
      roughness: 0.95,
      metalness: 0.05,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: COL.wallEdge,
      roughness: 0.7,
      metalness: 0.2,
      emissive: COL.emissive,
      emissiveIntensity: 0.15,
    });

    // walls with door gaps
    const halfW = room.w / 2;
    const halfD = room.d / 2;
    const doorW = 5;

    // North wall
    this.addWallWithDoor(g, room.w, wallH, 0, wallH / 2, -halfD, 0, room.doors.n, doorW, wallMat, edgeMat);
    // South
    this.addWallWithDoor(g, room.w, wallH, 0, wallH / 2, halfD, Math.PI, room.doors.s, doorW, wallMat, edgeMat);
    // East / West full
    for (const side of [-1, 1] as const) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.55, wallH, room.d), wallMat);
      w.position.set(side * halfW, wallH / 2, 0);
      w.castShadow = true;
      w.receiveShadow = true;
      g.add(w);
    }

    // pillars
    const pillarGeo = new THREE.CylinderGeometry(0.45, 0.55, wallH * 0.9, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: COL.pillar,
      roughness: 0.8,
      metalness: 0.15,
    });
    const positions: [number, number][] = [
      [-halfW + 2.2, -halfD + 2.2],
      [halfW - 2.2, -halfD + 2.2],
      [-halfW + 2.2, halfD - 2.2],
      [halfW - 2.2, halfD - 2.2],
    ];
    for (const [px, pz] of positions) {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(px, wallH * 0.45, pz);
      p.castShadow = true;
      g.add(p);
      // torch
      const torch = new THREE.PointLight(
        room.kind === 'boss' ? COL.emissiveHot : 0xffb070,
        room.kind === 'boss' ? 6.5 : 4.0,
        22,
        1.6,
      );
      torch.position.set(px, 3.2, pz);
      torch.castShadow = true;
      this.scene.add(torch);
      this.torchLights.push(torch);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xff6622,
          emissive: 0xff4400,
          emissiveIntensity: 2,
        }),
      );
      flame.position.set(px, 3.2, pz);
      g.add(flame);
    }

    // center feature
    if (room.kind === 'shrine') {
      const shrine = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.6, 0.6, 6),
        new THREE.MeshStandardMaterial({
          color: 0x2a2438,
          emissive: COL.shrine,
          emissiveIntensity: 0.4,
          metalness: 0.4,
          roughness: 0.4,
        }),
      );
      shrine.position.y = 0.3;
      g.add(shrine);
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7, 0),
        new THREE.MeshStandardMaterial({
          color: 0xaaddff,
          emissive: 0x44aaff,
          emissiveIntensity: 1.2,
          transparent: true,
          opacity: 0.9,
        }),
      );
      crystal.position.y = 1.4;
      crystal.name = 'shrineCrystal';
      g.add(crystal);
    }

    if (room.kind === 'boss') {
      // pit ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(6, 0.25, 8, 32),
        new THREE.MeshStandardMaterial({
          color: 0x220018,
          emissive: COL.emissiveHot,
          emissiveIntensity: 0.6,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.15;
      g.add(ring);
      const pit = new THREE.Mesh(
        new THREE.CircleGeometry(5.5, 32),
        new THREE.MeshStandardMaterial({
          color: 0x050208,
          emissive: 0x3a0020,
          emissiveIntensity: 0.5,
        }),
      );
      pit.rotation.x = -Math.PI / 2;
      pit.position.y = 0.05;
      g.add(pit);
    }

    if (room.kind === 'entrance') {
      // gateway pillars + lintel (readable set piece)
      const gateMat = new THREE.MeshStandardMaterial({
        color: 0x2a2048,
        emissive: COL.emissive,
        emissiveIntensity: 0.45,
        metalness: 0.25,
        roughness: 0.55,
      });
      for (const sx of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.2, 0.7), gateMat);
        col.position.set(sx * 2.8, 2.6, halfD - 1.2);
        col.castShadow = true;
        g.add(col);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.55, 0.8), gateMat);
      lintel.position.set(0, 5.2, halfD - 1.2);
      g.add(lintel);
      const rune = new THREE.Mesh(
        new THREE.TorusGeometry(1.4, 0.08, 8, 24),
        new THREE.MeshStandardMaterial({
          color: 0x88eeff,
          emissive: 0x44ddff,
          emissiveIntensity: 1.2,
        }),
      );
      rune.position.set(0, 3.2, halfD - 1.2);
      g.add(rune);
    }

    // door glow planes
    if (room.doors.n) {
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(doorW * 0.9, 3.5),
        new THREE.MeshBasicMaterial({
          color: COL.door,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
        }),
      );
      glow.position.set(0, 1.8, -halfD + 0.4);
      g.add(glow);
    }

    return g;
  }

  private addWallWithDoor(
    g: THREE.Group,
    width: number,
    height: number,
    x: number,
    y: number,
    z: number,
    rotY: number,
    hasDoor: boolean,
    doorW: number,
    wallMat: THREE.Material,
    edgeMat: THREE.Material,
  ): void {
    if (!hasDoor) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.55), wallMat);
      w.position.set(x, y, z);
      w.rotation.y = rotY;
      w.castShadow = true;
      w.receiveShadow = true;
      g.add(w);
      return;
    }
    const side = (width - doorW) / 2;
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(side, height, 0.55), wallMat);
      // local offset along wall axis
      const offset = sx * (doorW / 2 + side / 2);
      w.position.set(x + Math.cos(rotY) * offset, y, z + Math.sin(rotY) * offset);
      // for north/south walls rot is 0 or PI — simpler place along X
      w.position.set(x + offset, y, z);
      w.castShadow = true;
      w.receiveShadow = true;
      g.add(w);
    }
    // lintel
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.4, 0.5, 0.6), edgeMat);
    lintel.position.set(x, height - 0.4, z);
    g.add(lintel);
  }

  pulse(time: number): void {
    this.group.traverse((o) => {
      if (o.name === 'shrineCrystal' && o instanceof THREE.Mesh) {
        o.rotation.y = time * 0.8;
        o.position.y = 1.4 + Math.sin(time * 2) * 0.1;
      }
    });
    for (const l of this.torchLights) {
      l.intensity = l.color.getHex() === COL.emissiveHot ? 4.2 + Math.sin(time * 7 + l.position.x) * 0.6 : 2 + Math.sin(time * 9 + l.position.z) * 0.35;
    }
  }
}
