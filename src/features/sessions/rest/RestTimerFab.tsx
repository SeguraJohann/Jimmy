import { MoreIcon, TimerIcon } from "@/components/icons";
import { useT } from "@/i18n";
import { useModals } from "@/features/modals/ModalContext";
import { formatCountdown } from "@/lib/date/format";
import { useRestTimer } from "./RestTimerContext";
import styles from "./RestTimer.module.css";

/**
 * Floating rest timer, always under the thumb during a session.
 * Tap: start (idle) · stop (running) · dismiss (finished). ⋯ opens the settings.
 */
export function RestTimerFab() {
  const t = useT();
  const rest = useRestTimer();
  const { open } = useModals();
  const running = rest.remainingSec !== null;

  const label = rest.finished ? t.rest.ready : formatCountdown(running ? rest.remainingSec! : rest.durationSec);
  const action = rest.finished ? rest.dismiss : running ? rest.stop : rest.start;
  const aria = rest.finished ? t.rest.dismiss : running ? t.rest.stop : t.rest.start;
  const pct = running ? (rest.remainingSec! / rest.durationSec) * 100 : 0;

  return (
    <div className={`${styles.fab} ${running ? styles.running : ""} ${rest.finished ? styles.finished : ""}`} role="timer">
      <button className={styles.main} onClick={action} aria-label={aria} title={aria}>
        <TimerIcon size={20} />
        {label}
        {running && <span className={styles.bar} style={{ width: `${Math.min(100, pct)}%` }} />}
      </button>
      <button className={styles.more} onClick={() => open({ type: "restTimer" })} aria-label={t.rest.settings} title={t.rest.settings}>
        <MoreIcon size={20} />
      </button>
    </div>
  );
}

/** Keeps the last row of the page clear of the floating timer. */
export function RestTimerSpacer() {
  return <div className={styles.spacer} aria-hidden />;
}
