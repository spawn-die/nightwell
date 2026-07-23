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
| **Mouse** | Aim |
| **LMB** | Melee strike |
| **RMB / F** | Soulbolt (costs Focus) |
| **Space** | Dash (i-frames) |
| **E** | Advance through north door (when chamber is clear) |
| **I / Tab** | Reliquary (inventory / equip) |
| **Enter / click** | Descend / retry |

### Loop

1. Enter the **Undercroft** (5 chambers).
2. Clear shades, bone thralls, wretches — pick up **echo-loot**.
3. Equip weapons, armor, relics (power / vitality / focus).
4. Level up mid-run.
5. Face the **Wellborn** in the pit.
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
