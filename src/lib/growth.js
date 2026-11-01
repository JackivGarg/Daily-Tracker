import { shiftDate } from './metrics.js';

/** Visual game rules, not health advice or an assessment of the user's day. */
export const GROWTH_RULES = Object.freeze({
  minimumStreak: 3,
  branchEvery: 3,
  maximumBranches: 12,
  dryGraceDays: 3,
  dryLoss: 12,
  joyRecovery: 28,
  initialVitality: 55,
  minimumVitality: 15,
  stages: Object.freeze([
    Object.freeze({ name: 'Seed', points: 0 }),
    Object.freeze({ name: 'Sprout', points: 1 }),
    Object.freeze({ name: 'Sapling', points: 6 }),
    Object.freeze({ name: 'Young tree', points: 20 }),
    Object.freeze({ name: 'Full-grown tree', points: 45 }),
  ]),
});

function validDate(date) {
  try { return shiftDate(date, 0) === date; } catch { return false; }
}

function hasData(entry) {
  // A saved empty form is not progress. Explicit false and zero are records.
  return Object.entries(entry).some(([key, value]) => {
    if (key === 'date' || key === 'updatedAt' || value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
}

function orderedHistory(entries, today, startDate) {
  if (!validDate(today) || !validDate(startDate)) throw new RangeError('Growth dates must be valid YYYY-MM-DD calendar days.');
  const map = new Map();
  for (const entry of entries ?? []) {
    if (!entry || !validDate(entry.date) || entry.date < startDate || entry.date > today) continue;
    const previous = map.get(entry.date);
    if (!previous || String(entry.updatedAt ?? '') >= String(previous.updatedAt ?? '')) map.set(entry.date, entry);
  }
  return [...map.values()].filter(hasData).sort((a, b) => a.date.localeCompare(b.date));
}

function accumulator() {
  return {
    points: 0, greenRun: 0, workoutRun: 0, greenDisplay: 0, workoutDisplay: 0,
    greenDays: 0, redDays: 0, workoutDays: 0, joyDays: 0,
    vitality: GROWTH_RULES.initialVitality, dryDays: 0,
    recordedDays: 0, lastDate: null, latestStatus: null,
  };
}

function accumulate(state, entry) {
  const rules = GROWTH_RULES;
  const adjacent = state.lastDate === shiftDate(entry.date, -1);
  const previousGreenRun = adjacent ? state.greenRun : 0;
  const previousWorkoutRun = adjacent ? state.workoutRun : 0;
  state.greenRun = entry.status === 'green' ? previousGreenRun + 1 : 0;
  state.workoutRun = entry.workoutDone === true ? previousWorkoutRun + 1 : 0;
  // An unknown value on the snapshot date can display yesterday's streak,
  // but that unknown day never extends it into the following date.
  state.greenDisplay = entry.status == null ? previousGreenRun : state.greenRun;
  state.workoutDisplay = entry.workoutDone == null ? previousWorkoutRun : state.workoutRun;
  if (entry.status === 'green') {
    state.greenDays++;
    if (state.greenRun >= rules.minimumStreak) state.points++;
  } else if (entry.status === 'red') state.redDays++;
  if (entry.workoutDone === true) state.workoutDays++;
  if (entry.guitarDone === true || entry.sportsDone === true || entry.travelDone === true) {
    state.joyDays++;
    state.vitality = Math.min(100, state.vitality + rules.joyRecovery);
    state.dryDays = 0;
  } else if (entry.guitarDone === false && entry.sportsDone === false && entry.travelDone === false) {
    state.dryDays++;
    if (state.dryDays > rules.dryGraceDays) state.vitality = Math.max(rules.minimumVitality, state.vitality - rules.dryLoss);
  }
  // Partial/legacy activity logs are unknown. They neither dry nor replenish.
  state.lastDate = entry.date;
  state.latestStatus = entry.status ?? null;
  state.recordedDays++;
}

function snapshot(state, today) {
  const rules = GROWTH_RULES;
  const { points, greenDays, redDays, workoutDays, vitality, dryDays, joyDays, recordedDays, latestStatus } = state;
  const isToday = state.lastDate === today;
  const isYesterday = state.lastDate === shiftDate(today, -1);
  const greenStreak = isToday ? state.greenDisplay : isYesterday ? state.greenRun : 0;
  const workoutStreak = isToday ? state.workoutDisplay : isYesterday ? state.workoutRun : 0;
  let stageIndex = 0;
  for (let i = 1; i < rules.stages.length; i++) if (points >= rules.stages[i].points) stageIndex = i;
  const stage = rules.stages[stageIndex];
  const next = rules.stages[stageIndex + 1];
  return {
    date: today,
    points,
    greenStreak,
    qualifyingGreenDays: points,
    greenDays,
    redDays,
    workoutDays,
    workoutStreak,
    branches: Math.min(rules.maximumBranches, Math.floor(workoutDays / rules.branchEvery)),
    branchProgress: workoutDays >= rules.maximumBranches * rules.branchEvery ? 1 : (workoutDays % rules.branchEvery) / rules.branchEvery,
    vitality,
    dryDays,
    joyDays,
    stage: stage.name,
    stageIndex,
    stageProgress: next ? Math.min(1, (points - stage.points) / (next.points - stage.points)) : 1,
    nextStageAt: next?.points ?? null,
    growthActive: greenStreak >= rules.minimumStreak,
    daysToUnlock: Math.max(0, rules.minimumStreak - greenStreak),
    recordedDays,
    latestStatus,
    hasRecords: recordedDays > 0,
  };
}

/** Recomputed from saved history: no counters to drift or repeated-save rewards. */
export function computeGrowth(entries, today, startDate = '2026-11-01') {
  const state = accumulator();
  for (const entry of orderedHistory(entries, today, startDate)) accumulate(state, entry);
  return snapshot(state, today);
}

/** Snapshots only on recorded dates, plus today; missing days earn no rewards. */
export function growthTimeline(entries, today, startDate = '2026-11-01') {
  const records = orderedHistory(entries, today, startDate);
  const timeline = [];
  const state = accumulator();
  // Accumulate once. Each stored snapshot copies only the small scalar state,
  // so decades of imported history do not repeatedly scan all previous dates.
  for (const entry of records) {
    accumulate(state, entry);
    timeline.push({ date: entry.date, state: snapshot(state, entry.date) });
  }
  if (timeline.at(-1)?.date !== today) timeline.push({ date: today, state: snapshot(state, today) });
  return timeline;
}
