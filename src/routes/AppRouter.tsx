import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { DataProvider } from "@/features/data/DataContext";
import { ClockProvider } from "@/features/data/ClockContext";
import { ModalProvider } from "@/features/modals/ModalContext";
import { ModalHost } from "@/features/modals/ModalHost";
import { HomeScreen } from "@/features/home/components/HomeScreen";
import { Loading } from "@/components/ui/misc";
import { ToastHost } from "@/components/ui/ToastHost";
import { firebaseConfigured } from "@/config/firebase";
import { useT } from "@/i18n";
import { AppLayout } from "./AppLayout";
import { paths } from "./paths";

const HistoryScreen = lazy(() => import("@/features/history/components/HistoryScreen"));
const ProgressScreen = lazy(() => import("@/features/progress/components/ProgressScreen"));
const ExercisesScreen = lazy(() => import("@/features/exercises/components/ExercisesScreen"));
const ExerciseDetailScreen = lazy(() => import("@/features/exercises/components/ExerciseDetailScreen"));
const RoutinesScreen = lazy(() => import("@/features/routines/components/RoutinesScreen"));
const RoutineEditorScreen = lazy(() => import("@/features/routines/components/RoutineEditorScreen"));
const NewSessionScreen = lazy(() => import("@/features/sessions/components/NewSessionScreen"));
const SessionScreen = lazy(() => import("@/features/sessions/components/SessionScreen"));
const ExerciseLogScreen = lazy(() => import("@/features/sessions/components/ExerciseLogScreen"));

const lazyEl = (node: ReactNode) => <Suspense fallback={<Loading />}>{node}</Suspense>;

export function AppRouter() {
  const { user, loading } = useAuth();
  const t = useT();

  if (!firebaseConfigured) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p className="card" style={{ maxWidth: 420 }}>
          {t.app.notConfigured}
        </p>
      </div>
    );
  }
  if (loading) return <Loading full />;
  if (!user) return <LoginScreen />;

  return (
    <BrowserRouter>
      <ClockProvider>
        <DataProvider>
          <ModalProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to={paths.home} replace />} />
                <Route path={paths.home} element={<HomeScreen />} />
                <Route path={paths.history} element={lazyEl(<HistoryScreen />)} />
                <Route path={paths.progress} element={lazyEl(<ProgressScreen />)} />
                <Route path={paths.exercises} element={lazyEl(<ExercisesScreen />)} />
                <Route path={`${paths.exercises}/:id`} element={lazyEl(<ExerciseDetailScreen />)} />
                <Route path={paths.routines} element={lazyEl(<RoutinesScreen />)} />
                <Route path={`${paths.routines}/:id`} element={lazyEl(<RoutineEditorScreen />)} />
                <Route path={paths.newSession} element={lazyEl(<NewSessionScreen />)} />
                <Route path="/sesion/:id" element={lazyEl(<SessionScreen />)} />
                <Route path="/sesion/:id/ejercicio/:rowId" element={lazyEl(<ExerciseLogScreen />)} />
                <Route path="*" element={<Navigate to={paths.home} replace />} />
              </Route>
            </Routes>
            <ModalHost />
            <ToastHost />
          </ModalProvider>
        </DataProvider>
      </ClockProvider>
    </BrowserRouter>
  );
}
