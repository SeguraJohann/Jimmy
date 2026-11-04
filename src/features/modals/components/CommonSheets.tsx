import { useState } from "react";
import type { DateKey } from "@/types/models";
import { Sheet } from "@/components/ui/Sheet";
import { useT } from "@/i18n";
import { isValidDateKey } from "@/lib/date/dateKey";
import { longDate } from "@/lib/date/format";

/** M7 / M8: confirmation with explicit consequences. */
export function ConfirmSheet({
  title,
  lines,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  lines: string[];
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            className={`btn ${danger ? "danger" : "acc"}`}
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {lines.map((l) => (
        <p key={l} className="muted">
          {l}
        </p>
      ))}
    </Sheet>
  );
}

/** M10: date picker (native input, today as default max). */
export function PickDateSheet({
  title,
  initial,
  max,
  onPick,
  onClose,
}: {
  title: string;
  initial: DateKey;
  max?: DateKey;
  onPick: (d: DateKey) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState(initial);
  const valid = isValidDateKey(value) && (!max || value <= max);
  const submit = () => {
    if (!valid) return;
    onClose();
    onPick(value);
  };
  return (
    <Sheet
      title={title}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button className="btn acc" onClick={submit} disabled={!valid}>
            {t.common.save}
          </button>
        </>
      }
    >
      <input className="inp" type="date" value={value} max={max} onChange={(e) => setValue(e.target.value)} aria-label={title} />
      {valid && <p className="muted">{longDate(value)}</p>}
    </Sheet>
  );
}
