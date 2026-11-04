// @vitest-environment jsdom
// Smoke tests: every screen and modal renders with sample data and the data
// layer mocked (no Firebase). Catches runtime crashes in the UI.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import type { Catalog, Exercise, ExerciseLog, LogEntry, Routine, Session, SessionExercise } from "@/types/models";
import { addDays, todayKey } from "@/lib/date/dateKey";
import type { ModalSpec } from "@/features/modals/ModalContext";

const today = todayKey();

const ex = (id: string, name: string, logType: Exercise["logType"] = "weight_reps", extra: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  muscleGroup: "Espalda",
  equipment: "cable",
  logType,
  notes: null,
  archived: false,
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

const EXERCISES: Exercise[] = [
  ex("jalon", "Jalón al pecho"),
  ex("remo", "Remo con barra", "weight_reps", { equipment: "barbell" }),
  ex("dom", "Dominadas", "reps", { equipment: "bodyweight" }),
  ex("plancha", "Plancha", "time", { muscleGroup: "Core", equipment: null }),
  ex("old", "Pullover", "weight_reps", { archived: true }),
  ex("nuevo", "Hip thrust", "weight_reps", { muscleGroup: "Pierna" }),
];

const CATALOG: Catalog = {
  muscleGroups: ["Espalda", "Pecho", "Pierna", "Core"],
  blockTypes: [
    { id: "pull", name: "Pull", color: "amber" },
    { id: "leg", name: "Leg", color: "blue" },
  ],
};

const ROUTINE: Routine = {
  id: "ppl",
  name: "PPL 4 días",
  description: null,
  status: "active",
  blocks: {
    p2: {
      name: "Pull 2",
      typeId: "pull",
      position: 1,
      exercises: [
        { id: "x1", exerciseId: "remo", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetWeight: null, note: null },
        { id: "x2", exerciseId: "jalon", targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetWeight: null, note: "agarre ancho" },
      ],
    },
    l2: { name: "Leg 2", typeId: "leg", position: 2, exercises: [{ id: "x3", exerciseId: "plancha", targetSets: 2, targetRepsMin: null, targetRepsMax: null, targetWeight: null, note: null }] },
  },
  cycle: [
    { id: "d1", name: null, blockIds: ["p2", "l2"] },
    { id: "d2", name: "Brazos", blockIds: ["p2"] },
  ],
  createdAt: 0,
  updatedAt: 0,
};
const ARCHIVED: Routine = { ...ROUTINE, id: "old", name: "Torso / Pierna", status: "archived" };

// 90 sessions of history over ~10 months (forces chart aggregation).
const entry = (date: string, sets: LogEntry["sets"], blockId = "p2"): LogEntry => ({ date, routineId: "ppl", routineName: "PPL 4 días", blockId, blockName: "Pull 2", blockTypeId: "pull", sets });
const jalonEntries: Record<string, LogEntry> = {};
const remoEntries: Record<string, LogEntry> = {};
const domEntries: Record<string, LogEntry> = {};
const planchaEntries: Record<string, LogEntry> = {};
for (let i = 0; i < 90; i++) {
  const d = addDays(today, -300 + i * 3);
  jalonEntries[`s${i}`] = entry(d, [
    { w: 40 + i * 0.2, r: 12, s: null },
    { w: 42.5 + i * 0.2, r: 10, s: null },
  ]);
  remoEntries[`s${i}`] = entry(d, [{ w: 70 - (i > 80 ? i - 80 : 0), r: 8, s: null }]);
  if (i % 3 === 0) domEntries[`s${i}`] = entry(d, [{ w: null, r: 8 + (i % 4), s: null }]);
  if (i > 85) planchaEntries[`s${i}`] = entry(d, [{ w: null, r: null, s: 60 }], "l2");
}
const LOGS: ExerciseLog[] = [
  { exerciseId: "jalon", entries: jalonEntries },
  { exerciseId: "remo", entries: remoEntries },
  { exerciseId: "dom", entries: domEntries },
  { exerciseId: "plancha", entries: planchaEntries },
];

const row = (id: string, exerciseId: string, name: string, logType: Exercise["logType"], sets: SessionExercise["sets"], extra: Partial<SessionExercise> = {}): SessionExercise => ({
  id,
  exerciseId,
  exerciseName: name,
  logType,
  blockId: "p2",
  blockName: "Pull 2",
  blockTypeId: "pull",
  blockTypeName: "Pull",
  blockColor: "amber",
  target: { sets: 3, repsMin: 10, repsMax: 12, weight: null, note: null },
  skipped: false,
  notes: null,
  sets,
  ...extra,
});

const ACTIVE: Session = {
  id: "live",
  date: today,
  status: "in_progress",
  routineId: "ppl",
  routineName: "PPL 4 días",
  cycleDayId: "d1",
  cycleDayNumber: 1,
  dayName: "Pull 2 + Leg 2",
  startedAt: Date.now() - 38 * 60_000,
  endedAt: null,
  notes: "Hombro cargado",
  exercises: [
    row("r1", "remo", "Remo con barra", "weight_reps", [
      { weight: 70, reps: 8, seconds: null, done: true },
      { weight: 72.5, reps: 8, seconds: null, done: true },
      { weight: 72.5, reps: null, seconds: null, done: false },
    ]),
    row("r2", "jalon", "Jalón al pecho", "weight_reps", [{ weight: 60, reps: null, seconds: null, done: false }]),
    row("r3", "plancha", "Plancha", "time", [{ weight: null, reps: null, seconds: 45, done: false }], { blockId: "l2", blockName: "Leg 2", blockTypeId: "leg", blockTypeName: "Leg", blockColor: "blue" }),
    row("r4", "dom", "Dominadas", "reps", [], { blockId: null, blockName: null, blockTypeId: null, blockTypeName: null, blockColor: null, target: null, skipped: true }),
  ],
  createdAt: 0,
  updatedAt: 0,
};
const DONE: Session = { ...ACTIVE, id: "s89", status: "done", date: addDays(today, -3), endedAt: ACTIVE.startedAt + 3_600_000, exercises: ACTIVE.exercises.map((r) => ({ ...r, sets: r.sets.map((s) => ({ ...s, done: true, reps: s.reps ?? 10 })) })) };
const FREE: Session = { ...DONE, id: "free", routineId: null, routineName: null, cycleDayId: null, cycleDayNumber: null, dayName: null, date: addDays(today, -1), exercises: [] };
const SESSIONS = [DONE, FREE, ACTIVE];

vi.mock("@/config/firebase", () => ({ firebaseConfigured: true, auth: {}, db: {}, googleProvider: {} }));
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "u", email: "yo@example.com", displayName: "Johann Segura", photoURL: null }, loading: false, signIn: async () => {}, signOutUser: async () => {} }),
  useUid: () => "u",
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/features/data/DataContext", () => ({
  useData: () => ({
    catalog: CATALOG,
    exercises: EXERCISES,
    exercisesById: new Map(EXERCISES.map((e) => [e.id, e])),
    routines: [ROUTINE, ARCHIVED],
    routinesById: new Map([ROUTINE, ARCHIVED].map((r) => [r.id, r])),
    logs: LOGS,
    logsById: new Map(LOGS.map((l) => [l.exerciseId, l])),
    activeSession: ACTIVE,
    loading: false,
    error: false,
  }),
  DataProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/features/data/hooks", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/features/data/hooks")>();
  return {
    ...orig,
    useSessionsRange: () => ({ data: SESSIONS, loading: false }),
    useRecentSessions: () => ({ data: [ACTIVE, DONE, FREE], loading: false }),
    useSession: (id: string | null) => ({ data: SESSIONS.find((s) => s.id === id) ?? null, loading: false }),
    useRoutineSessions: () => ({ data: [{ cycleDayId: "d1", cycleDayNumber: 1, date: addDays(today, -3), startedAt: 0 }], loading: false }),
  };
});
const actionsProxy = () => new Proxy({}, { get: () => () => "id" });
vi.mock("@/features/sessions/useSessionActions", () => ({ useSessionActions: actionsProxy }));
vi.mock("@/features/exercises/useExerciseActions", () => ({ useExerciseActions: actionsProxy }));
vi.mock("@/features/routines/useRoutineActions", () => ({ useRoutineActions: actionsProxy }));
vi.mock("@/features/catalog/useCatalogActions", () => ({ useCatalogActions: actionsProxy }));

const { ClockProvider } = await import("@/features/data/ClockContext");
const { ModalProvider, useModals } = await import("@/features/modals/ModalContext");
const { ModalHost } = await import("@/features/modals/ModalHost");
const { AppLayout } = await import("@/routes/AppLayout");
const { HomeScreen } = await import("@/features/home/components/HomeScreen");
const HistoryScreen = (await import("@/features/history/components/HistoryScreen")).default;
const ProgressScreen = (await import("@/features/progress/components/ProgressScreen")).default;
const ExercisesScreen = (await import("@/features/exercises/components/ExercisesScreen")).default;
const ExerciseDetailScreen = (await import("@/features/exercises/components/ExerciseDetailScreen")).default;
const RoutinesScreen = (await import("@/features/routines/components/RoutinesScreen")).default;
const RoutineEditorScreen = (await import("@/features/routines/components/RoutineEditorScreen")).default;
const NewSessionScreen = (await import("@/features/sessions/components/NewSessionScreen")).default;
const SessionScreen = (await import("@/features/sessions/components/SessionScreen")).default;
const ExerciseLogScreen = (await import("@/features/sessions/components/ExerciseLogScreen")).default;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }),
  });
  Element.prototype.scrollTo = () => {};
});
afterEach(cleanup);

function renderAt(url: string, pattern: string, el: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ClockProvider>
        <ModalProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path={pattern} element={el} />
            </Route>
          </Routes>
          <ModalHost />
        </ModalProvider>
      </ClockProvider>
    </MemoryRouter>,
  );
}

describe("screens render", () => {
  const cases: [string, string, string, () => ReactNode][] = [
    ["home", "/inicio", "/inicio", () => <HomeScreen />],
    ["history", "/historial", "/historial", () => <HistoryScreen />],
    ["history other month", "/historial?mes=2025-01", "/historial", () => <HistoryScreen />],
    ["progress", "/progreso", "/progreso", () => <ProgressScreen />],
    ["exercises", "/ejercicios", "/ejercicios", () => <ExercisesScreen />],
    ["exercise detail (weight)", "/ejercicios/jalon", "/ejercicios/:id", () => <ExerciseDetailScreen />],
    ["exercise detail (reps)", "/ejercicios/dom", "/ejercicios/:id", () => <ExerciseDetailScreen />],
    ["exercise detail (time)", "/ejercicios/plancha", "/ejercicios/:id", () => <ExerciseDetailScreen />],
    ["exercise detail (no history)", "/ejercicios/nuevo", "/ejercicios/:id", () => <ExerciseDetailScreen />],
    ["exercise missing", "/ejercicios/zzz", "/ejercicios/:id", () => <ExerciseDetailScreen />],
    ["routines", "/rutinas", "/rutinas", () => <RoutinesScreen />],
    ["routine editor", "/rutinas/ppl", "/rutinas/:id", () => <RoutineEditorScreen />],
    ["new routine", "/rutinas/nueva", "/rutinas/:id", () => <RoutineEditorScreen />],
    ["new session (redirects to active)", "/sesion/nueva", "/sesion/nueva", () => <NewSessionScreen />],
    ["session in progress", "/sesion/live", "/sesion/:id", () => <SessionScreen />],
    ["past session", "/sesion/s89", "/sesion/:id", () => <SessionScreen />],
    ["free session", "/sesion/free", "/sesion/:id", () => <SessionScreen />],
    ["log weight", "/sesion/live/ejercicio/r1", "/sesion/:id/ejercicio/:rowId", () => <ExerciseLogScreen />],
    ["log time", "/sesion/live/ejercicio/r3", "/sesion/:id/ejercicio/:rowId", () => <ExerciseLogScreen />],
    ["log skipped", "/sesion/live/ejercicio/r4", "/sesion/:id/ejercicio/:rowId", () => <ExerciseLogScreen />],
  ];
  for (const [name, url, pattern, el] of cases) {
    it(name, () => {
      const { container } = renderAt(url, pattern, el());
      expect(container.textContent?.length).toBeGreaterThan(0);
    });
  }

  it("progress shows the trend of each exercise", () => {
    const { container } = renderAt("/progreso", "/progreso", <ProgressScreen />);
    expect(container.textContent).toContain("Jalón al pecho");
    expect(container.textContent).toContain("Progresa");
    expect(container.textContent).toContain("Baja");
  });

  it("history shows the month calendar", () => {
    const { container } = renderAt("/historial", "/historial", <HistoryScreen />);
    expect(container.querySelectorAll("[role=grid] button").length).toBeGreaterThanOrEqual(28);
  });
});

function Opener({ spec }: { spec: ModalSpec }) {
  const { open } = useModals();
  useEffect(() => open(spec), []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

describe("modals render", () => {
  const noop = () => {};
  const specs: [string, ModalSpec][] = [
    ["picker", { type: "exercisePicker", highlightIds: ["jalon"], onPick: noop, note: "nota" }],
    ["exercise form new", { type: "exerciseForm" }],
    ["exercise form edit (locked type)", { type: "exerciseForm", exerciseId: "jalon" }],
    ["finish session", { type: "finishSession", sessionId: "live" }],
    ["finish empty session (discard)", { type: "finishSession", sessionId: "free" }],
    ["resume session", { type: "resumeSession", sessionId: "live" }],
    ["row options", { type: "rowOptions", sessionId: "live", rowId: "r1" }],
    ["block form", { type: "blockForm", onSave: noop }],
    ["block form edit", { type: "blockForm", initial: { name: "Pull 2", typeId: "pull" }, onSave: noop, onDelete: noop }],
    ["target", { type: "target", exerciseName: "Remo", value: ROUTINE.blocks.p2.exercises[0], onSave: noop, onRemove: noop }],
    ["cycle day", { type: "cycleDay", routine: ROUTINE, day: ROUTINE.cycle[0], number: 1, onSave: noop }],
    ["confirm", { type: "confirm", title: "¿Seguro?", lines: ["Línea"], confirmLabel: "Sí", onConfirm: noop }],
    ["pick date", { type: "pickDate", title: "Fecha", initial: today, max: today, onPick: noop }],
    ["settings", { type: "settings" }],
  ];
  for (const [name, spec] of specs) {
    it(name, () => {
      renderAt("/inicio", "/inicio", <Opener spec={spec} />);
      expect(document.querySelector("[data-sheet]")).not.toBeNull();
    });
  }
});
