import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { APP_CONFIG } from "@/config/app.config";
import { es } from "@/i18n/es";
import { toast } from "@/lib/utils/toast";
import { alarm, keepAwake, releaseAwake, unlockAudio } from "./alarm";

/** Persisted on the device: survives navigation, reloads and closing the app. */
interface Stored {
  durationSec: number;
  autoStart: boolean;
  endAt: number | null;
}

const KEY = "jimmy.restTimer";

function load(): Stored {
  const base: Stored = { durationSec: APP_CONFIG.rest.defaultSec, autoStart: true, endAt: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const v = JSON.parse(raw) as Partial<Stored>;
    return {
      durationSec: typeof v.durationSec === "number" && v.durationSec > 0 ? v.durationSec : base.durationSec,
      autoStart: typeof v.autoStart === "boolean" ? v.autoStart : base.autoStart,
      endAt: typeof v.endAt === "number" ? v.endAt : null,
    };
  } catch {
    return base;
  }
}

export interface RestTimer {
  durationSec: number;
  autoStart: boolean;
  /** Seconds left while running; null when idle. */
  remainingSec: number | null;
  /** True after it reached zero, until dismissed or restarted. */
  finished: boolean;
  start: () => void;
  stop: () => void;
  dismiss: () => void;
  /** Adds (or removes) seconds to the running countdown. */
  adjust: (deltaSec: number) => void;
  setDuration: (sec: number) => void;
  setAutoStart: (on: boolean) => void;
  /** Called when a set is checked: starts the rest if auto-start is on. */
  onSetDone: () => void;
}

const Ctx = createContext<RestTimer | null>(null);

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored>(load);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked: the timer still works for this visit.
    }
  }, [state]);

  // Tick only while running; fire the alarm once at zero.
  useEffect(() => {
    if (state.endAt === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (stateRef.current.endAt !== null && t >= stateRef.current.endAt) {
        const late = t - stateRef.current.endAt > 60_000;
        setState((s) => ({ ...s, endAt: null }));
        setFinished(true);
        releaseAwake();
        // Coming back long after it ended (app closed): no sound, just the badge.
        if (!late) alarm();
        toast(es.rest.done);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick();
        if (stateRef.current.endAt !== null) keepAwake();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state.endAt]);

  const start = useCallback(() => {
    unlockAudio();
    keepAwake();
    setFinished(false);
    setNow(Date.now());
    setState((s) => ({ ...s, endAt: Date.now() + s.durationSec * 1000 }));
  }, []);

  const stop = useCallback(() => {
    releaseAwake();
    setFinished(false);
    setState((s) => ({ ...s, endAt: null }));
  }, []);

  const value = useMemo<RestTimer>(
    () => ({
      durationSec: state.durationSec,
      autoStart: state.autoStart,
      remainingSec: state.endAt === null ? null : Math.max(0, Math.ceil((state.endAt - now) / 1000)),
      finished,
      start,
      stop,
      dismiss: () => setFinished(false),
      adjust: (delta) => setState((s) => (s.endAt === null ? s : { ...s, endAt: Math.max(Date.now() + 1000, s.endAt + delta * 1000) })),
      setDuration: (sec) => setState((s) => ({ ...s, durationSec: Math.max(APP_CONFIG.rest.stepSec, sec) })),
      setAutoStart: (on) => setState((s) => ({ ...s, autoStart: on })),
      onSetDone: () => {
        if (stateRef.current.autoStart) start();
      },
    }),
    [state, now, finished, start, stop],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRestTimer(): RestTimer {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRestTimer must be used inside RestTimerProvider");
  return v;
}
