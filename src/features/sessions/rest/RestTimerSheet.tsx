import { Sheet } from "@/components/ui/Sheet";
import { useT, fmt } from "@/i18n";
import { APP_CONFIG } from "@/config/app.config";
import { formatCountdown } from "@/lib/date/format";
import { useRestTimer } from "./RestTimerContext";
import styles from "./RestTimer.module.css";

/** Rest timer controls: ±30 s, restart, stop, default duration and auto-start. */
export function RestTimerSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const rest = useRestTimer();
  const running = rest.remainingSec !== null;
  const step = APP_CONFIG.rest.stepSec;

  return (
    <Sheet
      title={t.rest.title}
      onClose={onClose}
      footer={
        <>
          {running && (
            <button className="btn" onClick={rest.stop}>
              {t.rest.stop}
            </button>
          )}
          <button
            className="btn acc"
            onClick={() => {
              rest.start();
              onClose();
            }}
          >
            {running ? t.rest.restart : t.rest.start}
          </button>
        </>
      }
    >
      <p className={styles.big}>{formatCountdown(running ? rest.remainingSec! : rest.durationSec)}</p>
      {running && (
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={() => rest.adjust(-step)}>
            {fmt(t.rest.minus, { n: step })}
          </button>
          <button className="btn" onClick={() => rest.adjust(step)}>
            {fmt(t.rest.plus, { n: step })}
          </button>
        </div>
      )}
      <div className="field">
        <span className="lbl">{t.rest.duration}</span>
        <div className="chips" role="radiogroup" aria-label={t.rest.duration}>
          {APP_CONFIG.rest.presetsSec.map((sec) => (
            <button key={sec} role="radio" aria-checked={rest.durationSec === sec} className={`chip ${rest.durationSec === sec ? "sel" : ""}`} onClick={() => rest.setDuration(sec)}>
              {formatCountdown(sec)}
            </button>
          ))}
        </div>
      </div>
      <label className="row" style={{ gap: 12 }}>
        <input type="checkbox" checked={rest.autoStart} onChange={(e) => rest.setAutoStart(e.target.checked)} style={{ width: 22, height: 22 }} />
        <span className="grow">
          <b style={{ display: "block" }}>{t.rest.autoStart}</b>
          <span className="muted">{t.rest.autoStartHint}</span>
        </span>
      </label>
      <p className="hint">{t.rest.backgroundHint}</p>
    </Sheet>
  );
}
