import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { GameState } from '../game/types.js';
import { ActorRenderer } from './actors.js';
import { FxRenderer } from './fx.js';
import { WorldRenderer } from './world.js';

export class GameView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  world: WorldRenderer;
  actors: ActorRenderer;
  fx: FxRenderer;
  private builtForRun: string | null = null;
  private aimMarker: THREE.Mesh;
  private clock = new THREE.Clock();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      // Keep buffer for screenshots / headless paint metrics (default false → black readback)
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // High exposure so gothic purple floors/actors stay readable
    this.renderer.toneMappingExposure = 1.85;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 20, 16);

    this.world = new WorldRenderer(this.scene);
    this.actors = new ActorRenderer(this.scene);
    this.fx = new FxRenderer(this.scene);

    // aim ring
    this.aimMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.48, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff6ad5,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      }),
    );
    this.aimMarker.rotation.x = -Math.PI / 2;
    this.scene.add(this.aimMarker);

    // post
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Mild bloom — heavy bloom crushed midtones into mush
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.28,
      0.4,
      0.82,
    );
    this.composer.addPass(bloom);

    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  ensureWorld(state: GameState): void {
    if (this.builtForRun !== state.runId) {
      this.world.rebuild(state);
      this.builtForRun = state.runId;
    }
  }

  render(state: GameState, aim: { x: number; z: number }): void {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.ensureWorld(state);
    this.world.pulse(state.time);
    this.world.updatePortal(state, state.time);
    this.actors.sync(state);
    // Always drain sim fxQueue → visual particles (no silent drops)
    this.fx.sync(state, dt);

    this.aimMarker.position.set(aim.x, 0.08, aim.z);
    // brighter aim when ready to strike
    const aimMat = this.aimMarker.material as THREE.MeshBasicMaterial;
    aimMat.color.setHex(state.strikeCd > 0 ? 0x8866aa : 0xff6ad5);
    aimMat.opacity = state.strikeCd > 0 ? 0.4 : 0.9;

    // isometric-ish follow cam
    const p = state.player;
    const target = new THREE.Vector3(p.x, 0, p.z);
    const camOffset = new THREE.Vector3(-10, 18, 14);
    // slight zoom punch during hitstop
    if (state.hitstop > 0) {
      camOffset.multiplyScalar(0.94);
    }
    const desired = target.clone().add(camOffset);
    // screen shake
    if (state.shake > 0) {
      desired.x += (Math.random() - 0.5) * state.shake * 1.4;
      desired.y += (Math.random() - 0.5) * state.shake * 0.7;
      desired.z += (Math.random() - 0.5) * state.shake * 1.4;
    }
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    const look = target.clone();
    look.y = 1;
    this.camera.lookAt(look);

    this.composer.render();
  }

  /** Project world XZ to CSS pixel position for floaters */
  worldToScreen(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(x, y, z);
    v.project(this.camera);
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    return {
      x: (v.x * 0.5 + 0.5) * w,
      y: (-v.y * 0.5 + 0.5) * h,
      visible: v.z < 1,
    };
  }

  /** Raycast aim point on ground plane y=0 */
  screenToGround(clientX: number, clientY: number): { x: number; z: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, hit);
    if (!hit) return { x: 0, z: 0 };
    return { x: hit.x, z: hit.z };
  }
}
