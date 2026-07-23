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

## Next polish (priority)

1. Combat VFX + hit feedback  
2. Denser props / readable materials  
3. Auto-spawn feedback when entering halls (E at north door when clear)  
4. Audio  
5. Pages deploy `nightwell.spawndie.com`
