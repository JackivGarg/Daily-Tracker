export interface GrowthEntry {
  date: string;
  status?: 'green' | 'red' | null;
  workoutDone?: boolean | null;
  guitarDone?: boolean | null;
  sportsDone?: boolean | null;
  travelDone?: boolean | null;
  updatedAt?: string;
}

export interface GrowthStage { readonly name: string; readonly points: number }
export interface GrowthState {
  date: string;
  points: number;
  greenStreak: number;
  qualifyingGreenDays: number;
  greenDays: number;
  redDays: number;
  workoutDays: number;
  workoutStreak: number;
  branches: number;
  branchProgress: number;
  vitality: number;
  dryDays: number;
  joyDays: number;
  stage: string;
  stageIndex: number;
  stageProgress: number;
  nextStageAt: number | null;
  growthActive: boolean;
  daysToUnlock: number;
  recordedDays: number;
  latestStatus: 'green' | 'red' | null;
  hasRecords: boolean;
}
export const GROWTH_RULES: Readonly<{
  minimumStreak: number;
  branchEvery: number;
  maximumBranches: number;
  dryGraceDays: number;
  dryLoss: number;
  joyRecovery: number;
  initialVitality: number;
  minimumVitality: number;
  stages: readonly GrowthStage[];
}>;
export function computeGrowth(entries: readonly GrowthEntry[], today: string, startDate?: string): GrowthState;
export function growthTimeline(entries: readonly GrowthEntry[], today: string, startDate?: string): {date: string; state: GrowthState}[];
