export const paths = {
  home: "/inicio",
  history: "/historial",
  historyMonth: (month: string) => `/historial?mes=${month}`,
  progress: "/progreso",
  exercises: "/ejercicios",
  exercise: (id: string) => `/ejercicios/${id}`,
  routines: "/rutinas",
  newRoutine: "/rutinas/nueva",
  routine: (id: string) => `/rutinas/${id}`,
  newSession: "/sesion/nueva",
  session: (id: string) => `/sesion/${id}`,
  sessionRow: (id: string, rowId: string) => `/sesion/${id}/ejercicio/${rowId}`,
};
