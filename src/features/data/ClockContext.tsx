import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DateKey } from "@/types/models";
import { todayKey } from "@/lib/date/dateKey";

const ClockContext = createContext<DateKey | null>(null);

/** Provides today's DateKey; updates at midnight and when the app becomes visible. */
export function ClockProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState<DateKey>(() => todayKey());
  useEffect(() => {
    const check = () => setToday((prev) => (prev === todayKey() ? prev : todayKey()));
    const timer = window.setInterval(check, 60_000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return <ClockContext.Provider value={today}>{children}</ClockContext.Provider>;
}

export function useToday(): DateKey {
  const ctx = useContext(ClockContext);
  if (!ctx) throw new Error("useToday must be used inside ClockProvider");
  return ctx;
}

/** Current time in ms, refreshed every `intervalMs` (for stopwatches). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
