import { TimerIcon } from "@/components/icons";
import { useNow } from "@/features/data/ClockContext";
import { formatClock } from "@/lib/date/format";
import styles from "./Sessions.module.css";

/** Stopwatch since the session started (S9); survives closing the app. */
export function SessionTimer({ startedAt, small }: { startedAt: number; small?: boolean }) {
  const now = useNow(1000);
  return (
    <span className={`${styles.timer} ${small ? styles.timerSm : ""}`} role="timer">
      <TimerIcon size={small ? 16 : 20} />
      {formatClock(now - startedAt)}
    </span>
  );
}
