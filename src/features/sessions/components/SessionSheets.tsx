import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet } from "@/components/ui/Sheet";
import { DeleteIcon, MoveDownIcon, MoveUpIcon, SkipIcon, UndoIcon } from "@/components/icons";
import { Loading, Stat } from "@/components/ui/misc";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useSession } from "@/features/data/hooks";
import { useModals } from "@/features/modals/ModalContext";
import { useToday } from "@/features/data/ClockContext";
import { useSessionActions } from "../useSessionActions";
import { finishPreview, hasAnyValue, sessionDurationMin, sessionSummary, isValidDoneSet } from "@/lib/session/session";
import { rowHasRecord } from "@/lib/session/records";
import { sessionTitle } from "@/lib/session/format";
import { agoText } from "@/lib/date/format";
import { toDateKey } from "@/lib/date/dateKey";
import { toast } from "@/lib/utils/toast";
import { paths } from "@/routes/paths";
import styles from "./Sessions.module.css";

/** M3: finish the session (summary, not done, records). M8 when nothing was logged. */
export function FinishSessionSheet({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const { logsById } = useData();
  const actions = useSessionActions();
  const { data: session, loading } = useSession(sessionId);

  const records = useMemo(() => {
    if (!session) return 0;
    return session.exercises.filter((r) => rowHasRecord(r, logsById.get(r.exerciseId), session.id, session.date)).length;
  }, [session, logsById]);

  if (loading || !session) return <Sheet onClose={onClose}>{<Loading />}</Sheet>;

  if (!hasAnyValue(session.exercises)) {
    return (
      <Sheet
        title={t.finish.discardTitle}
        onClose={onClose}
        footer={
          <>
            <button className="btn" onClick={onClose}>
              {t.finish.keepGoing}
            </button>
            <button
              className="btn danger"
              onClick={() => {
                actions.remove(session);
                onClose();
                navigate(paths.home, { replace: true });
              }}
            >
              {t.finish.discard}
            </button>
          </>
        }
      >
        <p className="muted">{t.finish.discardBody}</p>
      </Sheet>
    );
  }

  const preview = finishPreview(session);
  const summary = sessionSummary(session);
  const sets = summary.sets + preview.unchecked;

  return (
    <Sheet
      title={t.finish.title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t.finish.keepGoing}
          </button>
          <button
            className="btn acc"
            onClick={() => {
              actions.finish(session);
              toast(t.finish.finished);
              onClose();
              navigate(paths.home, { replace: true });
            }}
          >
            {t.finish.finish}
          </button>
        </>
      }
    >
      <div className={styles.finishStats}>
        <Stat value={sessionDurationMin(session)} label={t.finish.minutes} />
        <Stat value={sets} label={t.finish.sets} />
        <Stat value={records} label={t.finish.records} />
      </div>
      {preview.notDone.length > 0 && <p className="muted">{fmt(t.finish.notDone, { list: preview.notDone.join(", ") })}</p>}
      {preview.unchecked > 0 && <p className="muted">{fmt(t.finish.unchecked, { n: preview.unchecked })}</p>}
      {preview.empty > 0 && <p className="hint">{t.finish.emptySets}</p>}
    </Sheet>
  );
}

/** M9: the app was opened with a session still in progress. */
export function ResumeSessionSheet({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const today = useToday();
  const { replace } = useModals();
  const actions = useSessionActions();
  const { activeSession } = useData();
  const session = activeSession?.id === sessionId ? activeSession : null;
  if (!session) return null;

  return (
    <Sheet
      title={t.resume.title}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn danger"
            onClick={() =>
              replace({
                type: "confirm",
                title: t.finish.discardTitle,
                lines: [fmt(t.session.sets, { n: sessionSummary(session).sets })],
                confirmLabel: t.finish.discard,
                danger: true,
                onConfirm: () => actions.remove(session),
              })
            }
          >
            {t.resume.discard}
          </button>
          <button className="btn" onClick={() => replace({ type: "finishSession", sessionId })}>
            {t.resume.finishNow}
          </button>
          <button
            className="btn acc"
            onClick={() => {
              onClose();
              navigate(paths.session(sessionId));
            }}
          >
            {t.resume.continue}
          </button>
        </>
      }
    >
      <p className="muted">{fmt(t.resume.body, { name: sessionTitle(session), when: agoText(toDateKey(new Date(session.startedAt)), today) })}</p>
    </Sheet>
  );
}

/** M11: options of an exercise in the session. */
export function RowOptionsSheet({ sessionId, rowId, onClose }: { sessionId: string; rowId: string; onClose: () => void }) {
  const t = useT();
  const { replace } = useModals();
  const actions = useSessionActions();
  const { data: session } = useSession(sessionId);
  const index = session?.exercises.findIndex((r) => r.id === rowId) ?? -1;
  const row = session && index >= 0 ? session.exercises[index] : null;
  if (!session || !row) return <Sheet onClose={onClose}>{<Loading />}</Sheet>;

  const doneSets = row.sets.filter((s) => isValidDoneSet(s, row.logType)).length;
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <Sheet eyebrow={t.rowMenu.title} title={row.exerciseName} onClose={onClose}>
      <button className={styles.menuBtn} disabled={index === 0} onClick={act(() => actions.moveRow(session, row.id, -1))}>
        <MoveUpIcon size={18} />
        {t.rowMenu.up}
      </button>
      <button className={styles.menuBtn} disabled={index === session.exercises.length - 1} onClick={act(() => actions.moveRow(session, row.id, 1))}>
        <MoveDownIcon size={18} />
        {t.rowMenu.down}
      </button>
      <button className={styles.menuBtn} onClick={act(() => actions.updateRow(session, row.id, (r) => ({ ...r, skipped: !r.skipped })))}>
        {row.skipped ? <UndoIcon size={18} /> : <SkipIcon size={18} />}
        {row.skipped ? t.rowMenu.unskip : t.rowMenu.skip}
      </button>
      <button
        className={`${styles.menuBtn} ${styles.danger}`}
        onClick={() => {
          if (doneSets === 0) {
            actions.removeRow(session, row.id);
            onClose();
            return;
          }
          replace({
            type: "confirm",
            title: fmt(t.rowMenu.removeConfirm, { name: row.exerciseName }),
            lines: [fmt(t.rowMenu.removeLines, { n: doneSets }), t.rowMenu.removeHint],
            confirmLabel: t.common.remove,
            danger: true,
            onConfirm: () => actions.removeRow(session, row.id),
          });
        }}
      >
        <DeleteIcon size={18} />
        {t.rowMenu.remove}
      </button>
      <p className="hint">{t.rowMenu.removeHint}</p>
    </Sheet>
  );
}
