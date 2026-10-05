import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type {
  AthleteProfile,
  Attempt,
  EvaluationRecord,
  TodoSectionPreference,
  TodoProgress,
  TrainingPlanTemplate,
} from "./types";

const DB_NAME = "win_db";
const DB_VERSION = 4;
const PROFILE_ID = "local-athlete";
const TRAINING_PLAN_ID = "squad-training-plan";
type WinStoreName =
  | "attempts"
  | "profile"
  | "evaluations"
  | "trainingPlans"
  | "todoProgress"
  | "todoSectionPreferences";

interface WinDB extends DBSchema {
  attempts: {
    key: string;
    value: Attempt;
  };
  profile: {
    key: string;
    value: AthleteProfile;
  };
  evaluations: {
    key: string;
    value: EvaluationRecord;
  };
  trainingPlans: {
    key: string;
    value: TrainingPlanTemplate;
  };
  todoProgress: {
    key: string;
    value: TodoProgress;
  };
  todoSectionPreferences: {
    key: string;
    value: TodoSectionPreference;
  };
}

let dbInstance: IDBPDatabase<WinDB> | null = null;

export async function getDb(): Promise<IDBPDatabase<WinDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<WinDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("attempts")) {
        db.createObjectStore("attempts", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("profile")) {
        db.createObjectStore("profile", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("evaluations")) {
        db.createObjectStore("evaluations", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("trainingPlans")) {
        db.createObjectStore("trainingPlans", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("todoProgress")) {
        db.createObjectStore("todoProgress", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("todoSectionPreferences")) {
        db.createObjectStore("todoSectionPreferences", { keyPath: "id" });
      }
    },
  });

  return dbInstance;
}

export async function getProfile(): Promise<AthleteProfile | undefined> {
  const db = await getDb();
  return db.get("profile", PROFILE_ID);
}

export async function saveProfile(profile: AthleteProfile): Promise<void> {
  const db = await getDb();
  await db.put("profile", { ...profile, id: PROFILE_ID });
}

export async function saveEvaluation(record: EvaluationRecord): Promise<void> {
  const db = await getDb();
  await db.put("evaluations", record);
}

export async function deleteEvaluation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("evaluations", id);
}

export async function listEvaluations(): Promise<EvaluationRecord[]> {
  const db = await getDb();
  const records = await db.getAll("evaluations");
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  const db = await getDb();
  await db.put("attempts", attempt);
}

export async function listAttempts(): Promise<Attempt[]> {
  const db = await getDb();
  const attempts = await db.getAll("attempts");
  return attempts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTrainingPlan(): Promise<TrainingPlanTemplate | undefined> {
  const db = await getDb();
  const plan = await db.get("trainingPlans", TRAINING_PLAN_ID);
  if (plan) return plan;
  return db.get("trainingPlans", "jumper-12-week-default");
}

export async function saveTrainingPlan(plan: TrainingPlanTemplate): Promise<void> {
  const db = await getDb();
  await db.put("trainingPlans", { ...plan, id: TRAINING_PLAN_ID });
}

export async function listTodoProgress(planId: string): Promise<TodoProgress[]> {
  const db = await getDb();
  const records = await db.getAll("todoProgress");
  return records.filter((record) => record.planId === planId);
}

export async function saveTodoProgress(progress: TodoProgress): Promise<void> {
  const db = await getDb();
  await db.put("todoProgress", progress);
}

export async function listTodoSectionPreferences(): Promise<TodoSectionPreference[]> {
  const db = await getDb();
  return db.getAll("todoSectionPreferences");
}

export async function saveTodoSectionPreference(
  preference: TodoSectionPreference
): Promise<void> {
  const db = await getDb();
  await db.put("todoSectionPreferences", preference);
}

export async function clearCloudBackedStores(
  options: { includeLegacyAttempts?: boolean } = {}
): Promise<void> {
  const db = await getDb();
  const storeNames: WinStoreName[] = [
    "profile",
    "evaluations",
    "trainingPlans",
    "todoProgress",
    "todoSectionPreferences",
  ];
  if (options.includeLegacyAttempts) {
    storeNames.push("attempts");
  }
  const tx = db.transaction(storeNames, "readwrite");

  await Promise.all(storeNames.map((storeName) => tx.objectStore(storeName).clear()));
  await tx.done;
}
