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
let mouseStrikeHeld = false;
let mouseBoltHeld = false;

function aimFromEvent(clientX: number, clientY: number): void {
  const g = view.screenToGround(clientX, clientY);
  if (Number.isFinite(g.x) && Number.isFinite(g.z)) {
    input.aimX = g.x;
    input.aimZ = g.z;
  }
}

function requestStart(): void {
  input.start = true;
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Enter') {
    if (state.phase === 'title' || state.phase === 'won' || state.phase === 'lost') {
      requestStart();
      e.preventDefault();
    }
  }
  // Space: start on menus, dash in combat (not both on same press after start)
  if (e.code === 'Space') {
    if (state.phase === 'title' || state.phase === 'won' || state.phase === 'lost') {
      requestStart();
    } else if (state.phase === 'playing') {
      input.dash = true;
    }
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
  aimFromEvent(e.clientX, e.clientY);
  if (state.phase === 'title' || state.phase === 'won' || state.phase === 'lost') {
    requestStart();
    return;
  }
  if (state.phase !== 'playing') return;
  if (e.button === 0) {
    mouseStrikeHeld = true;
    input.strike = true;
  }
  if (e.button === 2) {
    mouseBoltHeld = true;
    input.bolt = true;
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseStrikeHeld = false;
  if (e.button === 2) mouseBoltHeld = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('mousemove', (e) => {
  aimFromEvent(e.clientX, e.clientY);
});

hud.bindStart(() => requestStart());

function syncHeld(): void {
  input.up = keys.has('KeyW') || keys.has('ArrowUp');
  input.down = keys.has('KeyS') || keys.has('ArrowDown');
  input.left = keys.has('KeyA') || keys.has('ArrowLeft');
  input.right = keys.has('KeyD') || keys.has('ArrowRight');
  // Hold-to-attack: re-pulse while buttons held (cooldowns gate rate)
  if (state.phase === 'playing') {
    if (mouseStrikeHeld) input.strike = true;
    if (mouseBoltHeld) input.bolt = true;
  }
}

let last = performance.now();
let previewBooted = false;

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  syncHeld();
  step(state, input, dt);
  hud.update(state);

  // One-shot title backdrop: build world under the overlay without consuming real starts.
  if (state.phase === 'title' && !previewBooted) {
    previewBooted = true;
    startRun(state, 0x51a7e);
    state.phase = 'title';
  }
  // After a real run ends and returns to title via refresh path, allow preview again
  if (state.phase !== 'title') {
    // keep previewBooted true until full page reload — real startRun from step handles play
  }

  view.render(state, { x: input.aimX, z: input.aimZ });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// @ts-expect-error debug hook for Playwright / agents
window.__NIGHTWELL__ = { state, input, startRun, view };

export { state, view };
