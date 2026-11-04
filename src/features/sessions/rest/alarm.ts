// Browser side effects of the rest timer: sound, vibration and keeping the screen on.

let audio: AudioContext | null = null;

/** Creates / resumes the audio context; must run inside a user gesture (start, ✓). */
export function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

/** Three short beeps plus vibration (where supported). */
export function alarm(): void {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch {
    // Vibration not available (iPhone): sound only.
  }
  if (!audio) return;
  const t0 = audio.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.35 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.35 + 0.25);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + i * 0.35);
    osc.stop(t0 + i * 0.35 + 0.27);
  }
}

// Screen Wake Lock: while resting the screen stays on, so the alarm can sound.
interface WakeLockLike {
  released?: boolean;
  release: () => Promise<void>;
}
let lock: WakeLockLike | null = null;

export function keepAwake(): void {
  const wl = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> } }).wakeLock;
  if (!wl || (lock && !lock.released)) return;
  wl.request("screen")
    .then((l) => {
      lock = l;
    })
    .catch(() => {
      lock = null;
    });
}

export function releaseAwake(): void {
  const l = lock;
  lock = null;
  void l?.release().catch(() => undefined);
}
