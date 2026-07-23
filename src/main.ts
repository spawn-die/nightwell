import {
  createGameState,
  createInput,
  startRun,
  step,
} from './game/sim.js';
import { GameView } from './render/gameview.js';
import { Hud } from './ui/hud.js';
import type { InputState } from './game/types.js';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const state = createGameState();
const input: InputState = createInput();
const view = new GameView(canvas);
const hud = new Hud();

const keys = new Set<string>();

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Enter' || e.code === 'Space') {
    if (state.phase === 'title' || state.phase === 'won' || state.phase === 'lost') {
      input.start = true;
      e.preventDefault();
    }
  }
  if (e.code === 'Space' && state.phase === 'playing') {
    input.dash = true;
    e.preventDefault();
  }
  if (e.code === 'KeyE' && state.phase === 'playing') input.interact = true;
  if (e.code === 'KeyI' || e.code === 'Tab') {
    input.toggleInv = true;
    e.preventDefault();
  }
  if (e.code === 'KeyF' && state.phase === 'playing') input.bolt = true;
  if (e.code === 'Escape' && state.phase === 'inventory') input.toggleInv = true;
});

window.addEventListener('keyup', (e) => keys.delete(e.code));

canvas.addEventListener('mousedown', (e) => {
  if (state.phase === 'title' || state.phase === 'won' || state.phase === 'lost') {
    input.start = true;
    return;
  }
  if (state.phase !== 'playing') return;
  if (e.button === 0) input.strike = true;
  if (e.button === 2) input.bolt = true;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('mousemove', (e) => {
  const g = view.screenToGround(e.clientX, e.clientY);
  input.aimX = g.x;
  input.aimZ = g.z;
});

hud.bindStart(() => {
  input.start = true;
});

function syncHeld(): void {
  input.up = keys.has('KeyW') || keys.has('ArrowUp');
  input.down = keys.has('KeyS') || keys.has('ArrowDown');
  input.left = keys.has('KeyA') || keys.has('ArrowLeft');
  input.right = keys.has('KeyD') || keys.has('ArrowRight');
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  syncHeld();
  step(state, input, dt);
  // clear one-shots already consumed in step for strike/bolt/dash via sim
  hud.update(state);
  // Always render 3D (title uses a preview run under the overlay)
  if (state.phase === 'title' && !state.rooms.length) {
    startRun(state, 0x51a7e);
    state.phase = 'title';
  }
  view.render(state, { x: input.aimX, z: input.aimZ });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// expose for debugging / screenshots
// @ts-expect-error debug
window.__NIGHTWELL__ = { state, input, startRun, view };

export { state, view };
