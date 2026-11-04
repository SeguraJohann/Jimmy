import { useModals, type ModalSpec } from "./ModalContext";
import { ConfirmSheet, PickDateSheet } from "./components/CommonSheets";
import { ExercisePickerSheet } from "@/features/exercises/components/ExercisePickerSheet";
import { ExerciseFormSheet } from "@/features/exercises/components/ExerciseFormSheet";
import { FinishSessionSheet, ResumeSessionSheet, RowOptionsSheet } from "@/features/sessions/components/SessionSheets";
import { BlockFormSheet, CycleDaySheet, TargetSheet } from "@/features/routines/components/RoutineSheets";
import { SettingsSheet } from "@/features/settings/components/SettingsSheet";

function render(spec: ModalSpec, close: () => void) {
  switch (spec.type) {
    case "exercisePicker":
      return <ExercisePickerSheet highlightIds={spec.highlightIds} excludeIds={spec.excludeIds} note={spec.note} onPick={spec.onPick} onClose={close} />;
    case "exerciseForm":
      return <ExerciseFormSheet exerciseId={spec.exerciseId} initialName={spec.initialName} onSaved={spec.onSaved} onClose={close} />;
    case "finishSession":
      return <FinishSessionSheet sessionId={spec.sessionId} onClose={close} />;
    case "resumeSession":
      return <ResumeSessionSheet sessionId={spec.sessionId} onClose={close} />;
    case "rowOptions":
      return <RowOptionsSheet sessionId={spec.sessionId} rowId={spec.rowId} onClose={close} />;
    case "blockForm":
      return <BlockFormSheet initial={spec.initial} onSave={spec.onSave} onDelete={spec.onDelete} onClose={close} />;
    case "target":
      return <TargetSheet exerciseName={spec.exerciseName} value={spec.value} onSave={spec.onSave} onRemove={spec.onRemove} onClose={close} />;
    case "cycleDay":
      return <CycleDaySheet routine={spec.routine} day={spec.day} number={spec.number} onSave={spec.onSave} onClose={close} />;
    case "confirm":
      return <ConfirmSheet title={spec.title} lines={spec.lines} confirmLabel={spec.confirmLabel} danger={spec.danger} onConfirm={spec.onConfirm} onClose={close} />;
    case "pickDate":
      return <PickDateSheet title={spec.title} initial={spec.initial} max={spec.max} onPick={spec.onPick} onClose={close} />;
    case "settings":
      return <SettingsSheet onClose={close} />;
  }
}

/** Renders the modal stack; only the top-most one handles Escape. */
export function ModalHost() {
  const { stack, close } = useModals();
  return (
    <>
      {stack.map((entry) => (
        <div key={entry.id}>{render(entry.spec, close)}</div>
      ))}
    </>
  );
}
