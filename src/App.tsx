import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Dumbbell,
  Flame,
  Guitar,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  Menu,
  Plus,
  Scale,
  Settings2,
  Sparkles,
  Sprout,
  Target,
  Trash2,
  Upload,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Bootstrap, Entry, Settings, Muscle } from "./types";
import { MUSCLES } from "./types";
import { api } from "./lib/api";
import {
  computeSummary,
  dateKey,
  emptyEntry,
  getInsights,
  shiftDate,
  totals,
  weeklyData,
} from "./lib/metrics.js";

const GrowthWorld = lazy(() => import("./components/GrowthWorld"));
const GardenPreview = lazy(() =>
  import("./components/GrowthWorld").then((module) => ({
    default: module.GardenPreview,
  })),
);
type Page =
  "overview" | "checkin" | "insights" | "history" | "journey" | "settings";
const pageNames: Record<Page, string> = {
  overview: "Overview",
  checkin: "Daily check-in",
  insights: "Insights",
  history: "Your history",
  journey: "Growth world",
  settings: "Goals & settings",
};
type CheckInPage = "reflection" | "nutrition" | "training" | "body" | "focus" | "guitar";
const checkInPages: CheckInPage[] = ["reflection", "nutrition", "training", "body", "focus", "guitar"];
const checkInTitles:Record<CheckInPage,string>={reflection:"A few minutes. Just for you.",nutrition:"Fuel your day.",training:"Build a little stronger.",body:"Your body, over time.",focus:"Make room for focus.",guitar:"Find your rhythm."};
const pagePaths: Record<Page, string> = {overview:"/dashboard",checkin:"/check-in",insights:"/insights",history:"/history",journey:"/growth",settings:"/settings"};
function readRoute(){
  const parts=window.location.pathname.split('/').filter(Boolean);
  const page=(Object.entries(pagePaths).find(([,path])=>path===`/${parts[0]}`)?.[0] || 'overview') as Page;
  const section=checkInPages.includes(parts[1] as CheckInPage)?parts[1] as CheckInPage:'reflection';
  const requestedDate=new URLSearchParams(window.location.search).get('date');
  const date=requestedDate&&/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)?requestedDate:dateKey();
  return {page,section,date};
}
function routePath(page:Page,date:string,section:CheckInPage='reflection'){
  return page==='checkin'?`${pagePaths.checkin}/${section}?date=${date}`:pagePaths[page];
}
const formatDay = (
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", options);
const duration = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
    : `${minutes}m`;
const numeric = (value: string) => (value === "" ? null : Number(value));

export default function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>(()=>readRoute().page);
  const [entryDate, setEntryDate] = useState(()=>readRoute().date);
  const [entrySection,setEntrySection]=useState<CheckInPage>(()=>readRoute().section);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [dirty, setDirty] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const maxHistory = useRef(0);
  const load = () =>
    api<Bootstrap>("/bootstrap")
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
    const initial=readRoute();
    window.history.replaceState({index:0},'',routePath(initial.page,initial.date,initial.section));
  }, []);
  useEffect(()=>{
    const onPop=()=>{
      const next=readRoute();
      const sameCheckIn=page==='checkin'&&next.page==='checkin'&&next.date===entryDate;
      if(dirty&&!sameCheckIn&&!window.confirm('Leave this check-in? Your unsaved changes will be lost.')){
        window.history.pushState({index:maxHistory.current},'',routePath(page,entryDate,entrySection));
        return;
      }
      if(!sameCheckIn)setDirty(false);
      setPage(next.page);setEntryDate(next.date);setEntrySection(next.section);setMenuOpen(false);
      window.scrollTo({top:0,behavior:'instant'});
    };
    window.addEventListener('popstate',onPop);
    return()=>window.removeEventListener('popstate',onPop);
  },[dirty,page,entryDate,entrySection]);
  useEffect(()=>{document.title=`${pageNames[page]}${page==='checkin'?` · ${entrySection}`:''} — Momentum`;},[page,entrySection]);
  useEffect(()=>{
    if(data&&(entryDate<data.settings.startDate||entryDate>data.today)){
      setEntryDate(data.today);
      window.history.replaceState(window.history.state,'',routePath(page,data.today,entrySection));
    }
  },[data,entryDate,page,entrySection]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function go(next: Page, date?: string) {
    const nextDate=date||entryDate;
    const sameCheckIn=page==='checkin'&&next==='checkin'&&nextDate===entryDate;
    if (
      dirty && !sameCheckIn &&
      !window.confirm("Leave this check-in? Your unsaved changes will be lost.")
    )
      return;
    if(!sameCheckIn)setDirty(false);
    setPage(next);
    setEntrySection('reflection');
    setMenuOpen(false);
    if (date) setEntryDate(date);
    const index=(window.history.state?.index||0)+1;
    maxHistory.current=index;
    window.history.pushState({index},'',routePath(next,nextDate));
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function showEntrySection(section:CheckInPage){
    setEntrySection(section);
    const index=(window.history.state?.index||0)+1;
    maxHistory.current=index;
    window.history.pushState({index},'',routePath('checkin',entryDate,section));
    window.scrollTo({top:0,behavior:'instant'});
  }
  function updated(entry: Entry) {
    setData((d) =>
      d
        ? {
            ...d,
            entries: [...d.entries.filter((e) => e.date !== entry.date), entry],
          }
        : d,
    );
    setDirty(false);
    setToast("Check-in saved. One more day, recorded.");
  }
  if (!data)
    return (
      <div className="startup">
        <Brand />
        <p>{error || "Getting your day ready…"}</p>
        {error ? (
          <button className="button primary" onClick={() => void load()}>
            Retry connection
          </button>
        ) : (
          <LoaderCircle className="spin" />
        )}
      </div>
    );
  const { settings, entries, today } = data;
  const todayEntry = entries.find((e) => e.date === today) || emptyEntry(today);
  const summary = computeSummary(entries, today);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {menuOpen && (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <Brand />
        <div className="workspace-name">
          <span className="workspace-avatar">J</span>
          <span>
            Personal workspace<small>Make every day count</small>
          </span>
        </div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "overview", icon: LayoutDashboard },
              { id: "checkin", icon: Plus },
              { id: "insights", icon: Activity },
              { id: "history", icon: CalendarDays },
              { id: "journey", icon: Sprout },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id, n.id === "checkin" ? today : undefined)}
              className={`nav-link ${page === n.id ? "active" : ""}`}
              aria-current={page === n.id ? "page" : undefined}
            >
              <n.icon size={18} />
              {pageNames[n.id]}
              {n.id === "journey" && <span className="new-tag">3D</span>}
              {page === n.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="tiny-orbit">
            <Sprout size={22} />
          </div>
          <p>Progress is a practice.</p>
          <span>
            Show up for yourself.
            <br />
            The rest will grow.
          </span>
          <button onClick={() => go("journey")}>
            Explore your growth <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            className={`nav-link ${page === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings2 size={18} />
            Goals & settings
          </button>
          <div className="profile">
            <span className="profile-avatar">
              {settings.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              {settings.name}
              <small>Your personal space</small>
            </span>
            <span className="online-dot" title="Saved on this device" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="icon-button history-back" aria-label="Previous page" disabled={!window.history.state?.index} onClick={()=>window.history.back()}><ChevronLeft size={17}/></button>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{pageNames[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-indicator">
              <span />
              Local & private
            </span>
            <button
              className="icon-button"
              title="About your data"
              aria-label="About your data"
              onClick={() => {
                go("settings");
                setToast(
                  "Your entries are saved in a local SQLite database. Export a backup in settings.",
                );
              }}
            >
              <CircleHelp size={18} />
            </button>
            <span className="profile-avatar small">
              {settings.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="main" ref={mainRef} className={`main-content page-${page}`}>
          {page === "overview" && (
            <Dashboard
              settings={settings}
              entries={entries}
              today={today}
              entry={todayEntry}
              summary={summary}
              checkIn={() => go("checkin", today)}
              editDay={(date) => go("checkin", date)}
              journey={() => go("journey")}
              insights={() => go("insights")}
            />
          )}
          {page === "checkin" && (
            <CheckIn
              key={entryDate}
              date={entryDate}
              entry={
                entries.find((e) => e.date === entryDate) ||
                emptyEntry(entryDate)
              }
              settings={settings}
              today={today}
              onDate={(date) => go("checkin", date)}
              onSaved={updated}
              onDirty={setDirty}
              section={entrySection}
              onSection={showEntrySection}
            />
          )}
          {page === "insights" && (
            <Insights
              entries={entries}
              settings={settings}
              today={today}
              checkIn={() => go("checkin", today)}
            />
          )}
          {page === "history" && (
            <History
              entries={entries}
              today={today}
              settings={settings}
              editDay={(date) => go("checkin", date)}
            />
          )}
          {page === "journey" && (
            <Suspense
              fallback={
                <div className="world-loading">
                  <Sprout />
                  <h1>Your growth, in a new dimension.</h1>
                  <p>Preparing your 3D world…</p>
                </div>
              }
            >
              <GrowthWorld
                entries={entries}
                onCheckIn={() => go("checkin", today)}
              />
            </Suspense>
          )}
          {page === "settings" && (
            <SettingsPage
              settings={settings}
              onSaved={(settings) => {
                setData((d) => (d ? { ...d, settings } : d));
                setToast("Your settings are saved.");
              }}
              onImport={(d) => {
                setData({ ...d, today });
                setToast("Backup imported. Your history is ready.");
              }}
            />
          )}
          {page !== "journey" && (
            <footer className="page-footer">
              <span>
                <Leaf size={13} /> A little progress, every day.
              </span>
              <span>
                Momentum ·{" "}
                {formatDay(today, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </footer>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <svg
          width="23"
          height="24"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 21V8l10 10L24 8v13M4 8l10-4 10 4"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      momentum<span className="brand-period">.</span>
    </div>
  );
}
function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function EmptyChart({
  children = "Your first entry is the start of the story.",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="chart-empty">
      <Activity size={23} />
      <span>{children}</span>
    </div>
  );
}

function Dashboard({
  settings,
  entries,
  today,
  entry,
  summary,
  checkIn,
  editDay,
  journey,
  insights,
}: {
  settings: Settings;
  entries: Entry[];
  today: string;
  entry: Entry;
  summary: ReturnType<typeof computeSummary>;
  checkIn: () => void;
  editDay: (date: string) => void;
  journey: () => void;
  insights: () => void;
}) {
  const [range, setRange] = useState(7);
  const total = totals(entry);
  const days = weeklyData(entries, today, range);
  const calorieDays = days.some((d) => d.calories !== null);
  const thisWeek = entries.filter(
    (e) => e.date >= shiftDate(today, -6) && e.date <= today,
  );
  const weekSummary = computeSummary(thisWeek, today);
  const completed = [
    entry.meals.length > 0,
    entry.workoutDone !== null,
    entry.studyMinutes !== null,
    entry.guitarDone !== null,
    entry.status !== null,
  ].filter(Boolean).length;
  const stats = [
    {
      label: "Calories today",
      value: entry.meals.length ? total.calories.toLocaleString() : "—",
      unit: "kcal",
      icon: Flame,
      detail: `of ${settings.calorieGoal.toLocaleString()} kcal daily goal`,
      color: "lime",
    },
    {
      label: "Focused study",
      value: entry.studyMinutes !== null ? duration(entry.studyMinutes) : "—",
      unit: "",
      icon: BookOpen,
      detail: `${duration(weekSummary.studyMinutes)} recorded this week`,
      color: "blue",
    },
    {
      label: "Workout days",
      value: String(weekSummary.workoutDays).padStart(2, "0"),
      unit: "/ 7",
      icon: Dumbbell,
      detail: "Training sessions this week",
      color: "peach",
    },
    {
      label: "Green day streak",
      value: String(summary.streak).padStart(2, "0"),
      unit: summary.streak === 1 ? "day" : "days",
      icon: Zap,
      detail: summary.streak
        ? "Keep your momentum going"
        : "A new beginning starts today",
      color: "green",
    },
  ];
  return (
    <>
      <PageHeading
        title="Your everyday, in perspective."
        subtitle={`${formatDay(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Let's make room for progress.`}
      >
        <button className="button primary" onClick={checkIn}>
          <Plus size={17} />
          Daily check-in
        </button>
      </PageHeading>
      <section className="welcome-panel">
        <div className="welcome-copy">
          <h2>
            Small steps.
            <br />
            <span>Remarkable growth.</span>
          </h2>
          <p>
            {summary.loggedDays
              ? `Welcome back, ${settings.name}. Every honest check-in builds a clearer picture of you.`
              : `Hey ${settings.name}, your journey starts today. Track what matters. See how far you can go.`}
          </p>
          <button className="text-button" onClick={journey}>
            Step into your growth world <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="garden-preview">
          <Suspense
            fallback={
              <div className="preview-placeholder">
                <Sprout size={42} />
              </div>
            }
          >
            <GardenPreview />
          </Suspense>
          <span className="world-coordinate">
            <span /> YOUR PERSONAL GROWTH WORLD
          </span>
          <button
            className="preview-expand"
            onClick={journey}
            aria-label="Open 3D growth world"
          >
            <ArrowUpRight size={20} />
          </button>
        </div>
      </section>
      <div className="metrics-row">
        {stats.map((s) => (
          <div className="metric" key={s.label}>
            <div className="metric-label">
              {s.label}
              <s.icon size={17} className={`color-${s.color}`} />
            </div>
            <div className="metric-value">
              {s.value}
              <span>{s.unit}</span>
            </div>
            <div className="metric-detail">{s.detail}</div>
          </div>
        ))}
      </div>
      <div className="dashboard-main-grid">
        <ContributionCalendar
          entries={entries}
          today={today}
          settings={settings}
          editDay={editDay}
        />
        <Panel
          title="Today's check-in"
          description="A moment for yourself."
          action={<span className="count-badge">{completed}/5</span>}
          className="daily-agenda"
        >
          <div className="agenda-progress">
            <span style={{ width: `${(completed / 5) * 100}%` }} />
          </div>
          <div className="agenda-items">
            {[
              {
                icon: Utensils,
                title: "Fuel your day",
                detail: entry.meals.length
                  ? `${total.calories.toLocaleString()} kcal · ${total.protein}g protein`
                  : "Log your meals & supplements",
                done: !!entry.meals.length,
                color: "lime",
              },
              {
                icon: Dumbbell,
                title: "Move your body",
                detail:
                  entry.workoutDone === null
                    ? "Training or a well-earned rest"
                    : entry.workoutDone
                      ? "Workout recorded"
                      : "Rest day recorded",
                done: entry.workoutDone !== null,
                color: "peach",
              },
              {
                icon: BookOpen,
                title: "Invest in your mind",
                detail:
                  entry.studyMinutes === null
                    ? "A little focus goes a long way"
                    : `${duration(entry.studyMinutes)} of focused study`,
                done: entry.studyMinutes !== null,
                color: "blue",
              },
              {
                icon: Guitar,
                title: "Find your rhythm",
                detail:
                  entry.guitarDone === null
                    ? "Make time for your guitar"
                    : entry.guitarDone
                      ? `${entry.guitarMinutes ?? 0}m guitar practice`
                      : "Not practiced today",
                done: entry.guitarDone !== null,
                color: "purple",
              },
            ].map((a) => (
              <button className="agenda-item" key={a.title} onClick={checkIn}>
                <span className={`agenda-icon color-${a.color}`}>
                  <a.icon size={17} />
                </span>
                <span className="agenda-text">
                  {a.title}
                  <small>{a.detail}</small>
                </span>
                <span className={`agenda-check ${a.done ? "done" : ""}`}>
                  {a.done && <Check size={12} />}
                </span>
              </button>
            ))}
          </div>
          <button className="button secondary full" onClick={checkIn}>
            {completed ? "Continue your check-in" : "Start your check-in"}
            <ArrowRight size={15} />
          </button>
        </Panel>
      </div>
      <div className="dashboard-chart-grid">
        <Panel
          title="Nutrition overview"
          description="The fuel behind your everyday."
          action={
            <select
              aria-label="Nutrition chart period"
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          }
        >
          <div className="chart-legend">
            <span>
              <i className="legend-square lime" />
              Calories
            </span>
            <span className="legend-muted">
              Daily goal: {settings.calorieGoal.toLocaleString()} kcal
            </span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={days}
                margin={{ left: -25, right: 12, top: 14, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#2a342d"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#99a69b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={30}
                />
                <YAxis
                  tick={{ fill: "#99a69b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[
                    0,
                    Math.max(
                      settings.calorieGoal * 1.2,
                      ...days.map((d) => d.calories ?? 0),
                    ),
                  ]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "#ffffff06" }}
                />
                <ReferenceLine
                  y={settings.calorieGoal}
                  stroke="#6b7b60"
                  strokeDasharray="5 5"
                />
                <Bar
                  name="Calories (kcal)"
                  dataKey="calories"
                  fill="#c0ee82"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
            {!calorieDays && (
              <EmptyChart>
                Log your first meal to see your nutrition trend.
              </EmptyChart>
            )}
          </div>
        </Panel>
        <Coach entries={entries} settings={settings} today={today} />
      </div>
      <div className="bottom-summary">
        <div>
          <span className="status-dot green" />
          <strong>{summary.greenDays}</strong> green days
        </div>
        <div>
          <span className="status-dot red" />
          <strong>{summary.redDays}</strong> red days
        </div>
        <div>
          <Guitar size={17} />
          <strong>{summary.guitarDays}</strong> guitar sessions
        </div>
        <button className="text-button" onClick={insights}>
          See the bigger picture
          <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
const tooltipStyle = {
  background: "#202a22",
  border: "1px solid #38463a",
  borderRadius: 8,
  color: "#eef4e9",
  fontSize: 12,
};

function ContributionCalendar({
  entries,
  today,
  settings,
  editDay,
}: {
  entries: Entry[];
  today: string;
  settings: Settings;
  editDay: (date: string) => void;
}) {
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const first = `${year}-01-01`;
  const start = shiftDate(first, -new Date(`${first}T12:00:00Z`).getUTCDay());
  const end = `${year}-12-31`;
  const count =
    Math.ceil(
      (Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1) / 7,
    ) * 7;
  const dates = Array.from({ length: count }, (_, i) => shiftDate(start, i));
  const months = Array.from({ length: 12 }, (_, i) => ({
    label: formatDay(`${year}-${String(i + 1).padStart(2, "0")}-01`, {
      month: "short",
    }),
    week: Math.floor(
      (Date.parse(`${year}-${String(i + 1).padStart(2, "0")}-01`) -
        Date.parse(start)) /
        86400000 /
        7,
    ),
  }));
  const yearEntries = entries.filter(
    (e) => e.date.startsWith(String(year)) && e.status,
  );
  return (
    <Panel
      title="Your consistency, one day at a time."
      description={`${yearEntries.length} days reflected on in ${year}. Every square is part of your story.`}
      action={
        <div className="year-control">
          <button
            className="icon-button"
            aria-label="Previous year"
            disabled={year <= Number(settings.startDate.slice(0, 4))}
            onClick={() => setYear(year - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          <span>{year}</span>
          <button
            className="icon-button"
            aria-label="Next year"
            disabled={year >= Number(today.slice(0, 4))}
            onClick={() => setYear(year + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      }
      className="calendar-panel"
    >
      <div className="calendar-scroll">
        <div className="calendar-inner">
          <div className="calendar-months">
            {months.map((m) => (
              <span
                key={m.label}
                style={{ gridColumn: `${m.week + 1} / span 3` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="calendar-body">
            <div className="day-labels">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div
              className="contribution-grid"
              style={{ gridTemplateColumns: `repeat(${count / 7},1fr)` }}
            >
              {dates.map((d) => {
                const valid =
                  d >= settings.startDate &&
                  d <= today &&
                  d.startsWith(String(year));
                const status = byDate.get(d)?.status;
                return (
                  <button
                    key={d}
                    className={`day-square ${status || "unlogged"} ${d === today ? "is-today" : ""} ${!valid ? "outside" : ""}`}
                    disabled={!valid}
                    title={`${formatDay(d, { day: "numeric", month: "long", year: "numeric" })}: ${status === "green" ? settings.greenLabel : status === "red" ? settings.redLabel : "Not reflected yet"}`}
                    aria-label={`${formatDay(d, { day: "numeric", month: "long", year: "numeric" })}, ${status ? settings[`${status}Label`] : "unlogged"}${d === today ? ", today" : ""}`}
                    onClick={() => editDay(d)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="calendar-footer">
        <span>
          <span className="today-outline" />
          Click a day to reflect
        </span>
        <div>
          <span>
            <i className="legend-square neutral" />
            Not logged
          </span>
          <span>
            <i className="legend-square green" />
            {settings.greenLabel}
          </span>
          <span>
            <i className="legend-square red" />
            {settings.redLabel}
          </span>
        </div>
      </div>
      <div className="calendar-reflection">
        <Sprout size={15} />
        <span>
          {yearEntries.length
            ? "Your colors, your meaning. Keep showing up."
            : "Your first square is waiting. Today is a good day to begin."}
        </span>
      </div>
    </Panel>
  );
}

function Coach({
  entries,
  settings,
  today,
}: {
  entries: Entry[];
  settings: Settings;
  today: string;
}) {
  const [response, setResponse] = useState<{
    text: string;
    source: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const insights = getInsights(entries, settings, today);
  async function reflect() {
    setBusy(true);
    setError("");
    try {
      setResponse(await api("/coach", { method: "POST", body: "{}" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="A little perspective"
      action={<Sparkles size={17} className="color-lime" />}
      className="coach-panel"
    >
      <div className="coach-orb">
        <Sparkles size={27} />
        <span />
      </div>
      <h3>
        {response
          ? "A note for your journey"
          : insights[0]?.title || "Start where you are."}
      </h3>
      <p>
        {response?.text ||
          insights[0]?.body ||
          "You don’t need a perfect day. Just an honest starting point. Your first check-in is enough."}
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button coach-button"
        onClick={() => void reflect()}
        disabled={busy}
      >
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Sparkles size={15} />
        )}{" "}
        {busy
          ? "Finding perspective…"
          : response
            ? "Refresh my reflection"
            : "Get my personal reflection"}
        <ArrowUpRight size={15} />
      </button>
      <span className="coach-caption">
        {response
          ? response.source === "groq"
            ? "Personal reflection · Groq"
            : "Based on your entries · Local reflection"
          : "A thoughtful nudge, grounded in your entries."}
      </span>
    </Panel>
  );
}

function YesNo({
  value,
  onChange,
  label,
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  label: string;
}) {
  return (
    <div className="yes-no" role="group" aria-label={label}>
      <button
        type="button"
        aria-pressed={value === true}
        className={value === true ? "selected" : ""}
        onClick={() => onChange(value === true ? null : true)}
      >
        <Check size={13} />
        Yes
      </button>
      <button
        type="button"
        aria-pressed={value === false}
        className={value === false ? "selected-no" : ""}
        onClick={() => onChange(value === false ? null : false)}
      >
        <X size={13} />
        No
      </button>
    </div>
  );
}
function Rating({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
}) {
  return (
    <div className="rating" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          aria-label={`${label}: ${n} out of 5`}
          aria-pressed={value === n}
          onClick={() => onChange(n === value ? null : n)}
          className={value !== null && n <= value ? "selected" : ""}
        >
          {n}
        </button>
      ))}
      <span>{value ? `${value}/5` : "Not rated"}</span>
    </div>
  );
}
function CheckIn({
  entry,
  date,
  settings,
  today,
  onDate,
  onSaved,
  onDirty,
  section,
  onSection,
}: {
  entry: Entry;
  date: string;
  settings: Settings;
  today: string;
  onDate: (date: string) => void;
  onSaved: (e: Entry) => void;
  onDirty: (d: boolean) => void;
  section:CheckInPage;
  onSection:(section:CheckInPage)=>void;
}) {
  const [draft, setDraft] = useState<Entry>(() => structuredClone(entry));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProtein, setMealProtein] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const total = totals(draft);
  function update(patch: Partial<Entry>) {
    setDraft((d) => ({ ...d, ...patch }));
    onDirty(true);
    setSaved(false);
  }
  function addMeal(e: FormEvent) {
    e.preventDefault();
    if (!mealName.trim() || mealCalories === "") return;
    update({
      meals: [
        ...draft.meals,
        {
          id: crypto.randomUUID(),
          name: mealName.trim(),
          calories: Number(mealCalories),
          protein: Number(mealProtein || 0),
        },
      ],
    });
    setMealName("");
    setMealCalories("");
    setMealProtein("");
  }
  async function save() {
    if (mealName || mealCalories || mealProtein) {
      setError(
        "You have an unfinished meal. Add it to the list, or clear those meal fields before saving.",
      );
      onSection('nutrition');
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<Entry>(`/entries/${date}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setDraft(result);
      onSaved(result);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function jump(id: string) {onSection(id as CheckInPage);}
  return (
    <>
      <PageHeading
        title={
          date === today
            ? checkInTitles[section]
            : `${checkInTitles[section]} · ${formatDay(date)}`
        }
        subtitle="Log what matters. Leave the rest for another day."
      >
        <label className="date-picker">
          <CalendarDays size={15} />
          <input
            aria-label="Check-in date"
            type="date"
            min={settings.startDate}
            max={today}
            value={date}
            onChange={(e) => {
              if (e.target.value) onDate(e.target.value);
            }}
          />
        </label>
      </PageHeading>
      <div className="checkin-layout">
        <nav className="checkin-nav" aria-label="Check-in sections">
          {[
            { id: "reflection", title: "Your day", icon: Leaf },
            { id: "nutrition", title: "Nutrition", icon: Utensils },
            { id: "training", title: "Training", icon: Dumbbell },
            { id: "body", title: "Body & weight", icon: Scale },
            { id: "focus", title: "Study & focus", icon: BookOpen },
            { id: "guitar", title: "Guitar", icon: Guitar },
          ].map((s) => (
            <button key={s.id} onClick={() => jump(s.id)} aria-current={section===s.id?'page':undefined} className={section===s.id?'active':''}>
              <s.icon size={17} />
              {s.title}
              <ChevronRight size={13} />
            </button>
          ))}
          <div className="checkin-tip">
            <Sprout size={22} />
            <p>An honest entry is more useful than a perfect one.</p>
            <span>
              All fields are optional. Save now and come back any time.
            </span>
          </div>
        </nav>
        <div className="checkin-sections">
          <section
            className="entry-section"
            hidden={section!=='reflection'}
            ref={(el) => {
              sectionRefs.current.reflection = el;
            }}
          >
            <div className="entry-section-title">
              <Leaf size={20} />
              <div>
                <h2>How would you color today?</h2>
                <p>Your colors, your definitions. No automatic judgments.</p>
              </div>
            </div>
            <div className="reflection-options">
              {(["green", "red"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={draft.status === status}
                  className={`reflection-option ${status} ${draft.status === status ? "selected" : ""}`}
                  onClick={() =>
                    update({ status: draft.status === status ? null : status })
                  }
                >
                  <span className={`status-dot ${status}`} />
                  <strong>{settings[`${status}Label`]}</strong>
                  <p>{settings[`${status}Meaning`]}</p>
                  <span className="selection-indicator">
                    {draft.status === status && <Check size={13} />}
                  </span>
                </button>
              ))}
            </div>
            <label className="field">
              A note to your future self{" "}
              <span className="optional">Optional</span>
              <textarea
                value={draft.note}
                maxLength={4000}
                onChange={(e) => update({ note: e.target.value })}
                placeholder="What went well? What would you do differently?"
                rows={3}
              />
            </label>
          </section>
          <section
            className="entry-section"
            hidden={section!=='nutrition'}
            ref={(el) => {
              sectionRefs.current.nutrition = el;
            }}
          >
            <div className="entry-section-title">
              <Utensils size={20} />
              <div>
                <h2>Fuel for your day</h2>
                <p>Record your meals. Small details make a clearer picture.</p>
              </div>
              <span className="section-value">
                {total.calories.toLocaleString()} <small>kcal</small>
              </span>
            </div>
            <div className="nutrition-totals">
              <span>
                Calories{" "}
                <strong>
                  {total.calories.toLocaleString()}
                  <small> / {settings.calorieGoal.toLocaleString()} kcal</small>
                </strong>
              </span>
              <span>
                Protein{" "}
                <strong>
                  {total.protein}
                  <small> / {settings.proteinGoal} g</small>
                </strong>
              </span>
            </div>
            {draft.meals.length > 0 && (
              <div className="meal-list">
                {draft.meals.map((meal) => (
                  <div className="meal-row" key={meal.id}>
                    <span>
                      <Utensils size={14} />
                      {meal.name}
                    </span>
                    <span>
                      {meal.calories} kcal{" "}
                      <small>{meal.protein}g protein</small>
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={`Remove ${meal.name}`}
                        onClick={() =>
                          update({
                            meals: draft.meals.filter((m) => m.id !== meal.id),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <form className="meal-form" onChange={()=>{onDirty(true);setSaved(false);}} onSubmit={addMeal}>
              <label className="field meal-name">
                Meal or food
                <input
                  required
                  value={mealName}
                  maxLength={160}
                  placeholder="e.g. Eggs, toast & coffee"
                  onChange={(e) => setMealName(e.target.value)}
                />
              </label>
              <label className="field">
                Calories (kcal)
                <input
                  required
                  type="number"
                  min="0"
                  max="20000"
                  step="1"
                  value={mealCalories}
                  placeholder="450"
                  onChange={(e) => setMealCalories(e.target.value)}
                />
              </label>
              <label className="field">
                Protein (g)
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  value={mealProtein}
                  placeholder="Optional"
                  onChange={(e) => setMealProtein(e.target.value)}
                />
              </label>
              <button className="button secondary add-meal" type="submit">
                <Plus size={16} />
                Add meal
              </button>
            </form>
            <p className="field-hint">
              Use your food label or your own estimate. Meals are saved with the
              check-in.
            </p>
            <div className="supplement-checks">
              <div>
                <span>
                  <strong>Had your protein today?</strong>
                  <small>Your own daily protein check.</small>
                </span>
                <YesNo
                  label="Had protein today"
                  value={draft.proteinTaken}
                  onChange={(v) => update({ proteinTaken: v })}
                />
              </div>
              <div>
                <span>
                  <strong>Taken your creatine?</strong>
                  <small>A separate check for your routine.</small>
                </span>
                <YesNo
                  label="Taken creatine today"
                  value={draft.creatineTaken}
                  onChange={(v) => update({ creatineTaken: v })}
                />
              </div>
            </div>
          </section>
          <section
            className="entry-section"
            hidden={section!=='training'}
            ref={(el) => {
              sectionRefs.current.training = el;
            }}
          >
            <div className="entry-section-title">
              <Dumbbell size={20} />
              <div>
                <h2>How did you move?</h2>
                <p>Training and recovery both have their place.</p>
              </div>
              <YesNo
                label="Worked out today"
                value={draft.workoutDone}
                onChange={(v) =>
                  update({
                    workoutDone: v,
                    ...(v !== true ? { muscles: {}, workoutRating: null } : {}),
                  })
                }
              />
            </div>
            {draft.workoutDone === true && (
              <div className="workout-details">
                <div className="field">
                  <span>Overall workout rating</span>
                  <Rating
                    label="Overall workout rating"
                    value={draft.workoutRating}
                    onChange={(v) => update({ workoutRating: v })}
                  />
                </div>
                <p className="field-label">
                  Which muscle groups did you train?{" "}
                  <span className="optional">Select & rate each</span>
                </p>
                <div className="muscle-chips">
                  {MUSCLES.map((muscle) => (
                    <button
                      type="button"
                      aria-pressed={muscle in draft.muscles}
                      key={muscle}
                      className={muscle in draft.muscles ? "selected" : ""}
                      onClick={() => {
                        const muscles = { ...draft.muscles };
                        if (muscle in muscles) delete muscles[muscle];
                        else muscles[muscle] = 3;
                        update({ muscles });
                      }}
                    >
                      {muscle in draft.muscles ? (
                        <Check size={13} />
                      ) : (
                        <Plus size={13} />
                      )}{" "}
                      {muscle}
                    </button>
                  ))}
                </div>
                <div className="muscle-ratings">
                  {Object.entries(draft.muscles).map(([muscle, rating]) => (
                    <div key={muscle}>
                      <span>{muscle}</span>
                      <Rating
                        label={`${muscle} rating`}
                        value={rating ?? null}
                        onChange={(v) => {
                          const muscles = { ...draft.muscles };
                          if (v === null) delete muscles[muscle as Muscle];
                          else muscles[muscle as Muscle] = v;
                          update({ muscles });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {draft.workoutDone === false && (
              <p className="rest-note">
                <Leaf size={16} />
                Rest day recorded. Give yourself room to recover.
              </p>
            )}
          </section>
          <section
            className="entry-section"
            hidden={section!=='body'}
            ref={(el) => {
              sectionRefs.current.body = el;
            }}
          >
            <div className="entry-section-title">
              <Scale size={20} />
              <div>
                <h2>A body check-in</h2>
                <p>One measurement is a moment. A trend takes time.</p>
              </div>
            </div>
            <label className="field narrow-field">
              Today's weight (kg)
              <input
                type="number"
                min="20"
                max="500"
                step="0.1"
                value={draft.weight ?? ""}
                placeholder="e.g. 72.5"
                onChange={(e) => update({ weight: numeric(e.target.value) })}
              />
            </label>
          </section>
          <section
            className="entry-section"
            hidden={section!=='focus'}
            ref={(el) => {
              sectionRefs.current.focus = el;
            }}
          >
            <div className="entry-section-title">
              <BookOpen size={20} />
              <div>
                <h2>Make room for focus</h2>
                <p>Learning counts, even on the quieter days.</p>
              </div>
            </div>
            <div className="entry-two-columns">
              <label className="field">
                Study time (minutes)
                <input
                  type="number"
                  min="0"
                  max="1440"
                  step="1"
                  value={draft.studyMinutes ?? ""}
                  placeholder={`Daily goal: ${settings.studyGoal} min`}
                  onChange={(e) =>
                    update({ studyMinutes: numeric(e.target.value) })
                  }
                />
              </label>
              <label className="field">
                What did you work on?
                <input
                  maxLength={4000}
                  value={draft.studyNote}
                  placeholder="A chapter, a concept, a breakthrough…"
                  onChange={(e) => update({ studyNote: e.target.value })}
                />
              </label>
            </div>
          </section>
          <section
            className="entry-section"
            hidden={section!=='guitar'}
            ref={(el) => {
              sectionRefs.current.guitar = el;
            }}
          >
            <div className="entry-section-title">
              <Guitar size={20} />
              <div>
                <h2>Find your rhythm</h2>
                <p>Did you spend some time with your guitar?</p>
              </div>
              <YesNo
                label="Played guitar today"
                value={draft.guitarDone}
                onChange={(v) =>
                  update({
                    guitarDone: v,
                    ...(v !== true
                      ? { guitarMinutes: null, guitarNote: "" }
                      : {}),
                  })
                }
              />
            </div>
            {draft.guitarDone === true && (
              <div className="entry-two-columns">
                <label className="field">
                  Practice time (minutes)
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    step="1"
                    value={draft.guitarMinutes ?? ""}
                    placeholder={`Daily goal: ${settings.guitarGoal} min`}
                    onChange={(e) =>
                      update({ guitarMinutes: numeric(e.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  What did you practice?
                  <input
                    maxLength={4000}
                    value={draft.guitarNote}
                    placeholder="Chords, a song, scales…"
                    onChange={(e) => update({ guitarNote: e.target.value })}
                  />
                </label>
              </div>
            )}
          </section>
          <div className="checkin-page-navigation">
            <span>{checkInPages.indexOf(section)+1} of {checkInPages.length} · Your daily check-in</span>
            <div><button className="button subtle" disabled={section==='reflection'} onClick={()=>onSection(checkInPages[checkInPages.indexOf(section)-1])}><ChevronLeft size={15}/>Previous</button><button className="button secondary" disabled={section==='guitar'} onClick={()=>onSection(checkInPages[checkInPages.indexOf(section)+1])}>Next page<ChevronRight size={15}/></button></div>
          </div>
          <div className="save-bar">
            <div>
              {error ? (
                <p className="field-error" role="alert">
                  {error}
                </p>
              ) : saved ? (
                <span className="save-success">
                  <Check size={16} />
                  Saved to your personal history
                </span>
              ) : (
                <span>Ready when you are. You can edit this later.</span>
              )}
            </div>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Check size={16} />
              )}{" "}
              {busy ? "Saving your day…" : "Save check-in"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Insights({
  entries,
  settings,
  today,
  checkIn,
}: {
  entries: Entry[];
  settings: Settings;
  today: string;
  checkIn: () => void;
}) {
  const [range, setRange] = useState(30);
  const filtered = entries.filter(
    (e) => e.date >= shiftDate(today, -range + 1) && e.date <= today,
  );
  const summary = computeSummary(filtered, today);
  const days = weeklyData(entries, today, range);
  const insights = getInsights(filtered, settings, today);
  const muscles = MUSCLES.map((name) => {
    const ratings = filtered
      .filter((e) => e.workoutDone && e.muscles[name] !== undefined)
      .map((e) => e.muscles[name]!);
    return {
      name,
      sessions: ratings.length,
      average: ratings.length
        ? Number(
            (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
          )
        : null,
    };
  });
  const weights = days.filter((d) => d.weight !== null);
  return (
    <>
      <PageHeading
        title="See the bigger picture."
        subtitle="Patterns from your actual entries. Progress at your own pace."
      >
        <select
          aria-label="Insights period"
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <button className="button primary" onClick={checkIn}>
          <Plus size={16} />
          Check in
        </button>
      </PageHeading>
      <div className="insight-summary">
        <div>
          <span>Days recorded</span>
          <strong>
            {summary.loggedDays}
            <small> / {range}</small>
          </strong>
        </div>
        <div>
          <span>Training sessions</span>
          <strong>{summary.workoutDays}</strong>
        </div>
        <div>
          <span>Focused learning</span>
          <strong>{duration(summary.studyMinutes)}</strong>
        </div>
        <div>
          <span>Guitar sessions</span>
          <strong>{summary.guitarDays}</strong>
        </div>
      </div>
      <div className="insight-notes">
        {insights.slice(0, 3).map((insight, i) => (
          <div key={i}>
            <span className={`insight-symbol ${insight.tone}`}>
              <Sprout size={18} />
            </span>
            <h2>{insight.title}</h2>
            <p>{insight.body}</p>
          </div>
        ))}
      </div>
      <div className="two-column">
        <Panel
          title="Focus & practice"
          description="Time invested in the things you care about."
        >
          <div className="chart-legend">
            <span>
              <i className="legend-square blue" />
              Study minutes
            </span>
            <span>
              <i className="legend-square purple" />
              Guitar minutes
            </span>
          </div>
          <div className="chart-wrap tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ left: -22, top: 15, right: 10 }}>
                <CartesianGrid
                  stroke="#2a342d"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="label"
                  minTickGap={32}
                  tick={{ fill: "#99a69b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#99a69b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="studyMinutes"
                  name="Study (min)"
                  fill="#8abadd"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={15}
                />
                <Bar
                  dataKey="guitarMinutes"
                  name="Guitar (min)"
                  fill="#bdabdc"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={15}
                />
              </BarChart>
            </ResponsiveContainer>
            {!days.some(
              (d) => d.studyMinutes !== null || d.guitarMinutes !== null,
            ) && (
              <EmptyChart>
                Your study and guitar sessions will show up here.
              </EmptyChart>
            )}
          </div>
        </Panel>
        <Panel
          title="Weight over time"
          description="A longer view, without the daily noise."
          action={<span className="unit-badge">kg</span>}
        >
          <div className="chart-wrap tall">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={weights}
                margin={{ left: -22, top: 20, right: 20 }}
              >
                <defs>
                  <linearGradient id="weight-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#c0ee82" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#c0ee82" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#2a342d"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#99a69b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tick={{ fill: "#99a69b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  dataKey="weight"
                  name="Weight (kg)"
                  type="monotone"
                  stroke="#c0ee82"
                  strokeWidth={2}
                  fill="url(#weight-fill)"
                  dot={{ r: 4, fill: "#c0ee82", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            {!weights.length && (
              <EmptyChart>
                Your first weigh-in is your starting point.
              </EmptyChart>
            )}
          </div>
          <div className="weight-caption">
            {summary.weightChange === null
              ? "Record at least two weigh-ins to see your change."
              : `${summary.weightChange > 0 ? "+" : ""}${summary.weightChange.toFixed(1)} kg change across recorded weigh-ins.`}
          </div>
        </Panel>
      </div>
      <div className="two-column bottom-gap">
        <Panel
          title="Training balance"
          description="Sessions and average rating for each muscle group."
        >
          <div className="muscle-summary">
            {muscles.map((m) => (
              <div key={m.name}>
                <span>{m.name}</span>
                <div className="muscle-bar">
                  <span
                    style={{
                      width: `${(m.sessions / Math.max(1, ...muscles.map((g) => g.sessions))) * 100}%`,
                    }}
                  />
                </div>
                <strong>
                  {m.sessions}
                  <small>sessions</small>
                </strong>
                <span className="muscle-average">
                  {m.average ? `${m.average}/5` : "—"}
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Daily essentials"
          description={`A record of your routines over the last ${range} days.`}
        >
          <div className="essentials">
            {[
              {
                label: "Protein checked",
                value: filtered.filter((e) => e.proteinTaken === true).length,
                icon: Utensils,
                color: "lime",
              },
              {
                label: "Creatine checked",
                value: filtered.filter((e) => e.creatineTaken === true).length,
                icon: Zap,
                color: "blue",
              },
              {
                label: settings.greenLabel,
                value: summary.greenDays,
                icon: Leaf,
                color: "green",
              },
              {
                label: settings.redLabel,
                value: summary.redDays,
                icon: Target,
                color: "peach",
              },
            ].map((e) => (
              <div key={e.label}>
                <e.icon size={18} className={`color-${e.color}`} />
                <span>{e.label}</span>
                <strong>
                  {e.value}
                  <small>days</small>
                </strong>
              </div>
            ))}
          </div>
          <p className="field-hint">
            Unlogged days stay unlogged. Your colors always follow your own
            definitions.
          </p>
        </Panel>
      </div>
    </>
  );
}

function History({
  entries,
  today,
  settings,
  editDay,
}: {
  entries: Entry[];
  today: string;
  settings: Settings;
  editDay: (date: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            (filter === "all" || e.status === filter) &&
            `${e.date} ${e.note} ${e.studyNote} ${formatDay(e.date, { day: "numeric", month: "long", year: "numeric" })}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries, filter, query],
  );
  return (
    <>
      <PageHeading
        title="Every day has a story."
        subtitle="Revisit your entries, notice a pattern, or pick up where you left off."
      >
        <button className="button primary" onClick={() => editDay(today)}>
          <Plus size={16} />
          Today's check-in
        </button>
      </PageHeading>
      <ContributionCalendar
        entries={entries}
        today={today}
        settings={settings}
        editDay={editDay}
      />
      <section className="panel history-panel">
        <div className="history-toolbar">
          <div className="segmented" aria-label="Filter days">
            {[
              { value: "all", label: "All days" },
              { value: "green", label: settings.greenLabel },
              { value: "red", label: settings.redLabel },
            ].map((f) => (
              <button
                key={f.value}
                aria-pressed={filter === f.value}
                className={filter === f.value ? "selected" : ""}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            aria-label="Search history"
            placeholder="Search dates or notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Your day</th>
                  <th>Calories</th>
                  <th>Workout</th>
                  <th>Study</th>
                  <th>Guitar</th>
                  <th>Weight</th>
                  <th>
                    <span className="sr-only">Edit entry</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.date}>
                    <td>
                      <strong>
                        {formatDay(entry.date, {
                          day: "numeric",
                          month: "short",
                        })}
                      </strong>
                      <small>
                        {formatDay(entry.date, { weekday: "long" })}
                      </small>
                    </td>
                    <td>
                      {entry.status ? (
                        <span className={`status-badge ${entry.status}`}>
                          <span />
                          {settings[`${entry.status}Label`]}
                        </span>
                      ) : (
                        <span className="muted">Unmarked</span>
                      )}
                    </td>
                    <td>
                      {entry.meals.length
                        ? `${totals(entry).calories.toLocaleString()} kcal`
                        : "—"}
                    </td>
                    <td>
                      {entry.workoutDone === null
                        ? "—"
                        : entry.workoutDone
                          ? `${Object.keys(entry.muscles).length} groups`
                          : "Rest day"}
                    </td>
                    <td>
                      {entry.studyMinutes === null
                        ? "—"
                        : duration(entry.studyMinutes)}
                    </td>
                    <td>
                      {entry.guitarDone === null
                        ? "—"
                        : entry.guitarDone
                          ? "Practiced"
                          : "Not today"}
                    </td>
                    <td>
                      {entry.weight === null ? "—" : `${entry.weight} kg`}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${entry.date}`}
                        onClick={() => editDay(entry.date)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <CalendarDays size={30} />
            <h2>
              {entries.length
                ? "No days match this view."
                : "A fresh page, just for you."}
            </h2>
            <p>
              {entries.length
                ? "Try another filter or search."
                : "Your first check-in will live here. Let today be the beginning."}
            </p>
            <button
              className="button secondary"
              onClick={() =>
                entries.length
                  ? (setQuery(""), setFilter("all"))
                  : editDay(today)
              }
            >
              {entries.length ? "Clear filters" : "Record today"}
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function SettingsPage({
  settings,
  onSaved,
  onImport,
}: {
  settings: Settings;
  onSaved: (s: Settings) => void;
  onImport: (d: Bootstrap) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSaved(
        await api("/settings", {
          method: "PATCH",
          body: JSON.stringify(draft),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setImportBusy(true);
    setError("");
    try {
      if (file.size > 1000000)
        throw new Error("Choose a JSON backup smaller than 1 MB.");
      const backup = JSON.parse(await file.text());
      const result = await api<Bootstrap>("/import", {
        method: "POST",
        body: JSON.stringify(backup),
      });
      onImport(result);
      setDraft(result.settings);
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "That file is not valid JSON. Choose a Momentum backup."
          : (e as Error).message,
      );
    } finally {
      setImportBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  return (
    <>
      <PageHeading
        title="Make this space yours."
        subtitle="Your goals. Your definitions. Your pace."
      />
      <div className="settings-layout">
        <form className="settings-form" onSubmit={(e) => void save(e)}>
          <section className="entry-section">
            <div className="entry-section-title">
              <Settings2 size={20} />
              <div>
                <h2>Your personal space</h2>
                <p>A few details that make it feel like you.</p>
              </div>
            </div>
            <label className="field narrow-field">
              Your name
              <input
                required
                value={draft.name}
                maxLength={60}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <p className="field-hint">
              Tracking from{" "}
              {formatDay(settings.startDate, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · Timezone: Asia/Kolkata
            </p>
          </section>
          <section className="entry-section">
            <div className="entry-section-title">
              <Target size={20} />
              <div>
                <h2>Your daily goals</h2>
                <p>Set your own targets. Adjust them as life changes.</p>
              </div>
            </div>
            <div className="settings-goals">
              {[
                {
                  key: "calorieGoal",
                  label: "Calories",
                  unit: "kcal",
                  max: 10000,
                },
                {
                  key: "proteinGoal",
                  label: "Protein",
                  unit: "grams",
                  max: 1000,
                },
                {
                  key: "studyGoal",
                  label: "Study",
                  unit: "minutes",
                  max: 1440,
                },
                {
                  key: "guitarGoal",
                  label: "Guitar",
                  unit: "minutes",
                  max: 1440,
                },
              ].map((g) => (
                <label className="field" key={g.key}>
                  {g.label} ({g.unit})
                  <input
                    required
                    type="number"
                    step="1"
                    min="1"
                    max={g.max}
                    value={draft[g.key as keyof Settings]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [g.key]:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="field-hint">
              Starting goals are placeholders for you to personalize.
            </p>
          </section>
          <section className="entry-section">
            <div className="entry-section-title">
              <Leaf size={20} />
              <div>
                <h2>Give your colors meaning</h2>
                <p>Your day is never graded by an algorithm.</p>
              </div>
            </div>
            {(["green", "red"] as const).map((color) => (
              <div className="color-settings" key={color}>
                <span className={`status-dot ${color}`} />
                <div>
                  <label className="field">
                    {color === "green" ? "Green" : "Red"} day label
                    <input
                      required
                      value={draft[`${color}Label`]}
                      maxLength={40}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [`${color}Label`]: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    What does this mean to you?
                    <textarea
                      required
                      rows={2}
                      maxLength={500}
                      value={draft[`${color}Meaning`]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [`${color}Meaning`]: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </section>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}
            Save my settings
          </button>
        </form>
        <aside className="settings-aside">
          <Panel
            title="Your data stays with you"
            action={<Leaf size={18} className="color-lime" />}
          >
            <p>
              Your entries live in a SQLite database on this computer. No
              account or cloud database needed.
            </p>
            <p>Save a backup regularly so your progress can come with you.</p>
            <a className="button secondary full" href="/api/export" download>
              <ArrowDownToLine size={16} />
              Export JSON backup
            </a>
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Import JSON backup"
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
            <button
              className="button subtle full"
              onClick={() => inputRef.current?.click()}
              disabled={importBusy}
            >
              {importBusy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Upload size={16} />
              )}
              Import a backup
            </button>
            <p className="field-hint">
              Imports merge with your history. Matching dates are replaced by
              the backup's entries.
            </p>
          </Panel>
          <div className="privacy-note">
            <Sparkles size={19} />
            <h3>A thoughtful use of AI</h3>
            <p>
              Personal reflections use Groq when available. Only recent activity
              totals are sent when you request a reflection. Your notes, meal
              names, and API key stay on the server.
            </p>
            <span>A local reflection is available when AI is offline.</span>
          </div>
        </aside>
      </div>
    </>
  );
}
