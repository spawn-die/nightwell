# Nightwell — agent notes

## Run

```bash
npm i && npm start   # :4790
npm test
npm run build
```

## Structure

- `src/game/*` — pure TS sim (no Three); unit tested  
- `src/render/*` — world, actors, fx, bloom composer  
- `src/ui/hud.ts` — DOM HUD  

## Gotchas

- **Aim must update on mousedown** (not only mousemove) or melee misses.  
- Dungeon advances along **+Z**; exit door is `doors.s` (maxZ). Auto-portal when cleared + near gate.  
- Title boots a one-shot preview world under the overlay; real DESCEND calls `startRun` again.  
- Debug: `window.__NIGHTWELL__` → `{ state, input, view, startRun }`.

## Shipped polish (2026-07-22)

- Dense gothic set dressing (banners, alcoves, rubble, beams, boss pit rings)
- Combat `fxQueue` → renderer VFX (slash / hit / death / bolt / dash)
- `preserveDrawingBuffer: true` for headless paint metrics / screenshots
- Unit test: combat emits fxQueue events

## Next polish (priority)

1. Enemy density / encounter pacing  
2. Audio  
3. Further boss spectacle  
4. Pages deploy `nightwell.spawndie.com`
