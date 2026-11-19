import { lazy, Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpRight, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight,
  Dumbbell, Guitar, LoaderCircle, Pause, Play, Pyramid,
} from "lucide-react";
import type { Entry, Settings } from "../types";
import { api } from "../lib/api";
import { shiftDate } from "../lib/metrics.js";
import "./priorities.css";

const PriorityScene = lazy(() => import("./PriorityScene"));
const priorities = [
  { id: "study", title: "Study", icon: BookOpen, section: "focus" },
  { id: "gym", title: "Gym", icon: Dumbbell, section: "training" },
  { id: "guitar", title: "Guitar", icon: Guitar, section: "guitar" },
] as const;
type Detail = (typeof priorities)[number]["section"];
type QuickFields = Pick<Entry, "studyMinutes" | "studyNote" | "workoutDone" | "guitarDone" | "guitarMinutes">;

type Props = {
  entry: Entry;
  today: string;
  settings: Settings;
  onDate: (date: string) => void;
  onDetails: (section: Detail) => void;
  onSaved: (entry: Entry) => void;
  onDirty: (dirty: boolean) => void;
};

function activity(done: boolean | null, minutes: number | null, yes: string) {
  if (done === false) return { state: "rest", label: "Skipped" };
  if (done === true) return { state: "done", label: minutes && minutes > 0 ? `${minutes} min` : yes };
  return { state: "blank", label: "Not logged" };
}

function Toggle({ label, value, onChange }: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <div className="priority-toggle" role="group" aria-label={label}>
      {([true, false, null] as const).map((choice, index) => (
        <button key={index} type="button" aria-pressed={value === choice} onClick={() => onChange(choice)}>
          {["Yes", "No", "Unlogged"][index]}
        </button>
      ))}
    </div>
  );
}

export default function Priorities({ entry, today, settings, onDate, onDetails, onSaved, onDirty }: Props) {
  const [edit, setEdit] = useState<{ date: string; fields: Partial<QuickFields> }>({ date: entry.date, fields: {} });
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ date: string; message: string }>();
  const [staticView, setStaticView] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [paused, setPaused] = useState(false);
  const date = entry.date;
  const patch = edit.date === date ? edit.fields : {};
  const draft = { ...entry, ...patch };
  const dirty = Object.keys(patch).length > 0;
  const saving = savingDate !== null;
  const states = [
    activity(entry.studyMinutes === null ? null : entry.studyMinutes > 0, entry.studyMinutes, "Studied"),
    activity(entry.workoutDone, null, "Trained"),
    activity(entry.guitarDone, entry.guitarMinutes, "Practiced"),
  ];
  const lit = states.map(({ state }) => state === "done");
  const completed = lit.filter(Boolean).length;

  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);

  function change<K extends keyof QuickFields>(key: K, value: QuickFields[K]) {
    setEdit((previous) => {
      const fields = previous.date === date ? { ...previous.fields } : {};
      if (value === entry[key]) delete fields[key];
      else fields[key] = value;
      return { date, fields };
    });
    setSaveError(undefined);
  }

  function selectDate(next: string) {
    if (next && next !== date && next >= settings.startDate && next <= today && !saving) onDate(next);
  }

  // Drop the old draft after a date change has passed the app's navigation guard.
  useEffect(() => { setEdit({ date, fields: {} }); }, [date]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSavingDate(date);
    setSaveError(undefined);
    try {
      const fields: Partial<Entry> = { ...patch };
      if (patch.workoutDone === false || patch.workoutDone === null) {
        fields.muscles = {};
        fields.workoutRating = null;
      }
      if (patch.guitarDone === false || patch.guitarDone === null) {
        fields.guitarMinutes = null;
        fields.guitarNote = "";
      }
      const saved = await api<Entry>(`/entries/${date}`, { method: "PATCH", body: JSON.stringify(fields) });
      setEdit({ date, fields: {} });
      onSaved(saved);
    } catch (error) {
      setSaveError({ date, message: (error as Error).message });
    } finally {
      setSavingDate(null);
    }
  }

  const minute = (value: string) => value === "" ? null : Number(value);
  const dayLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="priorities" id="priorities-top">
      <header className="priority-heading">
        <div>
          <p className="priority-kicker"><Pyramid size={16} /> Your daily routine</p>
          <h1>Daily Priorities</h1>
          <p>Study first, gym second, guitar third. Log what you did and watch your pyramid light up.</p>
        </div>
        <div className="priority-date">
          <span>{date === today ? "Today" : dayLabel}</span>
          <div className="priority-date-input">
            <button type="button" className="icon-button" aria-label="Previous priority day" onClick={() => selectDate(shiftDate(date, -1))} disabled={saving || date <= settings.startDate}>
              <ChevronLeft size={18} />
            </button>
            <label>
              <CalendarDays size={15} aria-hidden="true" />
              <input aria-label="Priority date" type="date" min={settings.startDate} max={today} value={date} disabled={saving} onChange={(event) => selectDate(event.target.value)} />
            </label>
            <button type="button" className="icon-button" aria-label="Next priority day" onClick={() => selectDate(shiftDate(date, 1))} disabled={saving || date >= today}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </header>
      <div className="priority-layout">
        <aside className="priority-stage" aria-label="Priority pyramid">
          <div className="priority-stage-top">
            <span>{sceneReady && !paused && chapter > 0 ? priorities[chapter - 1].title : "Your pyramid"}</span>
            <strong aria-live="polite">{completed} of 3 done</strong>
          </div>
          <div className="priority-visual">
            <div className="priority-static" aria-hidden="true" hidden={sceneReady && !staticView}>
              <div className="priority-static-core">
                {priorities.map(({ id }, i) => <i key={id} className={`priority-${id}`} data-lit={lit[i]} />)}
              </div>
            </div>
            {!staticView && (
              <Suspense fallback={null}>
                <PriorityScene lit={lit} paused={paused} onReady={setSceneReady} onChapter={setChapter} />
              </Suspense>
            )}
          </div>
          <nav className="priority-tier-nav" aria-label="Jump to a priority">
            {priorities.map(({ id, title }, i) => (
              <button key={id} type="button" className={`priority-${id}`} data-state={states[i].state} aria-current={sceneReady && !paused && chapter === i + 1 ? "location" : undefined} onClick={() => {
                document.getElementById(`priority-title-${id}`)?.focus({ preventScroll: true });
                document.getElementById(`priority-${id}`)?.scrollIntoView({ block: "start" });
              }}>
                <span><i />{i + 1}. {title}</span><small>{states[i].label}</small>
              </button>
            ))}
          </nav>
          <div className="priority-view-controls">
            {sceneReady && <button type="button" onClick={() => setPaused(!paused)}>{paused ? <Play size={13} /> : <Pause size={13} />}{paused ? "Resume motion" : "Pause motion"}</button>}
            <button type="button" onClick={() => { setSceneReady(false); setStaticView(!staticView); }}>{staticView ? "Show 3D" : "Static view"}</button>
          </div>
        </aside>
        <form className="priority-form" onSubmit={save}>
          {priorities.map(({ id, title, icon: Icon, section }, i) => (
            <section key={id} id={`priority-${id}`} className={`priority-card priority-${id}`} aria-labelledby={`priority-title-${id}`}>
              <header>
                <div className="priority-icon"><Icon size={21} /></div>
                <div><span>Priority {i + 1}</span><h2 id={`priority-title-${id}`} tabIndex={-1}>{title}</h2></div>
                <span className="priority-status" data-state={states[i].state}>{states[i].label}</span>
              </header>
              <fieldset disabled={saving}>
                {id === "study" && (
                  <>
                    <label className="field">Study minutes
                      <input type="number" min={0} max={1440} value={draft.studyMinutes ?? ""} placeholder="0 for a day off" onChange={(event) => change("studyMinutes", minute(event.target.value))} />
                      <small>Daily goal: {settings.studyGoal} min</small>
                    </label>
                    <label className="field"><span>Study topic <small>(optional)</small></span>
                      <input type="text" maxLength={4000} value={draft.studyNote} onChange={(event) => change("studyNote", event.target.value)} />
                    </label>
                  </>
                )}
                {id === "gym" && (
                  <>
                    <p>Did you train?</p>
                    <Toggle label="Gym session" value={draft.workoutDone} onChange={(value) => change("workoutDone", value)} />
                    {patch.workoutDone !== undefined && draft.workoutDone !== true &&
                      (entry.workoutRating !== null || Object.keys(entry.muscles).length > 0) &&
                      <small>Saving this will clear the workout ratings for this day.</small>}
                  </>
                )}
                {id === "guitar" && (
                  <>
                    <p>Did you practice?</p>
                    <Toggle label="Guitar practice" value={draft.guitarDone} onChange={(value) => change("guitarDone", value)} />
                    {patch.guitarDone !== undefined && draft.guitarDone !== true &&
                      (entry.guitarMinutes !== null || entry.guitarNote) &&
                      <small>Saving this will clear the practice time and notes for this day.</small>}
                    {draft.guitarDone === true && (
                      <label className="field"><span>Practice minutes <small>(optional)</small></span>
                        <input type="number" min={0} max={1440} value={draft.guitarMinutes ?? ""} onChange={(event) => change("guitarMinutes", minute(event.target.value))} />
                        <small>Daily goal: {settings.guitarGoal} min</small>
                      </label>
                    )}
                  </>
                )}
              </fieldset>
              <button type="button" className="text-button" disabled={saving} onClick={() => onDetails(section)}>
                {id === "gym" ? "Add workout ratings" : `Open ${title.toLowerCase()} check-in`} <ArrowUpRight size={14} />
              </button>
            </section>
          ))}
          <div className="priority-save">
            <div>
              <strong>Daily log</strong>
              <small>{dirty ? "Unsaved changes" : "Synced with check-in"}</small>
            </div>
            <button type="submit" className="button primary" disabled={saving || !dirty}>
              {saving ? <LoaderCircle className="spin" size={15} /> : <Check size={16} />} Save priorities
            </button>
            {saveError?.date === date && <p role="alert">{saveError.message}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}
