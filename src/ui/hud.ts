import type { GameState } from '../game/types.js';
import { equipItem } from '../game/loot.js';
import type { GameView } from '../render/gameview.js';

export class Hud {
  private hpFill = el<HTMLDivElement>('hp-fill');
  private focusFill = el<HTMLDivElement>('focus-fill');
  private xpFill = el<HTMLDivElement>('xp-fill');
  private levelText = el<HTMLElement>('level-text');
  private roomText = el<HTMLElement>('room-text');
  private goldText = el<HTMLElement>('gold-text');
  private killText = el<HTMLElement>('kill-text');
  private toast = el<HTMLElement>('toast');
  private bossBar = el<HTMLElement>('boss-bar');
  private bossFill = el<HTMLDivElement>('boss-fill');
  private bossName = el<HTMLElement>('boss-name');
  private gateCue = el<HTMLElement>('gate-cue');
  private hud = el<HTMLElement>('hud');
  private inv = el<HTMLElement>('inventory');
  private invList = el<HTMLElement>('inv-list');
  private title = el<HTMLElement>('title');
  private death = el<HTMLElement>('death');
  private win = el<HTMLElement>('win');
  private deathStats = el<HTMLElement>('death-stats');
  private winStats = el<HTMLElement>('win-stats');
  private comboEl: HTMLDivElement;
  private floatLayer: HTMLDivElement;
  private floatDom = new Map<string, HTMLDivElement>();
  private lowHpPulse = 0;

  constructor() {
    this.comboEl = document.createElement('div');
    this.comboEl.id = 'combo-pop';
    this.comboEl.className = 'combo-pop hidden';
    this.hud.appendChild(this.comboEl);

    this.floatLayer = document.createElement('div');
    this.floatLayer.id = 'float-layer';
    this.floatLayer.className = 'float-layer';
    document.getElementById('app')?.appendChild(this.floatLayer);

    // low HP vignette
    const vig = document.createElement('div');
    vig.id = 'hp-vignette';
    vig.className = 'hp-vignette';
    document.getElementById('app')?.appendChild(vig);
  }

  bindStart(fn: () => void): void {
    el<HTMLButtonElement>('btn-start').onclick = fn;
    el<HTMLButtonElement>('btn-retry').onclick = fn;
    el<HTMLButtonElement>('btn-again').onclick = fn;
  }

  update(state: GameState, view?: GameView): void {
    this.title.classList.toggle('hidden', state.phase !== 'title');
    this.death.classList.toggle('hidden', state.phase !== 'lost');
    this.win.classList.toggle('hidden', state.phase !== 'won');
    this.hud.classList.toggle('hidden', state.phase === 'title');
    this.inv.classList.toggle('hidden', state.phase !== 'inventory');

    if (state.phase === 'title') {
      this.comboEl.classList.add('hidden');
      this.clearFloats();
      return;
    }

    const p = state.player;
    const hpPct = Math.max(0, p.hp / p.maxHp);
    this.hpFill.style.transform = `scaleX(${hpPct})`;
    this.focusFill.style.transform = `scaleX(${Math.max(0, state.focus / state.maxFocus)})`;
    const xpPct = state.xpToLevel > 0 ? Math.max(0, Math.min(1, state.xp / state.xpToLevel)) : 0;
    this.xpFill.style.transform = `scaleX(${xpPct})`;
    this.levelText.textContent = `Lv ${state.level}`;
    const room = state.rooms[state.roomIndex];
    const roomLabel = room
      ? `${room.kind.toUpperCase()} ${state.roomIndex + 1}/${state.rooms.length}`
      : '';
    const gateOpen = !!(room?.cleared && room.doors.s);
    this.roomText.textContent = gateOpen ? `${roomLabel} · GATE OPEN` : roomLabel;
    this.gateCue.classList.toggle('hidden', !gateOpen || state.phase !== 'playing');
    this.goldText.textContent = `${state.gold} Echo`;
    this.killText.textContent = `${state.kills} Slain`;

    if (state.messageT > 0 && state.message) {
      this.toast.textContent = state.message;
      this.toast.classList.add('show');
    } else {
      this.toast.classList.remove('show');
    }

    // Combo pop
    if (state.combo >= 2 && state.comboTimer > 0) {
      this.comboEl.textContent = `${state.combo}x COMBO`;
      this.comboEl.classList.remove('hidden');
      this.comboEl.style.opacity = String(Math.min(1, state.comboTimer));
    } else {
      this.comboEl.classList.add('hidden');
    }

    // Low HP vignette
    const vig = document.getElementById('hp-vignette');
    if (vig) {
      const danger = hpPct < 0.35 ? (0.35 - hpPct) / 0.35 : 0;
      this.lowHpPulse += 0.08;
      vig.style.opacity = String(danger * (0.55 + Math.sin(this.lowHpPulse) * 0.15));
    }

    const boss = state.enemies.find((e) => e.isBoss && e.alive);
    if (boss) {
      this.bossBar.classList.remove('hidden');
      this.bossFill.style.transform = `scaleX(${boss.hp / boss.maxHp})`;
      this.bossName.textContent = boss.bossPhase === 2 ? 'WELLBORN — ENRAGED' : 'WELLBORN';
    } else {
      this.bossBar.classList.add('hidden');
    }

    if (state.phase === 'lost') {
      this.deathStats.textContent = `Level ${state.level} · ${state.kills} slain · ${state.gold} echo · runs ${state.meta.runs}`;
    }
    if (state.phase === 'won') {
      this.winStats.textContent = `Level ${state.level} · ${state.kills} slain · ${state.gold} echo · Wellborn fallen ${state.meta.wellbornSlain}`;
    }

    if (state.phase === 'inventory') {
      this.renderInv(state);
    }

    if (view) this.syncFloaters(state, view);
  }

  private syncFloaters(state: GameState, view: GameView): void {
    const seen = new Set<string>();
    for (const f of state.floaters) {
      seen.add(f.id);
      let dom = this.floatDom.get(f.id);
      if (!dom) {
        dom = document.createElement('div');
        dom.className = 'floater';
        this.floatLayer.appendChild(dom);
        this.floatDom.set(f.id, dom);
      }
      const rise = (1 - f.life / f.maxLife) * 48;
      const scr = view.worldToScreen(f.x, 1.4 + rise * 0.02, f.z);
      const k = f.life / f.maxLife;
      dom.textContent = f.text;
      dom.style.color = f.color;
      dom.style.opacity = String(Math.max(0, k));
      dom.style.transform = `translate(-50%, -50%) scale(${0.85 + (1 - k) * 0.35})`;
      if (scr.visible) {
        dom.style.left = `${scr.x}px`;
        dom.style.top = `${scr.y - rise}px`;
        dom.style.display = 'block';
      } else {
        dom.style.display = 'none';
      }
    }
    for (const [id, dom] of this.floatDom) {
      if (!seen.has(id)) {
        dom.remove();
        this.floatDom.delete(id);
      }
    }
  }

  private clearFloats(): void {
    for (const [, dom] of this.floatDom) dom.remove();
    this.floatDom.clear();
  }

  private renderInv(state: GameState): void {
    this.invList.innerHTML = '';
    if (state.inventory.length === 0) {
      this.invList.innerHTML = `<p style="color:#b8b0d0;font-size:13px">No relics yet. Slay to harvest.</p>`;
      return;
    }
    for (const item of state.inventory) {
      const equipped = state.equipped[item.slot]?.id === item.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `inv-item${equipped ? ' equipped' : ''}`;
      btn.innerHTML = `<div class="name">${item.name}${equipped ? ' · EQUIPPED' : ''}</div>
        <div class="stats">${item.slot} · PWR ${item.power} · VIT ${item.vitality} · FOC ${item.focus} · ${item.rarity}</div>`;
      btn.onclick = () => {
        equipItem(state, item.id);
        this.renderInv(state);
      };
      this.invList.appendChild(btn);
    }
  }
}

function el<T extends HTMLElement>(id: string): T {
  const n = document.getElementById(id);
  if (!n) throw new Error(`#${id} missing`);
  return n as T;
}
