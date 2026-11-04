import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { BlockExercise, CycleDay, DateKey, Routine, WeightUnit } from "@/types/models";

/** Every intermediate view (M1–M11 and helpers). */
export type ModalSpec =
  /** M1: pick an exercise (session or routine block). */
  | { type: "exercisePicker"; highlightIds?: string[]; excludeIds?: string[]; note?: string; onPick: (exerciseId: string) => void }
  /** M2: create / edit an exercise. */
  | { type: "exerciseForm"; exerciseId?: string; initialName?: string; onSaved?: (id: string) => void }
  /** M3: finish session (M8 discard included when nothing was logged). */
  | { type: "finishSession"; sessionId: string }
  /** Combined session: add a day of another routine to the session in progress. */
  | { type: "addRoutine"; sessionId: string }
  /** Rest timer settings. */
  | { type: "restTimer" }
  /** M9: a session is still in progress. */
  | { type: "resumeSession"; sessionId: string }
  /** M11: options of an exercise in the session. */
  | { type: "rowOptions"; sessionId: string; rowId: string }
  /** M4: create / edit a block. */
  | { type: "blockForm"; initial?: { name: string; typeId: string }; defaultName?: string; onSave: (name: string, typeId: string) => void; onDelete?: () => void }
  /** M5: target of an exercise in a block. */
  | { type: "target"; exerciseName: string; weightUnit?: WeightUnit; value: BlockExercise; onSave: (v: BlockExercise) => void; onRemove: () => void }
  /** M6: edit a cycle day. */
  | { type: "cycleDay"; routine: Pick<Routine, "blocks">; day: CycleDay; number: number; onSave: (day: CycleDay) => void }
  /** M7 / M8: confirmations with explicit consequences. */
  | { type: "confirm"; title: string; lines: string[]; confirmLabel: string; danger?: boolean; onConfirm: () => void }
  /** M10: date picker. */
  | { type: "pickDate"; title: string; initial: DateKey; max?: DateKey; onPick: (date: DateKey) => void }
  | { type: "settings" };

interface Entry {
  id: number;
  spec: ModalSpec;
}

interface ModalContextValue {
  stack: Entry[];
  open: (spec: ModalSpec) => void;
  /** Closes the top-most modal. */
  close: () => void;
  /** Replaces the top-most modal (e.g. M1 → M2). */
  replace: (spec: ModalSpec) => void;
  closeAll: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);
let seq = 0;

export function ModalProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Entry[]>([]);
  const open = useCallback((spec: ModalSpec) => setStack((s) => [...s, { id: ++seq, spec }]), []);
  const close = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const replace = useCallback((spec: ModalSpec) => setStack((s) => [...s.slice(0, -1), { id: ++seq, spec }]), []);
  const closeAll = useCallback(() => setStack([]), []);
  const value = useMemo(() => ({ stack, open, close, replace, closeAll }), [stack, open, close, replace, closeAll]);
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModals(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModals must be used inside ModalProvider");
  return ctx;
}
