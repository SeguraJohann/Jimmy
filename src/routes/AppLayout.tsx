import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useT } from "@/i18n";
import { ExercisesIcon, HistoryIcon, HomeIcon, LogoutIcon, OfflineIcon, ProgressIcon, RoutinesIcon, SettingsIcon } from "@/components/icons";
import { ErrorNote, Loading } from "@/components/ui/misc";
import { useAuth } from "@/features/auth/AuthContext";
import { useData } from "@/features/data/DataContext";
import { useModals } from "@/features/modals/ModalContext";
import { RestTimerFab, RestTimerSpacer } from "@/features/sessions/rest/RestTimerFab";
import { paths } from "./paths";
import styles from "./AppLayout.module.css";

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

const NAV = [
  { to: paths.home, icon: HomeIcon, key: "home" },
  { to: paths.history, icon: HistoryIcon, key: "history" },
  { to: paths.progress, icon: ProgressIcon, key: "progress" },
  { to: paths.exercises, icon: ExercisesIcon, key: "exercises" },
  { to: paths.routines, icon: RoutinesIcon, key: "routines" },
] as const;

export function AppLayout() {
  const t = useT();
  const { user, signOutUser } = useAuth();
  const { activeSession, loading, error } = useData();
  const { open } = useModals();
  const location = useLocation();
  const online = useOnline();
  const path = location.pathname;

  // Focus mode (G1): no tab bar inside a session on mobile.
  const focus = path.startsWith("/sesion/") && path !== paths.newSession;

  // Rest timer: floating while inside the session in progress.
  const showRest = focus && !!activeSession && path.startsWith(paths.session(activeSession.id));

  // M9: offer to continue an unfinished session once per app load.
  const prompted = useRef(false);
  useEffect(() => {
    if (prompted.current || loading || !activeSession) return;
    prompted.current = true;
    if (!path.startsWith(paths.session(activeSession.id))) open({ type: "resumeSession", sessionId: activeSession.id });
  }, [loading, activeSession, path, open]);

  // Scroll to top on navigation.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [path]);

  const navCls = ({ isActive }: { isActive: boolean }) => `${styles.nv} ${isActive ? styles.on : ""}`;
  const tabCls = ({ isActive }: { isActive: boolean }) => (isActive ? styles.on : "");

  return (
    <div className={styles.app}>
      <nav className={styles.side} aria-label={t.nav.main}>
        <Link to={paths.home} className={styles.brand}>
          <i className={styles.mark} />
          {t.app.name}
        </Link>
        {NAV.map((n) => (
          <NavLink key={n.key} to={n.to} className={navCls}>
            <n.icon size={18} />
            {t.nav[n.key]}
          </NavLink>
        ))}
        <div className={styles.sideFoot}>
          <button className={styles.nv} onClick={() => open({ type: "settings" })}>
            <SettingsIcon size={18} />
            {t.nav.settings}
          </button>
          {user && (
            <div className={styles.user}>
              <span title={user.email}>{user.email}</span>
              <button onClick={() => void signOutUser()} aria-label={t.auth.signOut} title={t.auth.signOut}>
                <LogoutIcon size={16} />
              </button>
            </div>
          )}
        </div>
      </nav>

      <main ref={mainRef} className={`${styles.main} ${focus ? styles.focus : ""}`}>
        <div className={styles.inner}>
          {!online && (
            <div className={styles.offline} role="status">
              <OfflineIcon size={16} />
              {t.app.offline}
            </div>
          )}
          {error && <ErrorNote>{t.app.loadError}</ErrorNote>}
          {loading ? <Loading /> : <Outlet />}
          {showRest && <RestTimerSpacer />}
        </div>
      </main>
      {showRest && <RestTimerFab />}

      {!focus && (
        <nav className={styles.tabbar} aria-label={t.nav.main}>
          {NAV.map((n) => (
            <NavLink key={n.key} to={n.to} className={tabCls}>
              <n.icon size={20} />
              {t.nav[n.key]}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
