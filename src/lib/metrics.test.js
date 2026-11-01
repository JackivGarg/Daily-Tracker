import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, shiftDate, emptyEntry, totals, getStreak, weeklyData, computeSummary, getInsights } from './metrics.js';

const entry = (date, values = {}) => ({ ...emptyEntry(date), ...values });
const meal = { id: 'm1', name: 'Dal and rice', calories: 500, protein: 20 };
const settings = { studyGoal: 120, greenLabel: 'My green day' };

test('calendar days use Asia/Kolkata at the UTC boundary', () => {
  assert.equal(dateKey(new Date('2026-10-31T18:29:59Z')), '2026-10-31');
  assert.equal(dateKey(new Date('2026-10-31T18:30:00Z')), '2026-11-01');
});

test('date shifts cross leap days, months, and years without timezone drift', () => {
  assert.equal(shiftDate('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftDate('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDate('2026-11-01', -1), '2026-10-31');
  assert.throws(() => shiftDate('2026-02-29', 1), RangeError);
  assert.throws(() => shiftDate('2026-11-01', 1.5), RangeError);
});

test('missing weekly measurements remain null while explicit zero and false stay recorded', () => {
  const days = weeklyData([entry('2026-11-01', { studyMinutes: 0, workoutDone: false, guitarDone: false })], '2026-11-01');
  assert.equal(days.length, 7);
  assert.equal(days[0].date, '2026-10-26');
  assert.equal(days[0].calories, null);
  assert.equal(days[0].protein, null);
  assert.equal(days[0].weight, null);
  assert.equal(days[0].workout, null);
  assert.equal(days[6].studyMinutes, 0);
  assert.equal(days[6].workout, false);
  assert.equal(days[6].guitarMinutes, null);
  assert.equal(days[6].hasMeals, false);
  assert.throws(() => weeklyData([], '2026-11-01', 0), RangeError);
});

test('green streak permits an unmarked today but explicit red stops it', () => {
  const past = [entry('2026-10-30', { status: 'green' }), entry('2026-10-31', { status: 'green' })];
  assert.equal(getStreak(past, '2026-11-01'), 2);
  assert.equal(getStreak([...past, entry('2026-11-01', { studyMinutes: 30 })], '2026-11-01'), 2);
  assert.equal(getStreak([...past, entry('2026-11-01', { status: 'green' })], '2026-11-01'), 3);
  assert.equal(getStreak([...past, entry('2026-11-01', { status: 'red' })], '2026-11-01'), 0);
  assert.equal(getStreak([past[0]], '2026-11-01'), 0);
});

test('summary sorts historical weights, excludes future and empty drafts, averages only meal days', () => {
  const entries = [
    entry('2026-11-01', { weight: 74.2, workoutDone: true, meals: [meal] }),
    entry('2026-10-30', { weight: 75, meals: [{ ...meal, calories: 700 }], guitarDone: true }),
    entry('2026-10-31', { studyMinutes: 60 }),
    entry('2026-10-29'),
    entry('2026-11-02', { weight: 100, status: 'green', meals: [meal] }),
  ];
  const summary = computeSummary(entries, '2026-11-01');
  assert.equal(summary.loggedDays, 3);
  assert.equal(summary.averageCalories, 600);
  assert.equal(summary.weightChange, -0.8);
  assert.equal(summary.workoutDays, 1);
  assert.equal(summary.guitarDays, 1);
  assert.equal(summary.studyMinutes, 60);
  assert.equal(summary.greenDays, 0);
});

test('empty state and one weigh-in never invent averages or weight changes', () => {
  const empty = computeSummary([], '2026-11-01');
  assert.equal(empty.averageCalories, null);
  assert.equal(empty.weightChange, null);
  assert.equal(empty.loggedDays, 0);
  assert.equal(computeSummary([entry('2026-11-01', { weight: 74 })], '2026-11-01').weightChange, null);
  assert.deepEqual(totals(), { calories: 0, protein: 0 });
  assert.deepEqual(totals(entry('2026-11-01', { meals: [meal, meal] })), { calories: 1000, protein: 40 });
});

test('duplicate imported dates use the latest update and do not count twice', () => {
  const entries = [
    entry('2026-11-01', { status: 'red', updatedAt: '2026-11-01T01:00:00Z' }),
    entry('2026-11-01', { status: 'green', updatedAt: '2026-11-01T02:00:00Z' }),
  ];
  assert.equal(computeSummary(entries, '2026-11-01').loggedDays, 1);
  assert.equal(getStreak(entries, '2026-11-01'), 1);
});

test('insights use only actual logs and describe partial nutrition honestly', () => {
  assert.match(getInsights([], settings, '2026-11-01')[0].title, /first entry/);
  const insights = getInsights([
    entry('2026-11-01', { meals: [meal], studyMinutes: 0 }),
    entry('2026-10-31', { studyMinutes: 120 }),
  ], settings, '2026-11-01');
  const study = insights.find(item => item.title.includes('study'));
  assert.match(study.body, /1 of 2 logged days met/);
  const nutrition = insights.find(item => item.title.includes('kcal'));
  assert.match(nutrition.body, /Partial meal logs/);
  assert.equal(insights.some(item => item.title.includes('workout')), false);
});

test('new activity checks start unknown and explicit activity-only check-ins count as recorded', () => {
  const empty = emptyEntry('2026-11-01');
  assert.equal(empty.sportsDone, null);
  assert.equal(empty.travelDone, null);
  assert.equal(computeSummary([empty], '2026-11-01').loggedDays, 0);
  assert.equal(computeSummary([{ ...empty, sportsDone: false }], '2026-11-01').loggedDays, 1);
  assert.equal(computeSummary([{ ...empty, travelDone: true }], '2026-11-01').loggedDays, 1);
  const legacy = { ...empty };
  delete legacy.sportsDone;
  delete legacy.travelDone;
  assert.equal(computeSummary([legacy], '2026-11-01').loggedDays, 0);
});
