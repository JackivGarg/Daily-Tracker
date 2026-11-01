import { randomUUID } from 'node:crypto';

export const MUSCLES = ['Legs', 'Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders', 'Core', 'Forearms'];
export const DEFAULT_SETTINGS = Object.freeze({
  name: 'Jackiv',
  startDate: '2026-11-01',
  calorieGoal: 2200,
  studyGoal: 120,
  guitarGoal: 20,
  proteinGoal: 120,
  greenLabel: 'Green day',
  greenMeaning: 'A day that felt aligned with my priorities.',
  redLabel: 'Red day',
  redMeaning: 'A day to reflect, reset, and try again.',
});

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

export function todayInIndia(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${label} must be a JSON object.`);
  }
}

function text(value, label, max, allowEmpty = true) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
    throw new ValidationError(`${label} must be ${allowEmpty ? 'text of' : 'non-empty text of'} at most ${max} characters.`);
  }
  return value.trim();
}

function number(value, label, min, max, integer = false, nullable = false) {
  if (nullable && value === null) return value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new ValidationError(`${label} must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}${nullable ? ', or null' : ''}.`);
  }
  return value;
}

function nullableBoolean(value, label) {
  if (value !== null && typeof value !== 'boolean') throw new ValidationError(`${label} must be true, false, or null.`);
  return value;
}

export function validDate(value, { startDate = DEFAULT_SETTINGS.startDate, today = todayInIndia() } = {}) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError('Choose a date in YYYY-MM-DD format.');
  }
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ValidationError('Choose a real calendar date.');
  }
  if (value < startDate) throw new ValidationError(`Tracking begins on ${startDate}.`);
  if (value > today) throw new ValidationError('Future days cannot be logged yet.');
  return value;
}

export function emptyEntry(date) {
  return {
    date, status: null, meals: [], weight: null, workoutDone: null,
    muscles: {}, workoutRating: null, studyMinutes: null, studyNote: '',
    guitarDone: null, guitarMinutes: null, guitarNote: '',
    proteinTaken: null, creatineTaken: null, note: '', updatedAt: null,
  };
}

export function validateSettings(patch, current = DEFAULT_SETTINGS) {
  object(patch, 'Settings');
  for (const key of Object.keys(patch)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) throw new ValidationError(`Unknown setting: ${key}.`);
  }
  if (Object.hasOwn(patch, 'startDate') && patch.startDate !== DEFAULT_SETTINGS.startDate) {
    throw new ValidationError('The tracking start date cannot be changed.');
  }
  const merged = { ...current, ...patch, startDate: DEFAULT_SETTINGS.startDate };
  return {
    name: text(merged.name, 'Your name', 80, false),
    startDate: DEFAULT_SETTINGS.startDate,
    calorieGoal: number(merged.calorieGoal, 'Calorie goal', 1, 20000, true),
    studyGoal: number(merged.studyGoal, 'Study goal', 1, 1440, true),
    guitarGoal: number(merged.guitarGoal, 'Guitar goal', 1, 1440, true),
    proteinGoal: number(merged.proteinGoal, 'Protein goal', 1, 1000, true),
    greenLabel: text(merged.greenLabel, 'Green label', 50, false),
    greenMeaning: text(merged.greenMeaning, 'Green meaning', 500),
    redLabel: text(merged.redLabel, 'Red label', 50, false),
    redMeaning: text(merged.redMeaning, 'Red meaning', 500),
  };
}

export function validateEntry(date, patch, current = emptyEntry(date), options = {}) {
  validDate(date, options);
  object(patch, 'Day entry');
  const shape = emptyEntry(date);
  for (const key of Object.keys(patch)) {
    if (!Object.hasOwn(shape, key)) throw new ValidationError(`Unknown day field: ${key}.`);
  }
  if (Object.hasOwn(patch, 'date') && patch.date !== date) throw new ValidationError('Entry date must match the requested day.');
  const merged = { ...shape, ...current, ...patch, date };
  if (merged.status !== null && merged.status !== 'green' && merged.status !== 'red') {
    throw new ValidationError('Day color must be green, red, or null.');
  }
  if (!Array.isArray(merged.meals) || merged.meals.length > 200) throw new ValidationError('Meals must be a list of at most 200 items.');
  const mealIds = new Set();
  const meals = merged.meals.map((meal, index) => {
    object(meal, `Meal ${index + 1}`);
    for (const key of Object.keys(meal)) {
      if (!['id', 'name', 'calories', 'protein'].includes(key)) throw new ValidationError(`Unknown meal field: ${key}.`);
    }
    const id = meal.id === undefined ? randomUUID() : text(meal.id, 'Meal ID', 100, false);
    if (mealIds.has(id)) throw new ValidationError('Meal IDs must be unique within the day.');
    mealIds.add(id);
    return {
      id, name: text(meal.name, 'Meal name', 200, false),
      calories: number(meal.calories, 'Meal calories', 0, 20000),
      protein: number(meal.protein ?? 0, 'Meal protein', 0, 1000),
    };
  });
  object(merged.muscles, 'Muscle ratings');
  const muscles = {};
  for (const [muscle, rating] of Object.entries(merged.muscles)) {
    if (!MUSCLES.includes(muscle)) throw new ValidationError(`Unknown muscle group: ${muscle}.`);
    muscles[muscle] = number(rating, `${muscle} rating`, 1, 5, true);
  }
  return {
    date, status: merged.status, meals,
    weight: number(merged.weight, 'Weight in kilograms', 1, 1000, false, true),
    workoutDone: nullableBoolean(merged.workoutDone, 'Workout completed'),
    muscles,
    workoutRating: number(merged.workoutRating, 'Workout rating', 1, 5, true, true),
    studyMinutes: number(merged.studyMinutes, 'Study minutes', 0, 1440, true, true),
    studyNote: text(merged.studyNote, 'Study note', 4000),
    guitarDone: nullableBoolean(merged.guitarDone, 'Guitar practiced'),
    guitarMinutes: number(merged.guitarMinutes, 'Guitar minutes', 0, 1440, true, true),
    guitarNote: text(merged.guitarNote, 'Guitar note', 4000),
    proteinTaken: nullableBoolean(merged.proteinTaken, 'Protein taken'),
    creatineTaken: nullableBoolean(merged.creatineTaken, 'Creatine taken'),
    note: text(merged.note, 'Daily reflection', 8000),
    updatedAt: new Date().toISOString(),
  };
}
