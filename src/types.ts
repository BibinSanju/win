export type LegacyTestType = "pushup" | "plank" | "squat" | "vjump" | "sprint";

export type EventType = "long-jump" | "triple-jump";

export type RatingLabel = "Needs focus" | "Developing" | "Strong" | "Excellent";

export type ExerciseCategory =
  | "sprint"
  | "jump"
  | "plyometric"
  | "strength"
  | "core"
  | "mobility"
  | "recovery";

export interface VideoAttachment {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export type UserRole = "coach" | "athlete";

export interface AthleteProfile {
  id: "local-athlete";
  username: string;
  dob: string;
  events: EventType[];
  createdAt: string;
  updatedAt: string;
  role?: UserRole;
}

export interface EvaluationRecord {
  id: string;
  eventType: EventType;
  testId: string;
  createdAt: string;
  inputs: Record<string, number>;
  resultValue: number;
  resultUnit: string;
  score: number;
  zScore: number;
  rating: RatingLabel;
  video?: VideoAttachment;
}

export interface Attempt {
  id: string;
  testType: LegacyTestType;
  createdAt: string;
  verified: boolean;
  scoreText: string;
  video?: Blob;
  mimeType?: string;
  durationMs?: number;
}

export interface ExerciseGuide {
  id: string;
  title: string;
  category: ExerciseCategory;
  equipment: string[];
  steps: string[];
  coachingCues: string[];
  commonMistakes: string[];
  safetyNotes: string[];
  externalLinks: {
    websiteUrl: string | null;
    youtubeUrl: string | null;
  };
  updatedAt: string;
}

export interface TrainingTodoItem {
  id: string;
  label: string;
  exerciseId?: string;
  setsReps?: string;
  notes?: string;
  category?: ExerciseCategory;
}

export interface TrainingSection {
  id: string;
  title: string;
  note?: string;
  items: TrainingTodoItem[];
}

export interface TrainingDayPlan {
  id: string;
  name: string;
  title: string;
  focus: string;
  sections: TrainingSection[];
}

export interface TrainingPhase {
  id: string;
  title: string;
  weekRange: string;
  weeks: number[];
  goal: string;
  items: TrainingTodoItem[];
  weeklyCheckFields: string[];
}

export interface TrainingPlanTemplate {
  id: string;
  title: string;
  trainingTime: string;
  goal: string;
  currentPb: string;
  targetPeriod: string;
  dailyChecklist: TrainingTodoItem[];
  days: TrainingDayPlan[];
  phases: TrainingPhase[];
  progressFields: string[];
  personalReminders: TrainingTodoItem[];
  importedSections: TrainingSection[];
  exerciseGuides: Record<string, ExerciseGuide>;
  sourceMarkdown?: string;
  updatedAt: string;
}

export interface TodoProgress {
  id: string;
  planId: string;
  itemId: string;
  completed: boolean;
  completedAt?: string;
  updatedAt: string;
}

export interface TodoSectionPreference {
  id: string;
  sectionId: string;
  collapsed: boolean;
  updatedAt: string;
}
