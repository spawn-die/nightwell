# NIGHTWELL

**SpawnDie flagship.** Descend a gothic 3D undercroft, harvest echo-loot, and shatter the **Wellborn**.

> One sentence fantasy: *You are a Rift Warden walking into the Nightwell — a vertical pit of chambers — to reclaim power from the dead before the well claims you.*

Browser-native **Three.js action-RPG** vertical slice: real rooms, combat, loot, levels, boss, meta save.

## Play

```bash
npm install
npm start
```

Open **http://localhost:4790**

### Controls

| Input | Action |
|-------|--------|
| **WASD** | Move |
| **Mouse** | Aim (also updates on click) |
| **Hold LMB** | Melee strike (interrupts enemy windups) |
| **RMB / F** | Soulbolt (costs Focus) |
| **Space** | Dash (i-frames — dodge telegraphs) |
| **Walk into cyan gate** | Advance when chamber is clear (+Z exit) |
| **E** | Also tries to enter the gate |
| **I / Tab** | Reliquary (inventory / equip) |
| **Enter / click** | Descend / retry |

### Combat

- Enemies **telegraph** attacks (red/purple rings). **Dash** out or **strike** to interrupt.
- **Shades** lunge · **Bones** kite and shoot · **Wretches** heavy slam · **Wellborn** enrages under 50% HP.
- Clear the room → *GATE OPEN* → walk through the **cyan +Z gate**.

### Loop

1. Descend into the **Undercroft** (5 chambers).
2. Clear shades, bone thralls, wretches — pick up **echo-loot**.
3. Equip weapons, armor, relics (power / vitality / focus).
4. Level up mid-run.
5. Face the **Wellborn** in the pit (two phases).
6. Die or win — meta tracks runs, best kills, Wellborn slain (`localStorage`).

## Architecture

- **`src/game/*`** — pure simulation (testable, no Three)
- **`src/render/*`** — Three.js world, actors, FX, bloom
- **`src/ui/*`** — HUD / overlays
- **Per-game save** — meta progression only in this title (SpawnDie hub friends stay separate)

## Test

```bash
npm test
```

## Stack

- TypeScript + Vite
- Three.js (shadows, ACES tonemap, Unreal bloom)
- Vitest for combat / loot / win-lose

## SpawnDie placement

| Title | Role |
|-------|------|
| **NIGHTWELL** | Flagship 3D ARPG / wow |
| Tanks | Live multiplayer product |
| COILBREAK | Arcade side dish |
| Hub | Portfolio + future friends |

## License

MIT
