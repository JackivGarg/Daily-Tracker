import test from 'node:test';
import assert from 'node:assert/strict';
import { computeGrowth, growthTimeline, GROWTH_RULES } from './growth.js';
import { shiftDate, emptyEntry } from './metrics.js';

const date = offset => shiftDate('2026-11-01', offset);
const green = offset => ({ date: date(offset), status: 'green' });

test('three consecutive green days unlock size growth and red pauses without losing earned size', () => {
  const entries = [green(0), green(1)];
  assert.equal(computeGrowth(entries, date(1)).points, 0);
  entries.push(green(2), green(3));
  const grown = computeGrowth(entries, date(3));
  assert.equal(grown.points, 2);
  assert.equal(grown.stage, 'Sprout');
  assert.equal(grown.growthActive, true);
  entries.push({ date: date(4), status: 'red' });
  const paused = computeGrowth(entries, date(4));
  assert.equal(paused.points, 2);
  assert.equal(paused.greenStreak, 0);
  assert.equal(paused.growthActive, false);
  assert.equal(paused.daysToUnlock, 3);
  entries.push(green(5), green(6));
  assert.equal(computeGrowth(entries, date(6)).points, 2);
  entries.push(green(7));
  assert.equal(computeGrowth(entries, date(7)).points, 3);
});

test('calendar gaps interrupt streaks, an unknown today may carry yesterday, and missing days earn nothing', () => {
  const entries = [green(0), green(1), green(2)];
  const unknownToday = computeGrowth(entries, date(3));
  assert.equal(unknownToday.greenStreak, 3);
  assert.equal(unknownToday.points, 1);
  assert.equal(computeGrowth(entries, date(4)).greenStreak, 0);
  entries.push(green(4));
  assert.equal(computeGrowth(entries, date(4)).points, 1);
  assert.equal(computeGrowth(entries, date(4)).greenStreak, 1);
  entries.push({ date: date(5), status: null, workoutDone: false }, green(6));
  assert.equal(computeGrowth(entries, date(6)).greenStreak, 1);
});

test('foliage dries only after three explicitly joy-free days, bounded at minimum vitality', () => {
  const dry = offset => ({ date: date(offset), guitarDone: false, sportsDone: false, travelDone: false });
  const entries = [dry(0), dry(1), dry(2)];
  assert.equal(computeGrowth(entries, date(2)).vitality, 55);
  entries.push(dry(3));
  assert.equal(computeGrowth(entries, date(3)).vitality, 43);
  entries.push(...Array.from({length: 10}, (_, i) => dry(i + 4)));
  assert.equal(computeGrowth(entries, date(13)).vitality, 15);
});

test('legacy and partially unknown joy logs do not dry the tree or clear its dry-day history', () => {
  const entries = [0,1,2,3].map(offset => ({ date: date(offset), guitarDone: false }));
  assert.equal(computeGrowth(entries, date(3)).vitality, 55);
  assert.equal(computeGrowth(entries, date(3)).dryDays, 0);
  const dry = offset => ({ date: date(offset), guitarDone: false, sportsDone: false, travelDone: false });
  const mixed = [dry(0), dry(1), {date:date(2),guitarDone:null,sportsDone:false,travelDone:false}, dry(3), dry(4)];
  assert.equal(computeGrowth(mixed, date(4)).vitality, 43);
  assert.equal(computeGrowth(mixed, date(4)).dryDays, 4);
});

test('any one guitar, sports, or travel activity restores foliage and resets drought', () => {
  for (const activity of ['guitarDone', 'sportsDone', 'travelDone']) {
    const dry = Array.from({length:4},(_, i) => ({date:date(i),guitarDone:false,sportsDone:false,travelDone:false}));
    const recovered = computeGrowth([...dry,{date:date(4),[activity]:true}],date(4));
    assert.equal(recovered.vitality, 71);
    assert.equal(recovered.dryDays, 0);
    assert.equal(recovered.joyDays, 1);
    assert.equal(computeGrowth([{date:date(0),[activity]:true},{date:date(1),[activity]:true}],date(1)).vitality,100);
  }
});

test('workouts earn permanent branches every three sessions without penalizing rest or unknown days', () => {
  const entries = Array.from({length:8},(_, i) => ({date:date(i),workoutDone:i!==4}));
  const state = computeGrowth(entries,date(7));
  assert.equal(state.workoutDays,7);
  assert.equal(state.branches,2);
  assert.equal(state.branchProgress,1/3);
  assert.equal(state.workoutStreak,3);
  assert.equal(computeGrowth(entries,date(8)).workoutStreak,3);
  assert.equal(computeGrowth(entries,date(9)).workoutStreak,0);
  const mature = computeGrowth(Array.from({length:50},(_, i)=>({date:date(i),workoutDone:true})),date(49));
  assert.equal(mature.branches,12);
  assert.equal(mature.branchProgress,1);
});

test('chronological dedupe, date bounds and retrospective edits deterministically change growth once', () => {
  const entries = [green(2), green(0), { ...green(1), updatedAt:'2026-11-02T10:00:00Z' }, {date:date(1),status:'red',updatedAt:'2026-11-02T11:00:00Z'}, green(3), {date:'2026-10-31',status:'green'},green(9)];
  const paused = computeGrowth(entries,date(3));
  assert.equal(paused.points,0);
  assert.equal(paused.recordedDays,4);
  assert.equal(paused.redDays,1);
  const amended = [...entries,{...green(1),updatedAt:'2026-11-02T12:00:00Z'}];
  assert.equal(computeGrowth(amended,date(3)).points,2);
  assert.deepEqual(computeGrowth(amended,date(3)),computeGrowth(amended,date(3)));
});

test('empty data stays a seed, and stage thresholds follow earned points', () => {
  const seed = computeGrowth([emptyEntry(date(0)),{date:'invalid',status:'green'}],date(0));
  assert.equal(seed.hasRecords,false);
  assert.equal(seed.recordedDays,0);
  assert.equal(seed.stage,'Seed');
  assert.equal(seed.nextStageAt,1);
  assert.equal(seed.vitality,55);
  assert.equal(seed.daysToUnlock,3);
  const grown = computeGrowth(Array.from({length:47},(_,i)=>green(i)),date(46));
  assert.equal(grown.points,45);
  assert.equal(grown.stage,'Full-grown tree');
  assert.equal(grown.stageProgress,1);
  assert.equal(grown.nextStageAt,null);
  assert.equal(GROWTH_RULES.minimumStreak,3);
});

test('timeline includes actual meaningful dates and a current snapshot, never invented missing rewards', () => {
  const entries = [green(0),green(1),green(2),{date:date(4),sportsDone:true}];
  const timeline = growthTimeline(entries,date(7));
  assert.deepEqual(timeline.map(item=>item.date),[date(0),date(1),date(2),date(4),date(7)]);
  assert.deepEqual(timeline.map(item=>item.state.points),[0,0,1,1,1]);
  assert.deepEqual(timeline.at(-1).state,computeGrowth(entries,date(7)));
  assert.equal(growthTimeline([],date(0))[0].state.stage,'Seed');
});

test('unknown values carry yesterday only on their own date, not through consecutive unknown dates', () => {
  const entries = [0,1,2].map(offset=>({...green(offset),workoutDone:true}));
  entries.push({date:date(3),status:null,workoutDone:null,studyMinutes:20});
  const fourth = computeGrowth(entries,date(3));
  assert.equal(fourth.greenStreak,3);
  assert.equal(fourth.workoutStreak,3);
  assert.equal(computeGrowth(entries,date(4)).greenStreak,0);
  assert.equal(computeGrowth(entries,date(4)).workoutStreak,0);
  const timeline = growthTimeline(entries,date(4));
  assert.deepEqual(timeline.at(-2).state,fourth);
  assert.equal(timeline.at(-1).state.greenStreak,0);
});

test('ten thousand imported days produce independent accurate snapshots without rescanning prefixes', () => {
  const startDate = '2000-01-01';
  const entries = Array.from({length:10000},(_,offset)=>({
    date:shiftDate(startDate,offset),status:'green',workoutDone:true,guitarDone:true,
  }));
  const today = entries.at(-1).date;
  const timeline = growthTimeline(entries,today,startDate);
  assert.equal(timeline.length,10000);
  assert.equal(timeline[0].state.points,0);
  assert.equal(timeline[2].state.points,1);
  assert.equal(timeline[100].state.points,99);
  assert.equal(timeline.at(-1).state.points,9998);
  assert.equal(timeline.at(-1).state.workoutStreak,10000);
  assert.equal(timeline.at(-1).state.recordedDays,10000);
  assert.equal(timeline.at(-1).state.branches,12);
  assert.equal(timeline.at(-1).state.vitality,100);
  assert.equal(timeline.at(-1).state.stage,'Full-grown tree');
  assert.deepEqual(timeline.at(-1).state,computeGrowth(entries,today,startDate));
  assert.notEqual(timeline[0].state,timeline[1].state);
});
