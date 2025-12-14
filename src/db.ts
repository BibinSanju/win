import { openDB } from "idb";

export type Attempt = {
  id: string;
  testType: "pushup" | "plank" | "squat" | "vjump" | "sprint";
  createdAt: string;
  verified: boolean;        // false for self-scored (unverified)
  scoreText?: string;       // manual score like "24 reps" or "62s"
  video?: Blob;             // recorded clip
  mimeType?: string;
  durationMs?: number;
};

const DB_NAME = "win_db";
const DB_VERSION = 1;

export async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("attempts", { keyPath: "id" });
    },
  });
}

export async function saveAttempt(attempt: Attempt) {
  const db = await getDb();
  await db.put("attempts", attempt);
}

export async function listAttempts(): Promise<Attempt[]> {
  const db = await getDb();
  return db.getAll("attempts");
}
