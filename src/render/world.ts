import * as THREE from 'three';
import type { GameState, Room } from '../game/types.js';
import { roomBounds } from '../game/dungeon.js';

/** Brighter, more readable gothic palette */
const COL = {
  floor: 0x342c52,
  floorAccent: 0x4a4070,
  floorRune: 0x7b5cff,
  wall: 0x241e3a,
  wallEdge: 0x8a5cc8,
  pillar: 0x322a52,
  banner: 0x5a1840,
  bannerTrim: 0xc9a24a,
  wood: 0x3a2818,
  stone: 0x3c3458,
  coffin: 0x2a2438,
  crate: 0x4a3420,
  rubble: 0x4a4460,
  emissive: 0xb48dff,
  emissiveHot: 0xff5a70,
  door: 0x7aeeff,
  shrine: 0xffd98a,
  bossGlow: 0xff3d6a,
  beam: 0x2e2438,
};

export class WorldRenderer {
  group = new THREE.Group();
  private roomGroups = new Map<number, THREE.Group>();
  private torchLights: THREE.PointLight[] = [];
  private pulseMeshes: THREE.Mesh[] = [];

  constructor(private scene: THREE.Scene) {
    this.scene.add(this.group);
    // ambient + hemisphere — readable gothic, not pure black
    const amb = new THREE.AmbientLight(0x5a4a88, 0.85);
    this.scene.add(amb);
    const hemi = new THREE.HemisphereLight(0xd0b8ff, 0x1a1028, 1.15);
    this.scene.add(hemi);
    // key moon shaft
    const dir = new THREE.DirectionalLight(0xf0e8ff, 1.45);
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
    const fill = new THREE.DirectionalLight(0x77bbff, 0.42);
    fill.position.set(20, 20, 25);
    this.scene.add(fill);

    this.scene.background = new THREE.Color(0x0c0a18);
    this.scene.fog = new THREE.FogExp2(0x100c1c, 0.016);
  }

  rebuild(state: GameState): void {
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
    this.pulseMeshes = [];

    // clear non-room children (corridors from prior rebuild)
    const keep = new Set(this.roomGroups.values());
    const toRemove: THREE.Object3D[] = [];
    this.group.traverse((o) => {
      if (o !== this.group && o.parent === this.group && !keep.has(o as THREE.Group)) {
        toRemove.push(o);
      }
    });
    for (const o of toRemove) {
      this.group.remove(o);
      o.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          const m = c.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    }

    for (const room of state.rooms) {
      const g = this.buildRoom(room);
      this.roomGroups.set(room.id, g);
      this.group.add(g);
    }

    // connecting corridors with set dressing
    for (let i = 0; i < state.rooms.length - 1; i++) {
      const a = state.rooms[i]!;
      const b = state.rooms[i + 1]!;
      const ab = roomBounds(a);
      const bb = roomBounds(b);
      const z0 = ab.maxZ;
      const z1 = bb.minZ;
      const midZ = (z0 + z1) / 2;
      const len = Math.max(0.5, z1 - z0);
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.35, len),
        new THREE.MeshStandardMaterial({
          color: COL.floorAccent,
          roughness: 0.88,
          metalness: 0.08,
        }),
      );
      floor.position.set(0, -0.15, midZ);
      floor.receiveShadow = true;
      this.group.add(floor);

      // corridor floor strip runes
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.04, len * 0.85),
        new THREE.MeshStandardMaterial({
          color: COL.floorRune,
          emissive: COL.emissive,
          emissiveIntensity: 0.55,
          roughness: 0.5,
        }),
      );
      strip.position.set(0, 0.04, midZ);
      this.group.add(strip);

      for (const side of [-1, 1]) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 5, len),
          new THREE.MeshStandardMaterial({ color: COL.wall, roughness: 0.92, metalness: 0.06 }),
        );
        wall.position.set(side * 3.2, 2.2, midZ);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.group.add(wall);

        // wall sconces along corridor
        if (len > 3) {
          const sconce = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.35, 0.2),
            new THREE.MeshStandardMaterial({
              color: 0x3a3048,
              emissive: 0xff8844,
              emissiveIntensity: 0.8,
            }),
          );
          sconce.position.set(side * 2.9, 2.6, midZ);
          this.group.add(sconce);
        }
      }

      // ceiling beams across corridor
      const beamCount = Math.max(1, Math.floor(len / 3.5));
      for (let bi = 0; bi < beamCount; bi++) {
        const bz = z0 + ((bi + 0.5) / beamCount) * len;
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(6.4, 0.28, 0.35),
          new THREE.MeshStandardMaterial({ color: COL.beam, roughness: 0.9 }),
        );
        beam.position.set(0, 4.6, bz);
        this.group.add(beam);
      }
    }
  }

  private buildRoom(room: Room): THREE.Group {
    const g = new THREE.Group();
    g.position.set(room.cx, 0, room.cz);
    const isBoss = room.kind === 'boss';
    const isEntrance = room.kind === 'entrance';
    const isShrine = room.kind === 'shrine';

    const matFloor = new THREE.MeshStandardMaterial({
      color: isBoss ? 0x221530 : COL.floor,
      roughness: 0.86,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(room.w, 0.4, room.d), matFloor);
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    g.add(floor);

    // patterned tiles — brighter accent
    const tileMat = new THREE.MeshStandardMaterial({
      color: isBoss ? 0x3a1848 : COL.floorAccent,
      roughness: 0.78,
      metalness: 0.14,
      emissive: isBoss ? 0x3a0848 : 0x120a28,
      emissiveIntensity: isBoss ? 0.35 : 0.22,
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

    // floor runes — concentric / radial gothic glyphs
    this.addFloorRunes(g, room);

    const wallH = isBoss ? 8.5 : 5.8;
    const wallMat = new THREE.MeshStandardMaterial({
      color: COL.wall,
      roughness: 0.92,
      metalness: 0.06,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: COL.wallEdge,
      roughness: 0.65,
      metalness: 0.25,
      emissive: COL.emissive,
      emissiveIntensity: 0.28,
    });

    const halfW = room.w / 2;
    const halfD = room.d / 2;
    const doorW = 5;

    this.addWallWithDoor(g, room.w, wallH, 0, wallH / 2, -halfD, 0, room.doors.n, doorW, wallMat, edgeMat);
    this.addWallWithDoor(g, room.w, wallH, 0, wallH / 2, halfD, Math.PI, room.doors.s, doorW, wallMat, edgeMat);
    for (const side of [-1, 1] as const) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.55, wallH, room.d), wallMat);
      w.position.set(side * halfW, wallH / 2, 0);
      w.castShadow = true;
      w.receiveShadow = true;
      g.add(w);
    }

    // wall banners + alcoves on side walls
    this.addBannersAndAlcoves(g, room, wallH, halfW, halfD);

    // ceiling beams / arches
    this.addCeilingStructure(g, room, wallH, halfW, halfD);

    // pillars + torches
    const pillarGeo = new THREE.CylinderGeometry(0.48, 0.58, wallH * 0.9, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: COL.pillar,
      roughness: 0.75,
      metalness: 0.18,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: COL.wallEdge,
      roughness: 0.55,
      metalness: 0.3,
      emissive: COL.emissive,
      emissiveIntensity: 0.2,
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
      // capital
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 1.15), capMat);
      cap.position.set(px, wallH * 0.9, pz);
      g.add(cap);
      // base
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.72, 0.25, 8), pillarMat);
      base.position.set(px, 0.15, pz);
      g.add(base);

      const torch = new THREE.PointLight(
        isBoss ? COL.emissiveHot : 0xffb878,
        isBoss ? 7.2 : 4.4,
        24,
        1.55,
      );
      torch.position.set(px, 3.35, pz);
      torch.castShadow = true;
      this.scene.add(torch);
      this.torchLights.push(torch);

      // torch bracket + flame
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.4, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x3a3048, metalness: 0.5, roughness: 0.4 }),
      );
      bracket.position.set(px, 3.0, pz);
      g.add(bracket);
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xff7733,
          emissive: 0xff4400,
          emissiveIntensity: 2.4,
        }),
      );
      flame.position.set(px, 3.35, pz);
      flame.name = 'torchFlame';
      g.add(flame);
      this.pulseMeshes.push(flame);
    }

    // props: rubble, coffins, crates (avoid boss pit center)
    this.addProps(g, room, halfW, halfD);

    // center features
    if (isShrine) {
      this.addShrine(g);
    }
    if (isBoss) {
      this.addBossPit(g, wallH);
    }
    if (isEntrance) {
      this.addEntranceGate(g, halfD, wallH);
    }

    // door glow planes
    if (room.doors.n) {
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(doorW * 0.9, 3.5),
        new THREE.MeshBasicMaterial({
          color: COL.door,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
        }),
      );
      glow.position.set(0, 1.8, -halfD + 0.4);
      g.add(glow);
    }
    if (room.doors.s) {
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(doorW * 0.9, 3.5),
        new THREE.MeshBasicMaterial({
          color: COL.door,
          transparent: true,
          opacity: 0.1,
          side: THREE.DoubleSide,
        }),
      );
      glow.position.set(0, 1.8, halfD - 0.4);
      g.add(glow);
    }

    return g;
  }

  private addFloorRunes(g: THREE.Group, room: Room): void {
    const runeMat = new THREE.MeshStandardMaterial({
      color: COL.floorRune,
      emissive: room.kind === 'boss' ? COL.bossGlow : COL.emissive,
      emissiveIntensity: room.kind === 'boss' ? 0.85 : 0.5,
      roughness: 0.45,
      metalness: 0.35,
    });

    // outer circle of small plates
    const count = room.kind === 'boss' ? 12 : 8;
    const radius = Math.min(room.w, room.d) * 0.28;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.22), runeMat);
      plate.position.set(Math.cos(ang) * radius, 0.05, Math.sin(ang) * radius);
      plate.rotation.y = -ang;
      g.add(plate);
    }

    // center diamond
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), runeMat);
    diamond.position.y = 0.06;
    diamond.scale.set(1, 0.08, 1);
    diamond.rotation.y = Math.PI / 4;
    g.add(diamond);

    // cross bars
    for (const rot of [0, Math.PI / 2]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.6, 0.035, 0.12), runeMat);
      bar.position.y = 0.045;
      bar.rotation.y = rot;
      g.add(bar);
    }
  }

  private addBannersAndAlcoves(
    g: THREE.Group,
    room: Room,
    wallH: number,
    halfW: number,
    halfD: number,
  ): void {
    const bannerMat = new THREE.MeshStandardMaterial({
      color: room.kind === 'boss' ? 0x4a1028 : COL.banner,
      roughness: 0.85,
      metalness: 0.05,
      emissive: room.kind === 'boss' ? 0x400820 : 0x200818,
      emissiveIntensity: 0.25,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: COL.bannerTrim,
      metalness: 0.55,
      roughness: 0.4,
      emissive: 0x6a4a10,
      emissiveIntensity: 0.15,
    });
    const alcoveMat = new THREE.MeshStandardMaterial({
      color: 0x181228,
      roughness: 0.95,
    });

    // side-wall banners (E/W)
    const bannerZs = [-halfD * 0.35, halfD * 0.35];
    for (const side of [-1, 1] as const) {
      for (const bz of bannerZs) {
        const banner = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallH * 0.45, 1.1), bannerMat);
        banner.position.set(side * (halfW - 0.4), wallH * 0.42, bz);
        g.add(banner);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), trimMat);
        rod.rotation.z = Math.PI / 2;
        rod.position.set(side * (halfW - 0.4), wallH * 0.65, bz);
        g.add(rod);
        // hanging tip
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 3), bannerMat);
        tip.position.set(side * (halfW - 0.4), wallH * 0.18, bz);
        tip.rotation.x = Math.PI;
        g.add(tip);
      }

      // alcove niches mid-wall
      const alcove = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6, 1.4), alcoveMat);
      alcove.position.set(side * (halfW - 0.25), 1.4, 0);
      g.add(alcove);
      // statue stub in alcove
      const bust = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.28, 0.9, 6),
        new THREE.MeshStandardMaterial({
          color: COL.stone,
          roughness: 0.7,
          metalness: 0.1,
          emissive: COL.emissive,
          emissiveIntensity: 0.12,
        }),
      );
      bust.position.set(side * (halfW - 0.55), 1.1, 0);
      bust.castShadow = true;
      g.add(bust);
      const bustHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x4a4060, roughness: 0.65 }),
      );
      bustHead.position.set(side * (halfW - 0.55), 1.7, 0);
      g.add(bustHead);
    }

    // north wall decorative frieze
    if (!room.doors.n || room.w > 10) {
      const frieze = new THREE.Mesh(
        new THREE.BoxGeometry(room.w * 0.55, 0.35, 0.2),
        trimMat,
      );
      frieze.position.set(0, wallH * 0.72, -halfD + 0.4);
      g.add(frieze);
    }
  }

  private addCeilingStructure(
    g: THREE.Group,
    room: Room,
    wallH: number,
    halfW: number,
    halfD: number,
  ): void {
    const beamMat = new THREE.MeshStandardMaterial({
      color: COL.beam,
      roughness: 0.88,
      metalness: 0.05,
    });
    const archMat = new THREE.MeshStandardMaterial({
      color: COL.stone,
      roughness: 0.8,
      metalness: 0.08,
      emissive: 0x1a1030,
      emissiveIntensity: 0.15,
    });

    // transverse beams
    const beamCount = Math.max(2, Math.floor(room.d / 5));
    for (let i = 0; i < beamCount; i++) {
      const t = (i + 0.5) / beamCount;
      const bz = -halfD + t * room.d;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(room.w - 0.8, 0.32, 0.4), beamMat);
      beam.position.set(0, wallH - 0.35, bz);
      g.add(beam);

      // hanging chain stubs
      if (i % 2 === 0) {
        for (const sx of [-0.35, 0.35]) {
          const chain = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5),
            new THREE.MeshStandardMaterial({ color: 0x555060, metalness: 0.7, roughness: 0.35 }),
          );
          chain.position.set(sx * halfW * 0.5, wallH - 0.9, bz);
          g.add(chain);
        }
      }
    }

    // center arch ribs (visual only)
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(Math.min(halfW, halfD) * 0.55, 0.12, 6, 20, Math.PI),
      archMat,
    );
    rib.position.set(0, wallH * 0.55, 0);
    rib.rotation.x = Math.PI;
    rib.rotation.z = Math.PI / 2;
    g.add(rib);

    // longitudinal ridge beam
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, room.d - 1), beamMat);
    ridge.position.set(0, wallH - 0.2, 0);
    g.add(ridge);
  }

  private addProps(g: THREE.Group, room: Room, halfW: number, halfD: number): void {
    const coffinMat = new THREE.MeshStandardMaterial({
      color: COL.coffin,
      roughness: 0.8,
      metalness: 0.12,
      emissive: 0x120820,
      emissiveIntensity: 0.15,
    });
    const crateMat = new THREE.MeshStandardMaterial({
      color: COL.crate,
      roughness: 0.9,
      metalness: 0.05,
    });
    const rubbleMat = new THREE.MeshStandardMaterial({
      color: COL.rubble,
      roughness: 0.95,
      metalness: 0.04,
    });

    // skip dense center clutter in boss (pit owns the middle)
    const margin = 2.8;
    const spots: { x: number; z: number; kind: 'coffin' | 'crate' | 'rubble' }[] = [
      { x: -halfW + margin, z: -halfD + margin + 1.2, kind: 'coffin' },
      { x: halfW - margin, z: -halfD + margin + 0.8, kind: 'crate' },
      { x: -halfW + margin + 0.5, z: halfD - margin - 0.5, kind: 'crate' },
      { x: halfW - margin - 0.3, z: halfD - margin - 1.0, kind: 'coffin' },
      { x: -halfW + margin + 1.5, z: 0, kind: 'rubble' },
      { x: halfW - margin - 1.2, z: 0.8, kind: 'rubble' },
    ];

    if (room.kind === 'hall') {
      spots.push(
        { x: -2.5, z: halfD * 0.25, kind: 'crate' },
        { x: 2.8, z: -halfD * 0.2, kind: 'rubble' },
      );
    }

    for (const s of spots) {
      if (room.kind === 'boss' && Math.hypot(s.x, s.z) < 7) continue;
      if (room.kind === 'shrine' && Math.hypot(s.x, s.z) < 2.5) continue;

      if (s.kind === 'coffin') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 2.2), coffinMat);
        box.position.set(s.x, 0.28, s.z);
        box.rotation.y = (s.x > 0 ? 0.15 : -0.12) + Math.PI / 2;
        box.castShadow = true;
        box.receiveShadow = true;
        g.add(box);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 2.25), coffinMat);
        lid.position.set(s.x, 0.58, s.z);
        lid.rotation.y = box.rotation.y;
        lid.rotation.z = 0.08;
        g.add(lid);
        // iron bands
        for (const oz of [-0.6, 0.6]) {
          const band = new THREE.Mesh(
            new THREE.BoxGeometry(1.18, 0.08, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x4a4058, metalness: 0.6, roughness: 0.4 }),
          );
          band.position.set(s.x, 0.35, s.z + oz * Math.cos(box.rotation.y));
          band.rotation.y = box.rotation.y;
          g.add(band);
        }
      } else if (s.kind === 'crate') {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.9), crateMat);
        crate.position.set(s.x, 0.38, s.z);
        crate.rotation.y = 0.3;
        crate.castShadow = true;
        crate.receiveShadow = true;
        g.add(crate);
        // smaller stacked crate
        const stack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), crateMat);
        stack.position.set(s.x + 0.15, 0.95, s.z - 0.1);
        stack.rotation.y = -0.4;
        stack.castShadow = true;
        g.add(stack);
      } else {
        // rubble pile
        for (let i = 0; i < 4; i++) {
          const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.18 + (i % 3) * 0.08, 0),
            rubbleMat,
          );
          rock.position.set(
            s.x + (i - 1.5) * 0.28,
            0.12 + (i % 2) * 0.08,
            s.z + ((i % 2) - 0.5) * 0.3,
          );
          rock.rotation.set(i * 0.4, i * 0.7, i * 0.2);
          rock.castShadow = true;
          g.add(rock);
        }
      }
    }
  }

  private addShrine(g: THREE.Group): void {
    const shrine = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.6, 0.6, 6),
      new THREE.MeshStandardMaterial({
        color: 0x322850,
        emissive: COL.shrine,
        emissiveIntensity: 0.5,
        metalness: 0.45,
        roughness: 0.38,
      }),
    );
    shrine.position.y = 0.3;
    g.add(shrine);
    // steps
    const step = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 2.2, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: COL.stone, roughness: 0.85 }),
    );
    step.position.y = 0.08;
    g.add(step);
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.75, 0),
      new THREE.MeshStandardMaterial({
        color: 0xb8e8ff,
        emissive: 0x55bbff,
        emissiveIntensity: 1.4,
        transparent: true,
        opacity: 0.92,
        metalness: 0.3,
        roughness: 0.2,
      }),
    );
    crystal.position.y = 1.45;
    crystal.name = 'shrineCrystal';
    g.add(crystal);
    this.pulseMeshes.push(crystal);
    const shrineLight = new THREE.PointLight(0xffe0a0, 3.5, 14, 1.8);
    shrineLight.position.set(0, 2.2, 0);
    this.scene.add(shrineLight);
    this.torchLights.push(shrineLight);
  }

  private addBossPit(g: THREE.Group, wallH: number): void {
    // multi-ring pit spectacle
    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(7.2, 0.22, 8, 40),
      new THREE.MeshStandardMaterial({
        color: 0x280018,
        emissive: COL.bossGlow,
        emissiveIntensity: 0.75,
        metalness: 0.4,
        roughness: 0.45,
      }),
    );
    outer.rotation.x = Math.PI / 2;
    outer.position.y = 0.12;
    g.add(outer);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.8, 0.28, 8, 36),
      new THREE.MeshStandardMaterial({
        color: 0x220018,
        emissive: COL.emissiveHot,
        emissiveIntensity: 0.9,
        metalness: 0.35,
        roughness: 0.4,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.16;
    ring.name = 'bossRing';
    g.add(ring);
    this.pulseMeshes.push(ring);

    const pit = new THREE.Mesh(
      new THREE.CircleGeometry(5.4, 40),
      new THREE.MeshStandardMaterial({
        color: 0x08040c,
        emissive: 0x4a0028,
        emissiveIntensity: 0.7,
        roughness: 0.6,
      }),
    );
    pit.rotation.x = -Math.PI / 2;
    pit.position.y = 0.04;
    g.add(pit);

    // void core glow
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff2266,
        transparent: true,
        opacity: 0.35,
      }),
    );
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.06;
    core.name = 'bossCore';
    g.add(core);
    this.pulseMeshes.push(core);

    // standing stones around pit
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + 0.2;
      const r = 8.2;
      const stone = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 1.8 + (i % 3) * 0.35, 0.4),
        new THREE.MeshStandardMaterial({
          color: 0x2a1838,
          emissive: COL.emissive,
          emissiveIntensity: 0.35,
          roughness: 0.75,
        }),
      );
      stone.position.set(Math.cos(ang) * r, 0.95, Math.sin(ang) * r);
      stone.rotation.y = -ang;
      stone.castShadow = true;
      g.add(stone);
    }

    // overhead void lanterns
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const lx = Math.cos(ang) * 5;
      const lz = Math.sin(ang) * 5;
      const lantern = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshStandardMaterial({
          color: 0xff6688,
          emissive: COL.bossGlow,
          emissiveIntensity: 1.6,
        }),
      );
      lantern.position.set(lx, wallH - 1.8, lz);
      lantern.name = 'bossLantern';
      g.add(lantern);
      this.pulseMeshes.push(lantern);
      const pl = new THREE.PointLight(COL.emissiveHot, 3.2, 16, 1.6);
      pl.position.set(lx, wallH - 1.6, lz);
      this.scene.add(pl);
      this.torchLights.push(pl);
    }

    // floor crack veins radiating from pit
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const crack = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.03, 3.5),
        new THREE.MeshStandardMaterial({
          color: 0x1a0810,
          emissive: COL.bossGlow,
          emissiveIntensity: 0.55,
        }),
      );
      crack.position.set(Math.cos(ang) * 7.5, 0.05, Math.sin(ang) * 7.5);
      crack.rotation.y = -ang;
      g.add(crack);
    }
  }

  private addEntranceGate(g: THREE.Group, halfD: number, wallH: number): void {
    const gateMat = new THREE.MeshStandardMaterial({
      color: 0x322858,
      emissive: COL.emissive,
      emissiveIntensity: 0.55,
      metalness: 0.32,
      roughness: 0.48,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x2a2038,
      metalness: 0.65,
      roughness: 0.35,
      emissive: 0x1a1040,
      emissiveIntensity: 0.2,
    });

    // twin columns with ornate bases/caps
    for (const sx of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.85, 5.6, 0.85), gateMat);
      col.position.set(sx * 2.9, 2.85, halfD - 1.15);
      col.castShadow = true;
      g.add(col);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.4, 1.15), ironMat);
      base.position.set(sx * 2.9, 0.2, halfD - 1.15);
      g.add(base);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), gateMat);
      cap.position.set(sx * 2.9, 5.7, halfD - 1.15);
      g.add(cap);
      // finial
      const finial = new THREE.Mesh(
        new THREE.ConeGeometry(0.25, 0.55, 4),
        new THREE.MeshStandardMaterial({
          color: COL.bannerTrim,
          emissive: 0x886622,
          emissiveIntensity: 0.4,
          metalness: 0.5,
        }),
      );
      finial.position.set(sx * 2.9, 6.15, halfD - 1.15);
      g.add(finial);
    }

    // multi-layer lintel
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, 0.95), gateMat);
    lintel.position.set(0, 5.55, halfD - 1.15);
    g.add(lintel);
    const lintelTrim = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.18, 1.05), ironMat);
    lintelTrim.position.set(0, 5.2, halfD - 1.15);
    g.add(lintelTrim);

    // arch keystone
    const key = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.5),
      new THREE.MeshStandardMaterial({
        color: COL.wallEdge,
        emissive: COL.emissive,
        emissiveIntensity: 0.7,
        metalness: 0.4,
        roughness: 0.4,
      }),
    );
    key.position.set(0, 5.9, halfD - 1.15);
    g.add(key);

    // glowing rune ring
    const rune = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.09, 8, 28),
      new THREE.MeshStandardMaterial({
        color: 0x99f0ff,
        emissive: 0x55e8ff,
        emissiveIntensity: 1.5,
        metalness: 0.3,
        roughness: 0.25,
      }),
    );
    rune.position.set(0, 3.35, halfD - 1.15);
    rune.name = 'gateRune';
    g.add(rune);
    this.pulseMeshes.push(rune);

    // inner sigil
    const sigil = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        emissive: 0x44ccff,
        emissiveIntensity: 1.3,
        transparent: true,
        opacity: 0.85,
      }),
    );
    sigil.position.set(0, 3.35, halfD - 1.15);
    sigil.name = 'gateSigil';
    g.add(sigil);
    this.pulseMeshes.push(sigil);

    // iron gate bars (partially open)
    for (let i = -3; i <= 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.2, 0.1), ironMat);
      bar.position.set(i * 0.55, 1.7, halfD - 0.85);
      g.add(bar);
    }
    // horizontal bar
    const hbar = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 0.12), ironMat);
    hbar.position.set(0, 2.4, halfD - 0.85);
    g.add(hbar);

    // threshold plate
    const thresh = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.12, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x3a3060,
        emissive: COL.emissive,
        emissiveIntensity: 0.35,
        metalness: 0.25,
        roughness: 0.55,
      }),
    );
    thresh.position.set(0, 0.06, halfD - 1.5);
    g.add(thresh);

    // gate light
    const gateLight = new THREE.PointLight(0x88eeff, 2.8, 12, 1.7);
    gateLight.position.set(0, 3.5, halfD - 1.0);
    this.scene.add(gateLight);
    this.torchLights.push(gateLight);
  }

  private addWallWithDoor(
    g: THREE.Group,
    width: number,
    height: number,
    x: number,
    y: number,
    z: number,
    _rotY: number,
    hasDoor: boolean,
    doorW: number,
    wallMat: THREE.Material,
    edgeMat: THREE.Material,
  ): void {
    if (!hasDoor) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.55), wallMat);
      w.position.set(x, y, z);
      w.castShadow = true;
      w.receiveShadow = true;
      g.add(w);
      return;
    }
    const side = (width - doorW) / 2;
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(side, height, 0.55), wallMat);
      const offset = sx * (doorW / 2 + side / 2);
      w.position.set(x + offset, y, z);
      w.castShadow = true;
      w.receiveShadow = true;
      g.add(w);
    }
    // lintel
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.4, 0.5, 0.6), edgeMat);
    lintel.position.set(x, height - 0.4, z);
    g.add(lintel);
    // door frame posts
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, height * 0.85, 0.35), edgeMat);
      post.position.set(x + sx * (doorW / 2), height * 0.42, z);
      g.add(post);
    }
  }

  pulse(time: number): void {
    this.group.traverse((o) => {
      if (o.name === 'shrineCrystal' && o instanceof THREE.Mesh) {
        o.rotation.y = time * 0.8;
        o.position.y = 1.45 + Math.sin(time * 2) * 0.1;
      }
      if (o.name === 'gateSigil' && o instanceof THREE.Mesh) {
        o.rotation.y = time * 1.1;
        o.rotation.x = Math.sin(time * 0.7) * 0.2;
      }
      if (o.name === 'gateRune' && o instanceof THREE.Mesh) {
        o.rotation.z = time * 0.4;
      }
      if (o.name === 'bossRing' && o instanceof THREE.Mesh) {
        o.rotation.z = time * 0.15;
        const m = o.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = 0.75 + Math.sin(time * 2.2) * 0.25;
      }
      if (o.name === 'bossCore' && o instanceof THREE.Mesh) {
        const m = o.material as THREE.MeshBasicMaterial;
        m.opacity = 0.28 + Math.sin(time * 3) * 0.12;
        o.scale.setScalar(1 + Math.sin(time * 1.5) * 0.08);
      }
      if (o.name === 'bossLantern' && o instanceof THREE.Mesh) {
        o.position.y += Math.sin(time * 2 + o.position.x) * 0.002;
        o.rotation.y = time * 0.6;
      }
      if (o.name === 'torchFlame' && o instanceof THREE.Mesh) {
        o.scale.setScalar(0.9 + Math.sin(time * 11 + o.position.x * 3) * 0.15);
      }
    });
    for (const l of this.torchLights) {
      const hot = l.color.getHex() === COL.emissiveHot;
      l.intensity = hot
        ? 5.5 + Math.sin(time * 7 + l.position.x) * 0.8
        : 2.4 + Math.sin(time * 9 + l.position.z) * 0.4;
    }
  }
}
