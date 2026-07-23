# Nightwell — agent notes

## Run

```bash
npm i && npm start   # :4790
npm test
npm run build
```

## Cooler (spectacle)

- Bright mint **player** + personal light; saturated enemies  
- Strong ambient/key lighting; light fog; mild bloom  
- **Cyan portal pillar** when chamber cleared (+Z gate)  
- Floating **damage numbers** + **combo** pop  
- Hitstop / camera punch on kills & interrupts  
- Low-HP red vignette  

## Better (feel)

- Windup telegraphs + interrupt (strike while red ring)  
- Shade lunge / bone bolt / wretch slam / Wellborn phase 2  
- Auto-equip **if better** (`itemScore`); message `EQUIP name`  
- Combo timer (2.4s) → `Nx COMBO`  
- Magnet pickups  

## Loop (do not regress)

1. Aim on mousedown + hold LMB  
2. Entrance shades → clear → **cyan +Z portal** auto-advance  
3. Debug: `window.__NIGHTWELL__`

## Tests

16 unit tests on shipped `src/game/*` (combo, auto-equip, windup, portal, etc.)
