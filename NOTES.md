# Nightwell — agent notes

## Run

```bash
npm i && npm start   # :4790
npm test
npm run build
```

## Readable & fair (do not regress)

- **See yourself**: oversized mint player, thick ground ring, personal point light  
- **See the room**: bright floor/tiles, heavy ambient, light fog, mild bloom, closer cam `(-8,14,11)`  
- **See danger**: yellow→red filled **hit-radius disk** during windup (not a tiny ring)  
- **Survive hits**: any player damage grants **~0.55s invuln**; long windups; lower shade dmg; entrance spawns far ahead  
- Interrupt windups with strike; Space dash also i-frames  

## Cooler (spectacle)

- Bright mint **player** + personal light; saturated enemies  
- Strong ambient/key lighting; light fog; mild bloom  
- **Cyan portal pillar** when chamber cleared (+Z gate)  
- Floating **damage numbers** + **combo** pop  
- Hitstop / camera punch on kills & interrupts  
- Low-HP red vignette  

## Better (feel)

- Windup telegraphs + interrupt (strike while danger disk)  
- Shade lunge / bone bolt / wretch slam / Wellborn phase 2  
- Auto-equip **if better** (`itemScore`); message `EQUIP name`  
- Combo timer (2.4s) → `Nx COMBO`  
- Magnet pickups  
- Camera-relative WASD (`cameraBasis` matches GameView offset)

## Loop (do not regress)

1. Aim on mousedown + hold LMB  
2. Entrance shades → clear → **cyan +Z portal** auto-advance  
3. Debug: `window.__NIGHTWELL__`

## Tests

Unit tests on shipped `src/game/*` (combo, auto-equip, windup, portal, invuln, etc.)
