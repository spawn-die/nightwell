/** Tiny WebAudio blips — soft-fail if AudioContext blocked. */
export function createAudio() {
  /** @type {AudioContext | null} */
  let ctx: AudioContext | null = null;

  function ensure(): AudioContext | null {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      return ctx;
    } catch {
      return null;
    }
  }

  function beep(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.035): void {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  return {
    hit: () => beep(220 + Math.random() * 40, 0.05, 'square', 0.03),
    kill: () => beep(380, 0.07, 'triangle', 0.04),
    interrupt: () => beep(660, 0.06, 'sine', 0.04),
    dash: () => beep(180, 0.05, 'sawtooth', 0.025),
    level: () => beep(520, 0.12, 'triangle', 0.05),
    portal: () => beep(440, 0.15, 'sine', 0.045),
    hurt: () => beep(110, 0.1, 'sawtooth', 0.04),
    start: () => beep(300, 0.08, 'triangle', 0.04),
  };
}

export type NightwellAudio = ReturnType<typeof createAudio>;
