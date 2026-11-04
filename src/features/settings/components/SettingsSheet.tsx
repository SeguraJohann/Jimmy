import { useMemo, useState } from "react";
import type { ColorKey } from "@/types/models";
import { Sheet } from "@/components/ui/Sheet";
import { AddIcon, CloseIcon, LogoutIcon, RebuildIcon } from "@/components/icons";
import { useT, fmt } from "@/i18n";
import { useAuth } from "@/features/auth/AuthContext";
import { useData } from "@/features/data/DataContext";
import { useCatalogActions } from "@/features/catalog/useCatalogActions";
import { ColorPicker } from "@/features/routines/components/RoutineSheets";
import { APP_CONFIG } from "@/config/app.config";
import { colorVar } from "@/styles/semantic";
import { reportError } from "@/lib/utils/errors";
import { toast } from "@/lib/utils/toast";
import styles from "./Settings.module.css";

/** Settings (C15): block types, muscle groups, maintenance, account. */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { user, signOutUser } = useAuth();
  const { catalog, routines, exercises } = useData();
  const actions = useCatalogActions();
  const [editing, setEditing] = useState<string | null>(null);
  const [newType, setNewType] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [busy, setBusy] = useState(false);

  const usedTypes = useMemo(() => {
    const s = new Set<string>();
    for (const r of routines) for (const b of Object.values(r.blocks)) s.add(b.typeId);
    return s;
  }, [routines]);
  const usedGroups = useMemo(() => new Set(exercises.map((e) => e.muscleGroup)), [exercises]);

  const addType = () => {
    if (!newType.trim()) return;
    actions.addBlockType(newType, APP_CONFIG.colors[catalog.blockTypes.length % APP_CONFIG.colors.length]);
    setNewType("");
  };

  const editingType = catalog.blockTypes.find((x) => x.id === editing);

  return (
    <Sheet title={t.settings.title} onClose={onClose}>
      <section className="stack sm">
        <span className="lbl">{t.settings.blockTypes}</span>
        <p className="hint">{t.settings.blockTypesHint}</p>
        <div className="chips">
          {catalog.blockTypes.map((bt) => (
            <button key={bt.id} className={`chip ${editing === bt.id ? "sel" : ""}`} onClick={() => setEditing((e) => (e === bt.id ? null : bt.id))}>
              <i className="dot" style={{ background: colorVar(bt.color) }} />
              {bt.name}
            </button>
          ))}
        </div>
        {editingType && (
          <div className={styles.editor}>
            <div className="row">
              <input
                className="inp"
                defaultValue={editingType.name}
                aria-label={t.settings.rename}
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== editingType.name && actions.updateBlockType(editingType.id, { name: e.target.value.trim() })}
              />
              {!usedTypes.has(editingType.id) && (
                <button
                  className="btn icon danger"
                  aria-label={t.settings.removeType}
                  onClick={() => {
                    actions.removeBlockType(editingType.id);
                    setEditing(null);
                  }}
                >
                  <CloseIcon size={18} />
                </button>
              )}
            </div>
            <ColorPicker value={editingType.color} onChange={(c: ColorKey) => actions.updateBlockType(editingType.id, { color: c })} />
            {usedTypes.has(editingType.id) && <p className="hint">{t.settings.inUse}</p>}
          </div>
        )}
        <div className="row">
          <input className="inp" value={newType} placeholder={t.blockForm.newTypePlaceholder} aria-label={t.blockForm.newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addType()} />
          <button className="btn icon" onClick={addType} aria-label={t.settings.add}>
            <AddIcon size={18} />
          </button>
        </div>
      </section>

      <section className="stack sm">
        <span className="lbl">{t.settings.muscleGroups}</span>
        <div className="chips">
          {catalog.muscleGroups.map((g) => (
            <span key={g} className="chip">
              {g}
              {!usedGroups.has(g) && (
                <button onClick={() => actions.removeMuscleGroup(g)} aria-label={`${t.settings.removeGroup} ${g}`} style={{ display: "inline-flex" }}>
                  <CloseIcon size={14} />
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="row">
          <input
            className="inp"
            value={newGroup}
            placeholder={t.exercises.newGroupPlaceholder}
            aria-label={t.exercises.newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                actions.addMuscleGroup(newGroup);
                setNewGroup("");
              }
            }}
          />
          <button
            className="btn icon"
            aria-label={t.settings.add}
            onClick={() => {
              actions.addMuscleGroup(newGroup);
              setNewGroup("");
            }}
          >
            <AddIcon size={18} />
          </button>
        </div>
      </section>

      <section className="stack sm">
        <span className="lbl">{t.settings.maintenance}</span>
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const n = await actions.rebuildLogs();
              toast(fmt(t.settings.rebuilt, { n }));
            } catch (e) {
              reportError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <RebuildIcon size={18} />
          {t.settings.rebuild}
        </button>
        <p className="hint">{t.settings.rebuildHint}</p>
      </section>

      {user && (
        <section className="stack sm">
          <span className="lbl">{t.settings.account}</span>
          <div className="row">
            <span className="grow ellipsis muted">{user.email}</span>
            <button className="btn sm" onClick={() => void signOutUser()}>
              <LogoutIcon size={16} />
              {t.auth.signOut}
            </button>
          </div>
        </section>
      )}
    </Sheet>
  );
}
