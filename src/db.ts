import { openDB } from "idb"
import type { DBSchema, IDBPDatabase } from "idb";

export type TestType = "pushup" | "plank" | "squat" | "vjump" | "sprint";

export interface Attempt {
  id: string;
  testType: TestType;
  createdAt: string; // ISO timestamp
  verified: boolean; // false = unverified (self-scored)
  scoreText: string; // e.g., "24 reps" or "62s"
  video?: Blob;
  mimeType?: string;
  durationMs?: number;
}

interface WinDB extends DBSchema {
  attempts: {
    key: string;
    value: Attempt;
  };
}

let dbInstance: IDBPDatabase<WinDB> | null = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<WinDB>("win_db", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("attempts")) {
        db.createObjectStore("attempts", { keyPath: "id" });
      }
    },
  });
  return dbInstance;
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  const db = await getDb();
  await db.put("attempts", attempt);
}

export async function listAttempts(): Promise<Attempt[]> {
  const db = await getDb();
  return db.getAll("attempts");
}

export async function getAttempt(id: string): Promise<Attempt | undefined> {
  const db = await getDb();
  return db.get("attempts", id);
}
