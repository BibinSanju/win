import {
  clearCloudBackedStores,
  listEvaluations,
  saveEvaluation,
  saveProfile,
  saveTodoProgress,
  saveTodoSectionPreference,
  saveTrainingPlan,
} from "./db";
import { supabase } from "./supabaseClient";
import {
  countPlanItems,
  createDefaultTrainingPlan,
  isLegacyDefaultPlan,
  sanitizeTrainingPlan,
} from "./trainingPlan";
import type {
  AthleteProfile,
  EvaluationRecord,
  EventType,
  RatingLabel,
  TodoProgress,
  TodoSectionPreference,
  TrainingPlanTemplate,
  UserRole,
} from "./types";

const LAST_SYNCED_USER_KEY = "win:last-supabase-user-id";

interface ProfileRow {
  user_id: string;
  username: string | null;
  name?: string | null;
  dob: string | null;
  events: unknown;
  role?: string | null;
  morning_sessions_enabled?: boolean | null;
  created_at: string;
  updated_at: string;
}

interface EvaluationRow {
  id: string;
  user_id: string;
  event_type: string;
  test_id: string;
  created_at: string;
  inputs: Record<string, number>;
  result_value: number;
  result_unit: string;
  score: number;
  z_score: number;
  rating: string;
  updated_at: string;
}

interface TrainingPlanRow {
  id: string;
  user_id: string;
  template_json: TrainingPlanTemplate;
  updated_at: string;
}

interface TodoProgressRow {
  id: string;
  user_id: string;
  plan_id: string;
  item_id: string;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
}

interface TodoSectionPreferenceRow {
  id: string;
  user_id: string;
  section_id: string;
  collapsed: boolean;
  updated_at: string;
}

export interface CloudSyncSummary {
  mode: "loaded-cloud";
  message: string;
}

export function getLastSyncedUserId(): string | null {
  return window.localStorage.getItem(LAST_SYNCED_USER_KEY);
}

export function rememberSyncedUser(userId: string): void {
  window.localStorage.setItem(LAST_SYNCED_USER_KEY, userId);
}

export function forgetSyncedUser(): void {
  window.localStorage.removeItem(LAST_SYNCED_USER_KEY);
}

export async function clearLocalAccountCache(): Promise<void> {
  await clearCloudBackedStores({ includeLegacyAttempts: true });
  forgetSyncedUser();
}

export async function synchronizeUserData(
  userId: string,
  options: { resetLocalCache?: boolean } = {}
): Promise<CloudSyncSummary> {
  ensureSupabase();

  const sameCachedUser = getLastSyncedUserId() === userId && !options.resetLocalCache;
  const localEvaluations = sameCachedUser ? await listEvaluations() : [];
  const localVideos = new Map(
    localEvaluations
      .filter((record) => Boolean(record.video))
      .map((record) => [record.id, record.video])
  );

  await clearCloudBackedStores({ includeLegacyAttempts: !sameCachedUser });

  const [
    cloudProfile,
    cloudPlan,
    cloudEvaluationRows,
    cloudTodoProgressRows,
    cloudTodoSectionPreferenceRows,
  ] = await Promise.all([
    fetchCloudProfile(userId),
    fetchCloudTrainingPlan(userId),
    fetchCloudEvaluationRows(userId),
    fetchCloudTodoProgressRows(userId),
    fetchCloudTodoSectionPreferenceRows(userId),
  ]);

  if (cloudProfile) {
    await saveProfile(cloudProfile);
  }

  const isCoach = cloudProfile?.role === "coach";
  let activePlan: TrainingPlanTemplate;

  if (cloudPlan) {
    const cleanPlan = sanitizeTrainingPlan(cloudPlan);
    activePlan = cleanPlan;

    // If athlete, check if coach has published a newer or populated squad plan
    if (!isCoach) {
      try {
        const squadPlan = await fetchLatestSquadTrainingPlan();
        if (squadPlan) {
          const cleanSquadPlan = sanitizeTrainingPlan(squadPlan);
          const squadHasItems = countPlanItems(cleanSquadPlan) > 0;
          const cloudHasItems = countPlanItems(cleanPlan) > 0;
          const squadNewer = new Date(cleanSquadPlan.updatedAt).getTime() > new Date(cleanPlan.updatedAt).getTime();

          if ((!cloudHasItems && squadHasItems) || (squadHasItems && squadNewer)) {
            activePlan = cleanSquadPlan;
          }
        }
      } catch (err) {
        console.warn("Could not check latest squad plan for athlete:", err);
      }
    }

    await saveTrainingPlan(activePlan);
    if (isLegacyDefaultPlan(cloudPlan) || activePlan !== cleanPlan) {
      try {
        await upsertCloudTrainingPlan(userId, activePlan);
      } catch (err) {
        console.warn("Could not upsert synced plan to cloud:", err);
      }
    }
  } else {
    const squadPlan = await fetchLatestSquadTrainingPlan();
    const defaultPlan = squadPlan ? sanitizeTrainingPlan(squadPlan) : createDefaultTrainingPlan();
    activePlan = defaultPlan;
    try {
      await upsertCloudTrainingPlan(userId, defaultPlan);
    } catch (err) {
      console.warn("Could not upsert default plan to cloud:", err);
    }
    await saveTrainingPlan(defaultPlan);
  }

  for (const row of cloudEvaluationRows) {
    await saveEvaluation(evaluationFromRow(row, localVideos.get(row.id)));
  }

  for (const row of cloudTodoProgressRows) {
    await saveTodoProgress(todoProgressFromRow(row));
  }

  for (const row of cloudTodoSectionPreferenceRows) {
    await saveTodoSectionPreference(todoSectionPreferenceFromRow(row));
  }

  rememberSyncedUser(userId);

  return {
    mode: "loaded-cloud",
    message: "Account data loaded from Supabase.",
  };
}

export async function upsertCloudProfile(
  userId: string,
  profile: AthleteProfile
): Promise<void> {
  ensureSupabase();

  try {
    await supabase!.auth.updateUser({
      data: {
        username: profile.username,
        dob: profile.dob,
        events: profile.events,
        role: profile.role ?? "athlete",
        morningSessionsEnabled: Boolean(profile.morningSessionsEnabled),
      },
    });
  } catch (authErr) {
    console.warn("Could not sync metadata to Supabase auth user:", authErr);
  }

  const row = profileToRow(userId, profile);
  const { error } = await supabase!.from("profiles").upsert(row, {
    onConflict: "user_id",
  });

  if (error) {
    console.warn("Profile table upsert with role columns failed, retrying with base columns:", error.message);
    const fallbackRow = {
      user_id: userId,
      username: profile.username,
      dob: profile.dob,
      events: profile.events,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
    };
    const { error: fallbackError } = await supabase!.from("profiles").upsert(fallbackRow, {
      onConflict: "user_id",
    });
    if (fallbackError) throw fallbackError;
  }
}

export async function upsertCloudEvaluation(
  userId: string,
  record: EvaluationRecord
): Promise<void> {
  ensureSupabase();
  const { error } = await supabase!.from("evaluations").upsert(evaluationToRow(userId, record), {
    onConflict: "user_id,id",
  });
  if (error) throw error;
}

export async function deleteCloudEvaluation(userId: string, evaluationId: string): Promise<void> {
  ensureSupabase();
  const { error } = await supabase!
    .from("evaluations")
    .delete()
    .eq("user_id", userId)
    .eq("id", evaluationId);
  if (error) throw error;
}

export async function fetchAllSquadProfiles(): Promise<AthleteProfile[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data.map((row) => profileFromRow(row as ProfileRow));
  } catch (err) {
    console.warn("Could not fetch squad profiles from cloud:", err);
    return [];
  }
}

export async function updateSquadAthleteProfile(
  userId: string,
  updates: Partial<AthleteProfile>
): Promise<void> {
  if (!supabase) return;
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.morningSessionsEnabled !== undefined) {
    updateData.morning_sessions_enabled = updates.morningSessionsEnabled;
  }
  if (updates.role !== undefined) {
    updateData.role = updates.role;
  }
  if (updates.username !== undefined) {
    updateData.username = updates.username;
  }
  try {
    await supabase.from("profiles").update(updateData).eq("user_id", userId);
  } catch (err) {
    console.warn("Failed to update squad athlete in cloud:", err);
  }
}

export async function upsertCloudTrainingPlan(
  userId: string,
  plan: TrainingPlanTemplate
): Promise<void> {
  ensureSupabase();
  const { error } = await supabase!.from("training_plans").upsert(trainingPlanToRow(userId, plan), {
    onConflict: "user_id,id",
  });
  if (error) throw error;
}

export async function upsertCloudTodoProgress(
  userId: string,
  progress: TodoProgress
): Promise<void> {
  ensureSupabase();
  const { error } = await supabase!.from("todo_progress").upsert(todoProgressToRow(userId, progress), {
    onConflict: "user_id,id",
  });
  if (error) throw error;
}

export async function upsertCloudTodoSectionPreference(
  userId: string,
  preference: TodoSectionPreference
): Promise<void> {
  ensureSupabase();
  const { error } = await supabase!
    .from("todo_section_preferences")
    .upsert(todoSectionPreferenceToRow(userId, preference), {
      onConflict: "user_id,id",
    });
  if (error) throw error;
}

async function fetchCloudProfile(userId: string): Promise<AthleteProfile | null> {
  const { data, error } = await supabase!
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  let authMeta: Record<string, unknown> | undefined;
  try {
    const { data: userData } = await supabase!.auth.getUser();
    authMeta = userData.user?.user_metadata;
  } catch {
    // continue if offline
  }

  return profileFromRow(data as ProfileRow, authMeta);
}

async function fetchCloudTrainingPlan(userId: string): Promise<TrainingPlanTemplate | null> {
  const { data, error } = await supabase!
    .from("training_plans")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? trainingPlanFromRow(data as TrainingPlanRow) : null;
}

async function fetchLatestSquadTrainingPlan(): Promise<TrainingPlanTemplate | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("training_plans")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return trainingPlanFromRow(data as TrainingPlanRow);
}

async function fetchCloudEvaluationRows(userId: string): Promise<EvaluationRow[]> {
  const { data, error } = await supabase!
    .from("evaluations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EvaluationRow[];
}

async function fetchCloudTodoProgressRows(userId: string): Promise<TodoProgressRow[]> {
  const { data, error } = await supabase!
    .from("todo_progress")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []) as TodoProgressRow[];
}

async function fetchCloudTodoSectionPreferenceRows(
  userId: string
): Promise<TodoSectionPreferenceRow[]> {
  const { data, error } = await supabase!
    .from("todo_section_preferences")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []) as TodoSectionPreferenceRow[];
}

function profileToRow(userId: string, profile: AthleteProfile): ProfileRow {
  return {
    user_id: userId,
    username: profile.username,
    dob: profile.dob,
    events: profile.events,
    role: profile.role ?? "athlete",
    morning_sessions_enabled: Boolean(profile.morningSessionsEnabled),
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

function profileFromRow(row: ProfileRow, authMeta?: Record<string, unknown>): AthleteProfile {
  const username = normalizeUsername(row.username ?? row.name ?? (authMeta?.username as string) ?? "athlete");

  let role: UserRole = "athlete";
  if (row.role === "coach" || row.role === "athlete") {
    role = row.role;
  } else if (authMeta?.role === "coach" || authMeta?.role === "athlete") {
    role = authMeta.role as UserRole;
  }

  let morningSessionsEnabled = false;
  if (typeof row.morning_sessions_enabled === "boolean") {
    morningSessionsEnabled = row.morning_sessions_enabled;
  } else if (typeof authMeta?.morningSessionsEnabled === "boolean") {
    morningSessionsEnabled = Boolean(authMeta.morningSessionsEnabled);
  }

  return {
    id: row.user_id || "local-athlete",
    username,
    dob: toDateOnly(row.dob),
    events: toEventTypes(row.events),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    role,
    morningSessionsEnabled,
  };
}

function evaluationToRow(userId: string, record: EvaluationRecord): EvaluationRow {
  return {
    id: record.id,
    user_id: userId,
    event_type: record.eventType,
    test_id: record.testId,
    created_at: record.createdAt,
    inputs: record.inputs,
    result_value: record.resultValue,
    result_unit: record.resultUnit,
    score: record.score,
    z_score: record.zScore,
    rating: record.rating,
    updated_at: record.createdAt,
  };
}

function evaluationFromRow(
  row: EvaluationRow,
  localVideo: EvaluationRecord["video"]
): EvaluationRecord {
  return {
    id: row.id,
    eventType: toEventType(row.event_type),
    testId: row.test_id,
    createdAt: row.created_at,
    inputs: row.inputs,
    resultValue: Number(row.result_value),
    resultUnit: row.result_unit,
    score: Number(row.score),
    zScore: Number(row.z_score),
    rating: toRatingLabel(row.rating),
    video: localVideo,
  };
}

function trainingPlanToRow(userId: string, plan: TrainingPlanTemplate): TrainingPlanRow {
  return {
    id: plan.id,
    user_id: userId,
    template_json: plan,
    updated_at: plan.updatedAt,
  };
}

function trainingPlanFromRow(row: TrainingPlanRow): TrainingPlanTemplate {
  return {
    ...row.template_json,
    id: row.id,
    updatedAt: row.updated_at,
  };
}

function todoProgressToRow(userId: string, progress: TodoProgress): TodoProgressRow {
  return {
    id: progress.id,
    user_id: userId,
    plan_id: progress.planId,
    item_id: progress.itemId,
    completed: progress.completed,
    completed_at: progress.completedAt ?? null,
    updated_at: progress.updatedAt,
  };
}

function todoProgressFromRow(row: TodoProgressRow): TodoProgress {
  return {
    id: row.id,
    planId: row.plan_id,
    itemId: row.item_id,
    completed: row.completed,
    completedAt: row.completed_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

function todoSectionPreferenceToRow(
  userId: string,
  preference: TodoSectionPreference
): TodoSectionPreferenceRow {
  return {
    id: preference.id,
    user_id: userId,
    section_id: preference.sectionId,
    collapsed: preference.collapsed,
    updated_at: preference.updatedAt,
  };
}

function todoSectionPreferenceFromRow(row: TodoSectionPreferenceRow): TodoSectionPreference {
  return {
    id: row.id,
    sectionId: row.section_id,
    collapsed: row.collapsed,
    updatedAt: row.updated_at,
  };
}

function toEventTypes(value: unknown): EventType[] {
  if (!Array.isArray(value)) return ["long-jump", "triple-jump"];
  const events = value.filter(
    (event): event is EventType => event === "long-jump" || event === "triple-jump"
  );
  return events.length > 0 ? events : ["long-jump", "triple-jump"];
}

function toEventType(value: string): EventType {
  return value === "triple-jump" ? "triple-jump" : "long-jump";
}

function toRatingLabel(value: string): RatingLabel {
  if (value === "Excellent" || value === "Strong" || value === "Developing") return value;
  return "Needs focus";
}

function normalizeUsername(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return normalized || "athlete";
}

function toDateOnly(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "2000-01-01";
}

function ensureSupabase(): void {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
}
