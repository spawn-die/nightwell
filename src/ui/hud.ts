import type { GameState } from '../game/types.js';
import { equipItem } from '../game/loot.js';

export class Hud {
  private hpFill = el<HTMLDivElement>('hp-fill');
  private focusFill = el<HTMLDivElement>('focus-fill');
  private levelText = el<HTMLElement>('level-text');
  private roomText = el<HTMLElement>('room-text');
  private goldText = el<HTMLElement>('gold-text');
  private killText = el<HTMLElement>('kill-text');
  private toast = el<HTMLElement>('toast');
  private bossBar = el<HTMLElement>('boss-bar');
  private bossFill = el<HTMLDivElement>('boss-fill');
  private bossName = el<HTMLElement>('boss-name');
  private hud = el<HTMLElement>('hud');
  private inv = el<HTMLElement>('inventory');
  private invList = el<HTMLElement>('inv-list');
  private title = el<HTMLElement>('title');
  private death = el<HTMLElement>('death');
  private win = el<HTMLElement>('win');
  private deathStats = el<HTMLElement>('death-stats');
  private winStats = el<HTMLElement>('win-stats');

  bindStart(fn: () => void): void {
    el<HTMLButtonElement>('btn-start').onclick = fn;
    el<HTMLButtonElement>('btn-retry').onclick = fn;
    el<HTMLButtonElement>('btn-again').onclick = fn;
  }

  update(state: GameState): void {
    this.title.classList.toggle('hidden', state.phase !== 'title');
    this.death.classList.toggle('hidden', state.phase !== 'lost');
    this.win.classList.toggle('hidden', state.phase !== 'won');
    this.hud.classList.toggle('hidden', state.phase === 'title');
    this.inv.classList.toggle('hidden', state.phase !== 'inventory');

    if (state.phase === 'title') return;

    const p = state.player;
    this.hpFill.style.transform = `scaleX(${Math.max(0, p.hp / p.maxHp)})`;
    this.focusFill.style.transform = `scaleX(${Math.max(0, state.focus / state.maxFocus)})`;
    this.levelText.textContent = `Lv ${state.level}`;
    const room = state.rooms[state.roomIndex];
    this.roomText.textContent = room
      ? `${room.kind.toUpperCase()} ${state.roomIndex + 1}/${state.rooms.length}`
      : '';
    this.goldText.textContent = `${state.gold} Echo`;
    this.killText.textContent = `${state.kills} Slain`;

    if (state.messageT > 0 && state.message) {
      this.toast.textContent = state.message;
      this.toast.classList.add('show');
    } else {
      this.toast.classList.remove('show');
    }

    const boss = state.enemies.find((e) => e.isBoss && e.alive);
    if (boss) {
      this.bossBar.classList.remove('hidden');
      this.bossFill.style.transform = `scaleX(${boss.hp / boss.maxHp})`;
      this.bossName.textContent = 'WELLBORN';
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
