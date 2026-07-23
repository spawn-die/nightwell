# Nightwell — agent notes

## Run

```bash
npm i && npm start   # :4790
npm test
npm run build
```

## Structure

- `src/game/*` — pure TS sim (no Three); unit tested  
- `src/game/enemies.ts` — windups, AI, boss phases  
- `src/render/*` — world, actors, fx, bloom  
- `src/ui/hud.ts` — DOM HUD  

## Combat loop (keep working)

1. **Aim on mousedown** (and mousemove) — hold LMB to strike  
2. Enemies **telegraph** (windup) then lunge/bolt/slam — **dash** i-frames or **strike to interrupt**  
3. Clear room → *GATE OPEN* → walk **+Z cyan gate** (auto-portal)  
4. Wellborn **phase 2** under 50% HP (enrage)  

## Gotchas

- Dungeon advances along **+Z**; exit is `doors.s` (maxZ).  
- Title one-shot preview under overlay; DESCEND calls `startRun` again.  
- `preserveDrawingBuffer: true` for headless paint metrics.  
- Debug: `window.__NIGHTWELL__` → `{ state, input, view, startRun }`.  

## Shipped “good game” depth (2026-07-22)

- Windup telegraphs + interrupt reward  
- Shade lunge / bone kite+bolt / wretch slam  
- Boss two-phase patterns  
- 14 unit tests on shipped sim  

## Next

- Audio, denser mid-run loot choices, tuning pass  
- Pages deploy `nightwell.spawndie.com`
