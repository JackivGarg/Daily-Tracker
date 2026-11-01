const calendarFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});
const weekdayFormatter = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' });

/** A calendar day in the user's timezone, independent of the computer timezone. */
export function dateKey(date = new Date()) {
  const parts = Object.fromEntries(calendarFormatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function asUTC(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('Expected a date in YYYY-MM-DD format.');
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) throw new RangeError('Invalid calendar date.');
  return parsed;
}

/** UTC calendar arithmetic avoids local DST and midnight boundary shifts. */
export function shiftDate(date, days) {
  if (!Number.isInteger(days)) throw new RangeError('Day offset must be an integer.');
  const shifted = asUTC(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function emptyEntry(date) {
  asUTC(date);
  return {
    date, status: null, meals: [], weight: null, workoutDone: null, muscles: {}, workoutRating: null,
    studyMinutes: null, studyNote: '', guitarDone: null, guitarMinutes: null, guitarNote: '', sportsDone: null, travelDone: null,
    proteinTaken: null, creatineTaken: null, note: '', updatedAt: '',
  };
}

export function totals(entry) {
  return (entry?.meals ?? []).reduce((sum, meal) => ({
    calories: sum.calories + meal.calories,
    protein: sum.protein + meal.protein,
  }), { calories: 0, protein: 0 });
}

function entryMap(entries) {
  const map = new Map();
  for (const entry of entries) {
    const previous = map.get(entry.date);
    if (!previous || (entry.updatedAt ?? '') >= (previous.updatedAt ?? '')) map.set(entry.date, entry);
  }
  return map;
}

function hasData(entry) {
  return entry.status != null || entry.meals.length > 0 || entry.weight != null
    || entry.workoutDone != null || Object.keys(entry.muscles).length > 0 || entry.workoutRating != null
    || entry.studyMinutes != null || Boolean(entry.studyNote.trim())
    || entry.guitarDone != null || entry.guitarMinutes != null || Boolean(entry.guitarNote.trim())
    || entry.sportsDone != null || entry.travelDone != null
    || entry.proteinTaken != null || entry.creatineTaken != null || Boolean(entry.note.trim());
}

function history(entries, today) {
  return [...entryMap(entries).values()].filter(entry => entry.date <= today && hasData(entry))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getStreak(entries, today) {
  const map = entryMap(entries);
  let cursor = today;
  if (map.get(today)?.status == null) cursor = shiftDate(today, -1);
  let streak = 0;
  while (map.get(cursor)?.status === 'green') {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

export function weeklyData(entries, today, days = 7) {
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new RangeError('Choose between 1 and 366 days.');
  const map = entryMap(entries);
  return Array.from({ length: days }, (_, index) => {
    const date = shiftDate(today, index - days + 1);
    const entry = map.get(date);
    const hasMeals = Boolean(entry?.meals.length);
    const nutrition = totals(entry);
    return {
      date,
      label: weekdayFormatter.format(asUTC(date)),
      calories: hasMeals ? nutrition.calories : null,
      protein: hasMeals ? nutrition.protein : null,
      weight: entry?.weight ?? null,
      studyMinutes: entry?.studyMinutes ?? null,
      guitarMinutes: entry?.guitarMinutes ?? null,
      workout: entry?.workoutDone ?? null,
      hasMeals,
      status: entry?.status ?? null,
    };
  });
}

export function computeSummary(entries, today) {
  const logged = history(entries, today);
  const mealDays = logged.filter(entry => entry.meals.length > 0);
  const weights = logged.filter(entry => entry.weight != null);
  return {
    greenDays: logged.filter(entry => entry.status === 'green').length,
    redDays: logged.filter(entry => entry.status === 'red').length,
    loggedDays: logged.length,
    streak: getStreak(logged, today),
    workoutDays: logged.filter(entry => entry.workoutDone === true).length,
    studyMinutes: logged.reduce((sum, entry) => sum + (entry.studyMinutes ?? 0), 0),
    guitarDays: logged.filter(entry => entry.guitarDone === true).length,
    averageCalories: mealDays.length ? Math.round(mealDays.reduce((sum, entry) => sum + totals(entry).calories, 0) / mealDays.length) : null,
    weightChange: weights.length > 1 ? Math.round((weights.at(-1).weight - weights[0].weight) * 10) / 10 : null,
  };
}

export function getInsights(entries, settings, today) {
  const logged = history(entries, today);
  if (!logged.length) return [{
    title: 'Your first entry is the starting point',
    body: 'Log what happened today. Your patterns will take shape as your history grows.',
    tone: 'neutral',
  }];

  const firstDay = shiftDate(today, -6);
  const recent = logged.filter(entry => entry.date >= firstDay);
  const insights = [];
  const streak = getStreak(logged, today);
  if (streak > 0) insights.push({
    title: `${streak} ${streak === 1 ? 'green day' : 'green days'} in a row`,
    body: `Each mark reflects your own definition of “${settings.greenLabel}.” Keep checking in honestly.`,
    tone: 'green',
  });

  const workouts = recent.filter(entry => entry.workoutDone === true);
  if (workouts.length) {
    const ratings = workouts.map(entry => entry.workoutRating).filter(value => value != null);
    insights.push({
      title: `${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'} logged this week`,
      body: ratings.length
        ? `Your ${ratings.length} rated ${ratings.length === 1 ? 'session averages' : 'sessions average'} ${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)}/5. Notice how your next session feels.`
        : 'Add a session rating to help you spot changes in how training feels.',
      tone: 'green',
    });
  }

  const studyLogs = recent.filter(entry => entry.studyMinutes != null);
  const studied = studyLogs.reduce((sum, entry) => sum + entry.studyMinutes, 0);
  if (studyLogs.length) insights.push({
    title: `${studied} minutes of study this week`,
    body: `${studyLogs.filter(entry => entry.studyMinutes >= settings.studyGoal).length} of ${studyLogs.length} logged ${studyLogs.length === 1 ? 'day met' : 'days met'} your ${settings.studyGoal}-minute goal. Unlogged days are left out.`,
    tone: studied > 0 ? 'green' : 'neutral',
  });

  const mealDays = recent.filter(entry => entry.meals.length);
  if (mealDays.length) {
    const average = Math.round(mealDays.reduce((sum, entry) => sum + totals(entry).calories, 0) / mealDays.length);
    insights.push({
      title: `${average.toLocaleString('en-IN')} kcal per logged day`,
      body: `Based on ${mealDays.length} ${mealDays.length === 1 ? 'day' : 'days'} with meals this week. Partial meal logs can affect this average.`,
      tone: 'neutral',
    });
  }

  const guitarDays = recent.filter(entry => entry.guitarDone === true).length;
  if (guitarDays) insights.push({
    title: `Guitar on ${guitarDays} ${guitarDays === 1 ? 'day' : 'days'} this week`,
    body: 'Those moments with your instrument count. A short practice is still a chance to build familiarity.',
    tone: 'green',
  });

  if (!insights.length) insights.push({
    title: recent.length ? 'You made time to check in' : 'A fresh week to begin',
    body: recent.length
      ? 'A record is useful even when a day feels unfinished. Add the details you want to understand over time.'
      : 'Your past entries are saved. Log today to start seeing patterns for this week.',
    tone: 'neutral',
  });
  return insights.slice(0, 4);
}
