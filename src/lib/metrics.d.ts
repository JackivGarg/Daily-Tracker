import type { Entry, Settings, DayStatus } from '../types';

export interface WeeklyDatum {
  date: string;
  label: string;
  calories: number | null;
  protein: number | null;
  weight: number | null;
  studyMinutes: number | null;
  guitarMinutes: number | null;
  workout: boolean | null;
  hasMeals: boolean;
  status: DayStatus;
}

export interface Summary {
  greenDays: number;
  redDays: number;
  loggedDays: number;
  streak: number;
  workoutDays: number;
  studyMinutes: number;
  guitarDays: number;
  averageCalories: number | null;
  weightChange: number | null;
}

export interface Insight {
  title: string;
  body: string;
  tone: 'green' | 'neutral' | 'amber';
}

export function dateKey(date?: Date): string;
export function shiftDate(date: string, days: number): string;
export function emptyEntry(date: string): Entry;
export function totals(entry?: Entry | null): { calories: number; protein: number };
export function getStreak(entries: Entry[], today: string): number;
export function weeklyData(entries: Entry[], today: string, days?: number): WeeklyDatum[];
export function computeSummary(entries: Entry[], today: string): Summary;
export function getInsights(entries: Entry[], settings: Settings, today: string): Insight[];
