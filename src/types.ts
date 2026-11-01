export const MUSCLES = ['Legs', 'Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders', 'Core', 'Forearms'] as const;

export type Muscle = (typeof MUSCLES)[number];
export type DayStatus = 'green' | 'red' | null;

export interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
}

export interface Entry {
  date: string;
  status: DayStatus;
  meals: Meal[];
  weight: number | null;
  workoutDone: boolean | null;
  muscles: Partial<Record<Muscle, number>>;
  workoutRating: number | null;
  studyMinutes: number | null;
  studyNote: string;
  guitarDone: boolean | null;
  guitarMinutes: number | null;
  guitarNote: string;
  proteinTaken: boolean | null;
  creatineTaken: boolean | null;
  note: string;
  updatedAt: string;
}

export interface Settings {
  name: string;
  startDate: string;
  calorieGoal: number;
  studyGoal: number;
  guitarGoal: number;
  proteinGoal: number;
  greenLabel: string;
  greenMeaning: string;
  redLabel: string;
  redMeaning: string;
}

export interface Bootstrap {
  settings: Settings;
  entries: Entry[];
  today: string;
}
