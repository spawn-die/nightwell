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

- Title screen boots a **preview run** under the overlay so the 3D scene is visible; DESCEND calls `startRun` again.  
- First lighting pass was too dark — keep floor/ambient readable.  
- Door lintels / wall segments are approximate box art; improve set dressing before claiming trailer quality.  
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
