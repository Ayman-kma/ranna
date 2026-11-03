let audioCtx: AudioContext | null = null;

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor =
    window.AudioContext || (window as WindowWithWebkit).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx = new Ctor();
  return audioCtx;
}

/** Must be called from a user gesture to unlock audio playback. */
export function primeAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

function note(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peak = 0.18
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

/** Plays a bright three-note "ready" chime twice. */
export function playAlert(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const run = () => {
    const t = ctx.currentTime + 0.02;
    // Ascending major arpeggio: A5, C#6, E6
    for (let repeat = 0; repeat < 2; repeat += 1) {
      const base = t + repeat * 0.55;
      note(ctx, 880.0, base, 0.18, 0.2);
      note(ctx, 1108.73, base + 0.16, 0.18, 0.2);
      note(ctx, 1318.51, base + 0.32, 0.28, 0.24);
    }
  };

  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(run)
      .catch(() => {
        /* ignore */
      });
  } else {
    run();
  }
}

export function vibrate(pattern: number | number[] = [180, 90, 180, 90, 320]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}
