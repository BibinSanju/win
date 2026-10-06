import "./style.css";

import {
  clearLocalAccountCache,
  deleteCloudEvaluation,
  fetchAllSquadProfiles,
  fetchLatestSquadTrainingPlan,
  synchronizeUserData,
  updateSquadAthleteProfile,
  upsertCloudEvaluation,
  upsertCloudProfile,
  upsertCloudTodoProgress,
  upsertCloudTodoSectionPreference,
  upsertCloudTrainingPlan,
} from "./cloudSync";
import {
  deleteEvaluation,
  getProfile,
  getTrainingPlan,
  listAttempts,
  listEvaluations,
  listTodoProgress,
  listTodoSectionPreferences,
  saveEvaluation,
  saveProfile,
  saveTodoProgress,
  saveTodoSectionPreference,
  saveTrainingPlan,
} from "./db";
import { recordVideo, startCamera, stopCamera } from "./recorder";
import type { RecordingController, RecordingResult } from "./recorder";
import {
  EVENT_KICKERS,
  EVENT_LABELS,
  calculateEventSummary,
  calculateTestStats,
  formatDelta,
  formatScore,
  formatZScore,
  getEventTests,
  getRankForScore,
  getTestDefinition,
} from "./scoring";
import type { RankStatus, TestDefinition } from "./scoring";
import {
  countPlanItems,
  createDefaultTrainingPlan,
  createWorkoutItem,
  findCurrentDayId,
  getPhaseForWeek,
  isLegacyDefaultPlan,
  matchExerciseId,
  parseMarkdownChecklist,
  SAMPLE_WEEKLY_MARKDOWN,
  sanitizeTrainingPlan,
} from "./trainingPlan";
import type {
  AthleteProfile,
  Attempt,
  EvaluationRecord,
  EventType,
  ExerciseCategory,
  ExerciseGuide,
  TodoProgress,
  TodoSectionPreference,
  TrainingDayPlan,
  TrainingPlanTemplate,
  TrainingSection,
  TrainingTodoItem,
  UserRole,
} from "./types";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type { AuthSession } from "./supabaseClient";

type ViewId = "dashboard" | "todo" | EventType | "comparison" | "videos" | "profile" | "admin";

interface ActiveEvaluation {
  eventType: EventType;
  testId: string;
  recordId?: string;
  video: RecordingResult | null;
}

const MAX_RECORDING_MS = 90_000;
const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("App root not found.");
}

const app = appRoot;

let profile: AthleteProfile | null = null;
let evaluations: EvaluationRecord[] = [];
let legacyAttempts: Attempt[] = [];
let trainingPlan: TrainingPlanTemplate | null = null;
let todoProgress: TodoProgress[] = [];
let todoSectionPreferences: TodoSectionPreference[] = [];
let activeView: ViewId = "dashboard";
let authSession: AuthSession | null = null;
let authMode: "sign-in" | "sign-up" = "sign-in";
let authDraftEmail = "";
let authDraftUsername = "";
let authDraftDob = "";
let authDraftEvents: EventType[] = ["long-jump", "triple-jump"];
let authDraftRole: UserRole = "athlete";
let authDraftMorning = false;
let authError = "";
let authMessage = "";
let authBusy = false;
let activeEvaluation: ActiveEvaluation | null = null;
let activeGuideId: string | null = null;
let guideEditMode = false;
let selectedWeek = 1;
let selectedDayId = findCurrentDayId();
let notice = "";
let showAuthScreenExplicitly = false;
let mobileMenuOpen = false;
let workoutModalOpen = false;
let workoutModalDayId = "monday";
let workoutModalSectionTitle = "Dynamic Warm-Up";
let workoutModalAssignTo = "all";
let markdownModalOpen = false;
let adminTab: "students" | "workouts" | "analysis" = "students";
let squadAthletes: AthleteProfile[] = [];
let selectedAthleteFilter = "all";
let activeStudentUsername: string | null = null;

function isCoach(): boolean {
  if (!profile) return false;
  return profile.role === "coach";
}

let currentStream: MediaStream | null = null;
let currentRecording: RecordingController | null = null;
let currentPreviewUrl: string | null = null;
let cameraFacing: "user" | "environment" = "environment";
let countdownTimer: number | null = null;
let recordStartedAt = 0;
let isCancellingRecording = false;
let renderedVideoUrls: string[] = [];

function generateDemoEvaluations(): EvaluationRecord[] {
  const now = new Date();
  const recs: EvaluationRecord[] = [];
  let i = 0;

  const add = (
    eventType: EventType,
    testId: string,
    inputs: Record<string, number>,
    daysAgo: number
  ) => {
    const def = getTestDefinition(eventType, testId);
    if (!def) return;
    const calcResult = def.calculate(inputs);
    recs.push({
      id: `demo-${i++}`,
      eventType,
      testId,
      createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
      inputs,
      resultValue: calcResult.value,
      resultUnit: calcResult.unit,
      score: calcResult.score,
      zScore: calcResult.zScore,
      rating: calcResult.rating,
    });
  };

  // ── Long Jump demos ──
  add("long-jump", "cmj", { standingReachCm: 220, jumpTouchCm: 305 }, 2);
  add("long-jump", "standing-broad", { bestDistanceCm: 265 }, 3);
  add("long-jump", "sprint-30m", { timeSec: 4.12 }, 1);
  add("long-jump", "five-stride-lj", { distanceM: 5.10 }, 4);
  add("long-jump", "takeoff-accuracy", { averageMissCm: 4.2 }, 5);
  add("long-jump", "standing-triple", { distanceM: 8.20 }, 6);
  add("long-jump", "five-bound", { distanceM: 13.80 }, 7);

  // Older long-jump attempts for progression
  add("long-jump", "cmj", { standingReachCm: 218, jumpTouchCm: 295 }, 25);
  add("long-jump", "standing-broad", { bestDistanceCm: 250 }, 22);
  add("long-jump", "sprint-30m", { timeSec: 4.35 }, 20);
  add("long-jump", "five-stride-lj", { distanceM: 4.70 }, 18);

  // ── Triple Jump demos ──
  add("triple-jump", "cmj", { standingReachCm: 220, jumpTouchCm: 305 }, 2);
  add("triple-jump", "standing-triple", { distanceM: 9.10 }, 3);
  add("triple-jump", "single-leg-hop", { leftHopCm: 180, rightHopCm: 175 }, 4);
  add("triple-jump", "sprint-30m", { timeSec: 4.12 }, 1);
  add("triple-jump", "phase-balance", { hopM: 5.10, stepM: 4.30, jumpM: 5.00 }, 5);
  add("triple-jump", "five-bound", { distanceM: 14.50 }, 6);
  add("triple-jump", "hop-step-ratio", { hopM: 5.10, stepM: 4.30 }, 7);

  // Older triple-jump attempts
  add("triple-jump", "standing-triple", { distanceM: 8.40 }, 21);
  add("triple-jump", "phase-balance", { hopM: 4.80, stepM: 3.90, jumpM: 4.50 }, 19);
  add("triple-jump", "sprint-30m", { timeSec: 4.30 }, 17);

  return recs;
}

async function loadDemoData(): Promise<void> {
  const demoProfile: AthleteProfile = {
    id: "local-athlete",
    username: "alex_jumper",
    dob: "2002-05-14",
    events: ["long-jump", "triple-jump"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveProfile(demoProfile);
  profile = demoProfile;

  const defaultPlan = trainingPlan ?? createDefaultTrainingPlan();
  await saveTrainingPlan(defaultPlan);
  trainingPlan = defaultPlan;

  const demoRecs = generateDemoEvaluations();
  for (const rec of demoRecs) {
    await saveEvaluation(rec);
  }
  evaluations = await listEvaluations();
  showAuthScreenExplicitly = false;
  activeView = "dashboard";
  notice = "Demo athlete loaded with sample long jump and triple jump records.";
  render();
}

void init();

async function init(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<{ data: { session: null }; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("Supabase auth timeout")), 6000)
      );
      const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);
      if (error) {
        authError = error.message;
      }
      authSession = data?.session ?? null;
    } catch {
      console.warn("Supabase initial getSession timed out or bypassed. Listening for auth state changes.");
      authSession = null;
    }

    try {
      supabase.auth.onAuthStateChange(async (_event, session) => {
        const wasSession = authSession;
        authSession = session;
        if (session && (!wasSession || wasSession.user.id !== session.user.id)) {
          await syncAccountAndReload();
        } else if (!session && wasSession) {
          render();
        }
      });
    } catch (e) {
      console.warn("Could not register onAuthStateChange listener:", e);
    }
  }

  await loadLocalState({ saveDefaultTrainingPlan: false });

  if (authSession) {
    await syncAccountAndReload();
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // Real-time listener: Push newly added/updated workouts instantly to other connected users
      supabase
        .channel("realtime-training-plans")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "training_plans" },
          async () => {
            const isCoach = profile?.role === "coach";
            if (!isCoach) {
              const latest = await fetchLatestSquadTrainingPlan();
              if (latest) {
                trainingPlan = sanitizeTrainingPlan(latest);
                await saveTrainingPlan(trainingPlan);
                render();
              }
            }
          }
        )
        .subscribe();

      // Window focus listener: Sync workouts when tab is focused
      window.addEventListener("focus", () => {
        if (profile?.role !== "coach") {
          void fetchLatestSquadTrainingPlan().then(async (latest) => {
            if (latest) {
              trainingPlan = sanitizeTrainingPlan(latest);
              await saveTrainingPlan(trainingPlan);
              render();
            }
          });
        }
      });
    } catch (realtimeErr) {
      console.warn("Could not setup realtime training plans subscription:", realtimeErr);
    }
  }

  render();
}

async function loadLocalState(options: { saveDefaultTrainingPlan: boolean }): Promise<void> {
  profile = (await getProfile()) ?? null;
  if (profile && !profile.role) {
    profile.role = "athlete";
  }
  evaluations = await listEvaluations();
  legacyAttempts = await listAttempts();

  const cachedTrainingPlan = await getTrainingPlan();
  const rawPlan = cachedTrainingPlan ?? createDefaultTrainingPlan();
  trainingPlan = sanitizeTrainingPlan(rawPlan);
  if ((!cachedTrainingPlan && options.saveDefaultTrainingPlan) || isLegacyDefaultPlan(rawPlan)) {
    await saveTrainingPlan(trainingPlan);
  }

  todoProgress = await listTodoProgress(trainingPlan.id);
  todoSectionPreferences = await listTodoSectionPreferences();
  await loadSquadAthletes();
}

async function loadSquadAthletes(): Promise<void> {
  let list: AthleteProfile[] = [];

  const isRealAthlete = (a: AthleteProfile) =>
    Boolean(
      a &&
      a.username &&
      a.role !== "coach" &&
      (!profile || profile.role !== "coach" || a.username.toLowerCase() !== profile.username.toLowerCase())
    );

  if (supabase) {
    try {
      const cloudProfiles = await fetchAllSquadProfiles();
      list = cloudProfiles.filter(isRealAthlete);
    } catch (err) {
      console.warn("Could not fetch squad athletes from cloud:", err);
      list = [];
    }
  }

  // Ensure any legacy local storage fallback is removed
  try {
    localStorage.removeItem("win:squad-athletes");
  } catch {
    // Ignore storage errors
  }

  squadAthletes = list;

  if (
    activeStudentUsername &&
    !squadAthletes.some((a) => a.username.toLowerCase() === activeStudentUsername!.toLowerCase())
  ) {
    activeStudentUsername = null;
  }
}

async function toggleAthleteMorningSessions(username: string): Promise<void> {
  const athlete = squadAthletes.find((a) => a.username.toLowerCase() === username.toLowerCase());
  if (!athlete) return;

  athlete.morningSessionsEnabled = !athlete.morningSessionsEnabled;
  athlete.updatedAt = new Date().toISOString();

  if (profile && profile.username.toLowerCase() === username.toLowerCase()) {
    profile.morningSessionsEnabled = athlete.morningSessionsEnabled;
    await saveProfile(profile);
  }

  if (authSession && supabase) {
    void updateSquadAthleteProfile(athlete.id, {
      morningSessionsEnabled: athlete.morningSessionsEnabled,
    });
  }

  notice = `Morning training ${athlete.morningSessionsEnabled ? "enabled" : "disabled"} for @${athlete.username}.`;
  render();
}

async function syncAccountAndReload(options: { resetLocalCache?: boolean } = {}): Promise<void> {
  if (!authSession) return;

  try {
    await synchronizeUserData(authSession.user.id, options);
    await loadLocalState({ saveDefaultTrainingPlan: true });
    notice = "";
    authError = "";
    authMessage = "";
  } catch (errorValue) {
    console.error(errorValue);
    await loadLocalState({ saveDefaultTrainingPlan: true });
    notice = "Loaded local cache. Cloud sync failed; check Supabase setup and RLS.";
  }
}

function render(): void {
  cleanupRenderedVideoUrls();

  if (showAuthScreenExplicitly || (!authSession && !profile)) {
    app.innerHTML = renderAuthScreen();
    bindAuthScreen();
    return;
  }

  if (!profile) {
    app.innerHTML = renderOnboarding();
    bindOnboarding();
    return;
  }

  if (activeEvaluation) {
    app.innerHTML = renderAppShell(renderEvaluationView(activeEvaluation));
    bindAppShell();
    bindEvaluationView(activeEvaluation);
    updateRecorderUi("No video evidence attached.");
    return;
  }

  if (
    (activeView === "long-jump" || activeView === "triple-jump") &&
    !profile.events.includes(activeView)
  ) {
    activeView = "dashboard";
  }

  app.innerHTML = renderAppShell(renderCurrentView());
  bindAppShell();

  if (activeView === "profile") {
    bindProfileView();
  }

  if (activeView === "todo") {
    bindTodoView();
  }

  if (activeView === "admin") {
    bindAdminView();
  }
}



function renderRoleChoiceFields(defaultRole: UserRole = "athlete", defaultMorning: boolean = false): string {
  return `
    <div class="role-select-group">
      <span class="field-legend">Select Account Role</span>
      <div class="role-choice-grid">
        <label class="role-choice-card">
          <input type="radio" name="role" value="athlete" ${defaultRole === "athlete" ? "checked" : ""} />
          <div class="role-card-inner">
            <span class="role-emoji">🏃‍♂️</span>
            <div class="role-text">
              <strong>Athlete / Student</strong>
              <small>View training schedule, check off exercises & track test PRs</small>
            </div>
          </div>
        </label>
        <label class="role-choice-card">
          <input type="radio" name="role" value="coach" ${defaultRole === "coach" ? "checked" : ""} />
          <div class="role-card-inner">
            <span class="role-emoji">📋</span>
            <div class="role-text">
              <strong>Coach / Admin</strong>
              <small>Prescribe workouts, import weekly markdown & squad stats</small>
            </div>
          </div>
        </label>
      </div>
    </div>

    <label class="morning-session-toggle-label">
      <input type="checkbox" name="morningSessionsEnabled" ${defaultMorning ? "checked" : ""} />
      <span>🌅 Enable Morning Training Sessions (AM mobility & activation)</span>
    </label>
  `;
}

function renderAuthScreen(): string {
  const isSignUp = authMode === "sign-up";
  const title = isSignUp ? "Create your WIN account" : "Sign in to WIN";
  const submitLabel = authBusy ? "Working..." : isSignUp ? "Create account" : "Sign in";
  const swapLabel = isSignUp ? "Use an existing account" : "Create a new account";
  const profileFields = isSignUp
    ? `
        <label class="field">
          <span>Username</span>
          <input id="auth-username" name="username" type="text" autocomplete="username" value="${escapeAttribute(authDraftUsername)}" placeholder="e.g. jumper_99" required />
        </label>

        <label class="field">
          <span>Date of birth</span>
          <input id="auth-dob" name="dob" type="date" value="${escapeAttribute(authDraftDob)}" required />
        </label>

        <fieldset class="event-select">
          <legend>Events</legend>
          ${renderEventChoice("long-jump", authDraftEvents.includes("long-jump"))}
          ${renderEventChoice("triple-jump", authDraftEvents.includes("triple-jump"))}
        </fieldset>

        ${renderRoleChoiceFields(authDraftRole, authDraftMorning)}
      `
    : "";

  return `
    <main class="onboarding-shell auth-shell">
      <section class="onboarding-copy">
        <p class="eyebrow">WIN Jumper Lab</p>
        <h1>Track power, technique, and progress.</h1>
        <p class="lead">Sign in to sync your data across devices, or continue offline on this device. Videos always remain securely stored locally.</p>
      </section>

      <form class="onboarding-form auth-form" id="auth-form" novalidate>
        <div>
          <p class="eyebrow">Supabase Cloud</p>
          <h2>${title}</h2>
        </div>

        <label class="field">
          <span>Email</span>
          <input id="auth-email" name="email" type="email" autocomplete="email" value="${escapeAttribute(authDraftEmail)}" placeholder="you@example.com" required />
        </label>

        <label class="field">
          <span>Password</span>
          <input id="auth-password" name="password" type="password" autocomplete="${isSignUp ? "new-password" : "current-password"}" minlength="6" required />
        </label>

        ${profileFields}

        ${authMessage ? `<p class="auth-message">${escapeHtml(authMessage)}</p>` : ""}
        <p class="form-error" id="auth-error" role="alert">${escapeHtml(authError)}</p>

        <button class="primary-action" type="submit" ${authBusy ? "disabled" : ""}>${submitLabel}</button>
        <button class="ghost-action" type="button" data-auth-mode="${isSignUp ? "sign-in" : "sign-up"}" ${authBusy ? "disabled" : ""}>
          ${swapLabel}
        </button>

        <div class="auth-divider"><span>OR CONTINUE OFFLINE</span></div>

        <div class="offline-options">
          <button class="ghost-action" type="button" data-offline-mode>
            ${profile ? "Return to Local Profile" : "Continue as Guest Athlete"}
          </button>
          <button class="ghost-action" type="button" data-load-demo>
            Load Sample Athlete & Demo Data
          </button>
        </div>
      </form>
    </main>
  `;
}

function renderOnboarding(): string {
  return `
    <main class="onboarding-shell">
      <section class="onboarding-copy">
        <p class="eyebrow">WIN account setup</p>
        <h1>Jumper evaluation, built for field testing.</h1>
        <p class="lead">${
          authSession
            ? "Finish your account profile. This creates the Supabase profile used on every device."
            : "Set up your local athlete profile. All data is saved directly on your device in IndexedDB."
        }</p>
      </section>

      <form class="onboarding-form" id="onboarding-form" novalidate>
        <div>
          <p class="eyebrow">${authSession ? "Account profile" : "Local athlete"}</p>
          <h2>Set up jumper</h2>
        </div>

        <label class="field">
          <span>Username</span>
          <input id="profile-setup-username" name="username" type="text" autocomplete="username" placeholder="e.g. jumper_99" required />
        </label>

        <label class="field">
          <span>Date of birth</span>
          <input id="profile-setup-dob" name="dob" type="date" required />
        </label>

        <fieldset class="event-select">
          <legend>Events</legend>
          ${renderEventChoice("long-jump", true)}
          ${renderEventChoice("triple-jump", true)}
        </fieldset>

        ${renderRoleChoiceFields("athlete", false)}

        <p class="form-error" id="onboarding-error" role="alert"></p>
        <button class="primary-action" type="submit">Create profile</button>
        <button class="ghost-action" type="button" data-back-to-auth>Back to cloud sign in</button>
      </form>
    </main>
  `;
}


function renderEventChoice(eventType: EventType, checked: boolean): string {
  return `
    <label class="event-choice">
      <input type="checkbox" name="events" value="${eventType}" ${checked ? "checked" : ""} />
      <span>
        <strong>${EVENT_LABELS[eventType]}</strong>
        <small>${EVENT_KICKERS[eventType]}</small>
      </span>
    </label>
  `;
}

function renderAppShell(content: string): string {
  if (!profile) return content;

  return `
    <div class="app-shell">
      <!-- Desktop Sidebar (Hidden on mobile) -->
      <aside class="sidebar">
        <div class="brand-block">
          <span class="brand-mark">WIN</span>
          <span class="brand-subtitle">Jumper Lab</span>
        </div>

        <nav class="side-nav" aria-label="Main navigation">
          ${renderNavButton("dashboard", "Dashboard")}
          ${isCoach() ? renderNavButton("admin", "Admin Hub") : ""}
          ${renderNavButton("todo", "Todo")}
          ${profile.events.includes("long-jump") ? renderNavButton("long-jump", "Long Jump") : ""}
          ${profile.events.includes("triple-jump") ? renderNavButton("triple-jump", "Triple Jump") : ""}
          ${renderNavButton("comparison", "Comparison")}
          ${renderNavButton("videos", "Videos")}
          ${renderNavButton("profile", "Profile")}
        </nav>

        <div class="profile-chip">
          <div class="profile-chip-user-row">
            <span>@${escapeHtml(profile.username)}</span>
            ${isCoach() ? `<span class="coach-tag">Coach</span>` : `<span class="athlete-tag">Athlete</span>`}
          </div>
          <small>${profile.events.map((eventType) => EVENT_LABELS[eventType]).join(" / ")}</small>
          <small>${escapeHtml(authSession?.user.email ?? "Synced account")}</small>
          ${
            authSession
              ? `<button class="sidebar-signout" type="button" data-sign-out>Sign out</button>`
              : ""
          }
        </div>
      </aside>

      <!-- Mobile Top Header (Sticky on mobile) -->
      <header class="mobile-header">
        <div class="mobile-brand" data-view="dashboard" role="button" tabindex="0">
          <span class="brand-mark">WIN</span>
          <span class="brand-subtitle">Jumper Lab</span>
          ${isCoach() ? `<span class="coach-tag mobile-tag">Coach</span>` : ""}
        </div>
        <div class="mobile-header-actions">
          <button class="mobile-profile-pill" type="button" data-view="profile" title="View profile">
            <span class="mobile-avatar-circle">${escapeHtml(profile.username.charAt(0).toUpperCase())}</span>
            <span class="mobile-username">@${escapeHtml(profile.username)}</span>
          </button>
          <button class="mobile-menu-btn" type="button" data-toggle-mobile-menu aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>

      <main class="workspace">
        ${notice ? `<div class="notice"><span>${escapeHtml(notice)}</span><button class="notice-dismiss" type="button" data-dismiss-notice aria-label="Dismiss">✕</button></div>` : ""}
        ${content}
      </main>

      <!-- Mobile Bottom Navigation Bar (Fixed thumb-friendly dock) -->
      ${renderMobileBottomNav()}

      <!-- Mobile Navigation Drawer -->
      ${renderMobileDrawer()}

      ${renderGuideDrawer()}
      ${renderWorkoutModal()}
      ${renderMarkdownModal()}
    </div>
  `;
}

function renderNavButton(view: ViewId, label: string): string {
  const active = !activeEvaluation && activeView === view;
  return `
    <button class="nav-button ${active ? "is-active" : ""}" type="button" data-view="${view}" ${active ? 'aria-current="page"' : ""}>
      ${label}
    </button>
  `;
}

function renderMobileBottomNav(): string {
  if (!profile) return "";

  const hasLJ = profile.events.includes("long-jump");
  const hasTJ = profile.events.includes("triple-jump");

  return `
    <nav class="mobile-bottom-nav" aria-label="Mobile navigation bar">
      ${renderMobileNavButton("dashboard", "Dashboard", `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      `)}
      ${renderMobileNavButton("todo", "Todo", `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
      `)}
      ${hasLJ ? renderMobileNavButton("long-jump", hasTJ ? "LJ" : "Long Jump", `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="4" r="2"></circle>
          <path d="M5 21l6-9-3-2 3-5 5 4 3-2"></path>
          <path d="M12 12l2 9"></path>
        </svg>
      `) : ""}
      ${hasTJ ? renderMobileNavButton("triple-jump", hasLJ ? "TJ" : "Triple Jump", `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      `) : (!hasLJ ? renderMobileNavButton("videos", "Videos", `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
      `) : "")}
      <button class="mobile-nav-btn ${mobileMenuOpen ? "is-active" : ""}" type="button" data-toggle-mobile-menu aria-label="Open more navigation options">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1.5"></circle>
          <circle cx="19" cy="12" r="1.5"></circle>
          <circle cx="5" cy="12" r="1.5"></circle>
        </svg>
        <span>More</span>
      </button>
    </nav>
  `;
}

function renderMobileNavButton(view: ViewId, label: string, iconSvg: string): string {
  const active = !mobileMenuOpen && !activeEvaluation && activeView === view;
  return `
    <button class="mobile-nav-btn ${active ? "is-active" : ""}" type="button" data-view="${view}" ${active ? 'aria-current="page"' : ""}>
      ${iconSvg}
      <span>${label}</span>
    </button>
  `;
}

function renderMobileDrawer(): string {
  if (!profile || !mobileMenuOpen) return "";

  return `
    <div class="mobile-drawer-backdrop" data-close-mobile-menu></div>
    <aside class="mobile-drawer" aria-label="Navigation menu drawer">
      <div class="mobile-drawer-header">
        <div class="mobile-drawer-user">
          <div class="mobile-avatar-circle large">${escapeHtml(profile.username.charAt(0).toUpperCase())}</div>
          <div class="mobile-drawer-meta">
            <strong>@${escapeHtml(profile.username)}</strong>
            <small>${profile.events.map((eventType) => EVENT_LABELS[eventType]).join(" / ")}</small>
            <span class="mobile-drawer-email">${escapeHtml(authSession?.user.email ?? "Guest account")}</span>
          </div>
        </div>
        <button class="mobile-drawer-close" type="button" data-close-mobile-menu aria-label="Close menu">✕</button>
      </div>

      <div class="mobile-drawer-section-title">Navigation</div>
      <nav class="mobile-drawer-links">
        ${isCoach() ? `
          <button class="mobile-drawer-link ${activeView === "admin" ? "is-active" : ""}" type="button" data-view="admin">
            <span class="drawer-icon">⚡</span>
            <div class="drawer-text">
              <strong>Coach Admin Hub</strong>
              <small>Manage workouts & stats analysis</small>
            </div>
          </button>
        ` : ""}

        <button class="mobile-drawer-link ${activeView === "dashboard" ? "is-active" : ""}" type="button" data-view="dashboard">
          <span class="drawer-icon">🏠</span>
          <div class="drawer-text">
            <strong>Dashboard</strong>
            <small>Overview, PRs & records</small>
          </div>
        </button>

        <button class="mobile-drawer-link ${activeView === "todo" ? "is-active" : ""}" type="button" data-view="todo">
          <span class="drawer-icon">📋</span>
          <div class="drawer-text">
            <strong>Daily Training Plan</strong>
            <small>Workouts & checklist</small>
          </div>
        </button>

        ${profile.events.includes("long-jump") ? `
          <button class="mobile-drawer-link ${activeView === "long-jump" ? "is-active" : ""}" type="button" data-view="long-jump">
            <span class="drawer-icon">🥇</span>
            <div class="drawer-text">
              <strong>Long Jump</strong>
              <small>Tests & composite score</small>
            </div>
          </button>
        ` : ""}

        ${profile.events.includes("triple-jump") ? `
          <button class="mobile-drawer-link ${activeView === "triple-jump" ? "is-active" : ""}" type="button" data-view="triple-jump">
            <span class="drawer-icon">🥉</span>
            <div class="drawer-text">
              <strong>Triple Jump</strong>
              <small>Tests & composite score</small>
            </div>
          </button>
        ` : ""}

        <button class="mobile-drawer-link ${activeView === "comparison" ? "is-active" : ""}" type="button" data-view="comparison">
          <span class="drawer-icon">⚖️</span>
          <div class="drawer-text">
            <strong>Comparison</strong>
            <small>Side-by-side jump metrics</small>
          </div>
        </button>

        <button class="mobile-drawer-link ${activeView === "videos" ? "is-active" : ""}" type="button" data-view="videos">
          <span class="drawer-icon">🎥</span>
          <div class="drawer-text">
            <strong>Video Archive</strong>
            <small>Recorded jump attempts</small>
          </div>
        </button>

        <button class="mobile-drawer-link ${activeView === "profile" ? "is-active" : ""}" type="button" data-view="profile">
          <span class="drawer-icon">👤</span>
          <div class="drawer-text">
            <strong>Profile & Targets</strong>
            <small>Athlete info & target marks</small>
          </div>
        </button>
      </nav>

      <div class="mobile-drawer-footer">
        ${
          authSession
            ? `<button class="sidebar-signout" type="button" data-sign-out>Sign out</button>`
            : `<button class="sidebar-signout" type="button" data-view="profile">Account Settings</button>`
        }
      </div>
    </aside>
  `;
}

function renderCurrentView(): string {
  if (!profile) return "";

  switch (activeView) {
    case "admin":
      return renderAdminView();
    case "todo":
      return renderTodoView();
    case "long-jump":
    case "triple-jump":
      return renderEventView(activeView);
    case "comparison":
      return renderComparisonView();
    case "videos":
      return renderVideosView();
    case "profile":
      return renderProfileView();
    case "dashboard":
    default:
      return renderDashboard();
  }
}

function renderDashboard(): string {
  if (!profile) return "";

  const eventCards = profile.events
    .map((eventType) => renderEventCard(eventType))
    .join("");
  const videosCount =
    evaluations.filter((record) => Boolean(record.video)).length +
    legacyAttempts.filter((attempt) => Boolean(attempt.video)).length;
  const records = renderPersonalRecords();

  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Dashboard</p>
        <h1>@${escapeHtml(profile.username)}</h1>
        <p class="lead">Latest event ranks, test coverage, and statistical direction.</p>
      </div>
      <div class="header-metrics">
        ${renderMiniMetric("Evaluations", String(evaluations.length))}
        ${renderMiniMetric("Videos", String(videosCount))}
        ${renderMiniMetric("Events", String(profile.events.length))}
      </div>
    </section>

    ${records}

    <section class="event-grid">
      ${eventCards}
    </section>
  `;
}

function renderPersonalRecords(): string {
  const allTests = profile
    ? profile.events.flatMap((eventType) =>
        getEventTests(eventType).map((test) => ({ eventType, test }))
      )
    : [];

  const records = allTests
    .map(({ eventType, test }) => {
      const stats = calculateTestStats(recordsForTest(eventType, test.id));
      if (!stats.bestScore) return null;
      const rank = getRankForScore(stats.bestScore);
      const latest = stats.latest;
      const isCurrentBest =
        latest && stats.bestScore === latest.score && stats.count > 0;
      return { eventType, test, stats, rank, isCurrentBest };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => (b.stats.bestScore ?? 0) - (a.stats.bestScore ?? 0))
    .slice(0, 6);

  if (records.length === 0) {
    return `
      <section class="event-overview" style="margin-bottom:1.25rem">
        <div class="form-heading">
          <p class="eyebrow">Personal records</p>
          <h2 style="margin-bottom:0.3rem">No records yet</h2>
          <span>Log an evaluation to start tracking personal bests.</span>
        </div>
      </section>
    `;
  }

  const cards = records
    .map((entry) => {
      return `
        <div class="pr-card">
          <p class="eyebrow">${EVENT_LABELS[entry.eventType]}</p>
          <strong>${entry.test.shortTitle}</strong>
          <div class="pr-score">${entry.stats.bestScore}<span>/100</span></div>
          <div>${renderRankChip(entry.rank)}</div>
          ${entry.isCurrentBest ? `<small class="pr-flag">current best</small>` : `<small class="muted">${entry.stats.count} logged</small>`}
        </div>
      `;
    })
    .join("");

  return `
    <section class="pr-strip">
      <span class="section-label">Personal records</span>
      <div class="pr-grid">
        ${cards}
      </div>
    </section>
  `;
}

function renderEventCard(eventType: EventType): string {
  const summary = calculateEventSummary(eventType, evaluations);
  const score = summary.score;
  const rank = getRankForScore(score);
  const strengths = renderContributionList(summary.strengths, "No strengths yet");
  const gaps = renderContributionList(summary.gaps, "No gaps yet");
  const ratingLabel = summary.rating ?? "No data";
  const completenessLine =
    summary.totalTests > 0
      ? `${summary.completedTests}/${summary.totalTests} tests logged`
      : "No tests logged yet";

  return `
    <article class="event-card">
      <div class="event-card-header">
        <div>
          <p class="eyebrow">${summary.completeness === 100 ? "Complete rating" : "Provisional rating"}</p>
          <h2>${EVENT_LABELS[eventType]}</h2>
          <p>${EVENT_KICKERS[eventType]}</p>
          <div class="event-card-meta">
            ${renderRankChip(rank)}
            <span class="rank-progress-label-inline" style="color:var(--text-muted);font-size:0.82rem">${escapeHtml(ratingLabel)} · ${completenessLine}</span>
          </div>
        </div>
        ${renderScoreGauge(score, true)}
      </div>

      ${renderRankProgress(rank)}

      <div class="split-summary">
        <div>
          <span class="section-label">Strengths</span>
          ${strengths}
        </div>
        <div>
          <span class="section-label">Gaps</span>
          ${gaps}
        </div>
      </div>

      <button class="secondary-action" type="button" data-view="${eventType}">
        Open ${EVENT_LABELS[eventType]}
      </button>
    </article>
  `;
}

function isItemVisibleForAthlete(item: TrainingTodoItem, filterAthlete: string): boolean {
  if (filterAthlete === "all") return true;
  if (!item.assignedTo || item.assignedTo === "all" || item.assignedTo === "squad") return true;
  return item.assignedTo.toLowerCase() === filterAthlete.toLowerCase();
}

function countAthleteWorkouts(plan: TrainingPlanTemplate | null, username: string): number {
  if (!plan) return 0;
  const target = username.toLowerCase();
  let count = 0;
  for (const d of plan.days) {
    for (const s of d.sections) {
      for (const item of s.items) {
        if (item.assignedTo && item.assignedTo.toLowerCase() === target) {
          count++;
        }
      }
    }
  }
  for (const item of plan.dailyChecklist) {
    if (item.assignedTo && item.assignedTo.toLowerCase() === target) {
      count++;
    }
  }
  return count;
}

function isMorningSection(section: TrainingSection): boolean {
  return (
    /morning|am\s*session|early\s*activation/i.test(section.title) ||
    section.items.some((i: TrainingTodoItem) => i.sessionType === "morning")
  );
}

function renderTodoView(): string {
  if (!trainingPlan) return "";

  const day = trainingPlan.days.find((candidate) => candidate.id === selectedDayId) ?? trainingPlan.days[0];
  if (!day) return "";

  const coachMode = isCoach();
  const effectiveAthleteFilter = coachMode ? selectedAthleteFilter : (profile?.username ?? "all");

  const targetAthleteProfile = coachMode && selectedAthleteFilter !== "all"
    ? squadAthletes.find((a) => a.username.toLowerCase() === selectedAthleteFilter.toLowerCase())
    : profile;
  const athleteHasMorning = Boolean(targetAthleteProfile?.morningSessionsEnabled);

  const phase = getPhaseForWeek(trainingPlan, selectedWeek);
  const visibleIds = collectVisibleProgressIds(trainingPlan, day, phase, effectiveAthleteFilter);
  const completedCount = visibleIds.filter((id) => isTodoComplete(id)).length;
  const completion = visibleIds.length > 0 ? Math.round((completedCount / visibleIds.length) * 100) : 0;
  const guideCount = Object.keys(trainingPlan.exerciseGuides).length;

  const dayAllItems = day.sections
    .flatMap((s) => s.items)
    .filter((i) => isItemVisibleForAthlete(i, effectiveAthleteFilter));
  const dayTotalExercises = dayAllItems.length;
  const dayCompletedExercises = dayAllItems.filter((item) => {
    return day.sections.some((s) =>
      isTodoComplete(makeProgressId(`week-${selectedWeek}-${day.id}-${s.id}`, item.id))
    );
  }).length;

  const morningSections = day.sections.filter((s) => isMorningSection(s));
  const mainSections = day.sections.filter((s) => !isMorningSection(s));

  return `
    <section class="page-header">
      <div>
        <div class="todo-title-row">
          <p class="eyebrow">Training Schedule</p>
          ${coachMode ? `<span class="coach-tag">Coach Editing Mode</span>` : `<span class="athlete-tag">Athlete Mode (View & Mark Done)</span>`}
        </div>
        <h1>${escapeHtml(trainingPlan.title)}</h1>
        <p class="lead">${escapeHtml(trainingPlan.trainingTime)} | ${escapeHtml(trainingPlan.targetPeriod)}</p>
      </div>
      <div class="header-metrics">
        ${renderMiniMetric("Complete", `${completion}%`)}
        ${renderMiniMetric("Guides", String(guideCount))}
        ${renderMiniMetric("Items", String(countPlanItems(trainingPlan)))}
      </div>
    </section>

    ${coachMode ? `
      <!-- Coach Athlete Filter Bar -->
      <section class="todo-coach-filter-bar">
        <div class="todo-coach-filter-left">
          <span class="filter-icon">👤</span>
          <div>
            <strong>Athlete Schedule View:</strong>
            <small class="muted" style="display:block; font-size:0.75rem;">Switch between squad-wide workouts and individual athlete schedules</small>
          </div>
        </div>
        <div class="todo-coach-filter-right">
          <select id="todo-athlete-filter" class="todo-coach-filter-select" aria-label="Filter schedule by student athlete">
            <option value="all" ${selectedAthleteFilter === "all" ? "selected" : ""}>👥 Entire Squad (All Workouts)</option>
            ${squadAthletes.map(a => `<option value="${escapeAttribute(a.username)}" ${selectedAthleteFilter.toLowerCase() === a.username.toLowerCase() ? "selected" : ""}>🏃 @${escapeHtml(a.username)} (${a.morningSessionsEnabled ? "🌅 AM active" : "PM only"})</option>`).join("")}
          </select>
          ${selectedAthleteFilter !== "all" ? `
            <button class="ghost-action compact-btn" type="button" data-reset-athlete-filter title="Clear filter">
              ✕ Clear
            </button>
          ` : ""}
        </div>
      </section>
    ` : ""}

    <!-- Sleek, balanced toolbar (No squished select, clean mobile buttons) -->
    <section class="todo-controls-bar">
      <div class="week-picker-pill">
        <span class="week-picker-label">Schedule Week</span>
        <select id="week-select" class="week-picker-select" aria-label="Select training week">
          ${Array.from({ length: 12 }, (_, index) => {
            const week = index + 1;
            return `<option value="${week}" ${week === selectedWeek ? "selected" : ""}>Week ${week}</option>`;
          }).join("")}
        </select>
      </div>

      ${coachMode ? `
        <div class="coach-quick-actions">
          <button class="primary-action compact-btn coach-action-btn" type="button" data-open-add-workout data-day-id="${escapeAttribute(day.id)}">
            <span class="btn-icon">＋</span> Add Workout
          </button>
          <button class="secondary-action compact-btn coach-action-btn" type="button" id="push-schedule-to-cloud-btn-todo" title="Push current workouts to squad devices">
            <span class="btn-icon">☁️</span> Push to Squad
          </button>
          <button class="ghost-action compact-btn coach-action-btn" type="button" data-open-markdown-modal title="Import weekly markdown schedule or upload .md">
            <span class="btn-icon">📝</span> Import Week (.md)
          </button>
        </div>
      ` : `
        <div class="athlete-info-pill" style="display:flex;gap:0.6rem;align-items:center;">
          <span>✓ View exercises & check off as completed</span>
          <button class="ghost-action compact-btn" type="button" id="refresh-athlete-schedule-btn" title="Sync workouts from coach">
            🔄 Sync Workouts
          </button>
        </div>
      `}
    </section>

    <section class="day-tabs" aria-label="Training days">
      ${trainingPlan.days
        .map(
          (candidate) => `
            <button class="day-tab ${candidate.id === day.id ? "is-active" : ""}" type="button" data-day-id="${candidate.id}">
              ${candidate.name}
              ${candidate.sections.some(s => s.items.filter(i => isItemVisibleForAthlete(i, effectiveAthleteFilter)).length > 0) ? '<span class="day-has-items-dot"></span>' : ''}
            </button>
          `
        )
        .join("")}
    </section>

    <section class="todo-layout">
      <div class="todo-main">
        <article class="todo-day-card">
          <div class="todo-card-header">
            <div>
              <div class="day-eyebrow-row">
                <p class="eyebrow">Week ${selectedWeek} | ${escapeHtml(day.name)}</p>
                ${athleteHasMorning ? `<span class="morning-active-tag">🌅 Morning Enabled</span>` : ""}
                ${selectedAthleteFilter !== "all" && coachMode ? `<span class="filter-active-tag">Filtered: @${escapeHtml(selectedAthleteFilter)}</span>` : ""}
              </div>
              <h2>${escapeHtml(day.title)}</h2>
              <p class="day-focus-desc">${escapeHtml(day.focus)}</p>
            </div>
            <div class="day-card-badge-box">
              ${dayTotalExercises > 0 ? `
                <div class="day-progress-badge">
                  <span class="day-progress-fraction">${dayCompletedExercises}/${dayTotalExercises}</span>
                  <span class="day-progress-label">done</span>
                </div>
              ` : `
                <span class="day-status-chip rest-chip">Rest / Free Day</span>
              `}
            </div>
          </div>
        </article>

        ${dayTotalExercises === 0 && trainingPlan.dailyChecklist.length === 0 ? `
          <div class="empty-day-state-card">
            <div class="empty-day-visual">🏃‍♂️</div>
            <h3>No Workouts Scheduled for ${escapeHtml(day.name)}</h3>
            <p class="muted">${coachMode ? `Plan track exercises, plyometrics, or sprints for ${selectedAthleteFilter !== "all" ? `@${selectedAthleteFilter}` : "your athletes"}.` : "Rest or recovery day. Check the other day tabs for this week's scheduled workouts."}</p>
            ${coachMode ? `
              <div class="empty-day-actions">
                <button class="primary-action compact-btn" type="button" data-open-add-workout data-day-id="${escapeAttribute(day.id)}" data-assign-to="${escapeAttribute(selectedAthleteFilter)}">
                  ＋ Add Workout to ${escapeHtml(day.name)}
                </button>
                <button class="secondary-action compact-btn" type="button" data-open-markdown-modal>
                  📝 Import Week (.md)
                </button>
              </div>
            ` : ""}
          </div>
        ` : ""}

        ${trainingPlan.dailyChecklist.length > 0 ? renderTodoSection("daily", "Daily Training Checklist", trainingPlan.dailyChecklist, undefined, undefined, false, effectiveAthleteFilter) : ""}

        ${morningSections.length > 0 ? `
          <section class="morning-session-container ${!athleteHasMorning && !coachMode ? "is-optional-morning" : ""}">
            <div class="morning-session-banner">
              <div class="morning-banner-title">
                <span class="morning-sun-icon">🌅</span>
                <div>
                  <strong>Morning Training Session</strong>
                  <small>Early mobility, central nervous system activation & core readiness</small>
                </div>
              </div>
              ${!athleteHasMorning && !coachMode ? `
                <span class="morning-status-pill optional">Optional for you</span>
              ` : `
                <span class="morning-status-pill active">Morning Routine</span>
              `}
            </div>
            ${morningSections
              .map((section) => renderTodoSection(`week-${selectedWeek}-${day.id}-${section.id}`, section.title, section.items, section.note, day.id, true, effectiveAthleteFilter))
              .join("")}
          </section>
        ` : (athleteHasMorning && day.sections.length > 0 ? `
          <div class="morning-empty-hint">
            <span>🌅 Morning Sessions Enabled: Focus on hydration & light dynamic mobility today.</span>
          </div>
        ` : "")}

        ${mainSections
          .map((section) => renderTodoSection(`week-${selectedWeek}-${day.id}-${section.id}`, section.title, section.items, section.note, day.id, false, effectiveAthleteFilter))
          .join("")}

        ${phase.items.length > 0 ? renderTodoSection(`phase-${selectedWeek}`, `${phase.weekRange} - ${phase.title}`, phase.items, phase.goal, undefined, false, effectiveAthleteFilter) : ""}
        ${renderImportedSections(trainingPlan, effectiveAthleteFilter)}
      </div>

      <aside class="todo-side">
        ${coachMode ? `
          <article class="todo-info-card coach-quick-builder-card">
            <p class="eyebrow">Coach Quick Actions</p>
            <h3>Manage Schedule</h3>
            <p class="muted">Add workouts to any day or navigate to the Admin Hub for complete squad oversight.</p>
            <div class="coach-quick-btn-group">
              <button class="primary-action" type="button" data-open-add-workout data-day-id="${escapeAttribute(day.id)}" data-assign-to="${escapeAttribute(selectedAthleteFilter)}">
                ＋ Add Workout to ${escapeHtml(day.name)}
              </button>
              <button class="secondary-action" type="button" data-open-add-workout data-day-id="${escapeAttribute(day.id)}" data-section-title="🌅 Morning Session: Activation & Mobility" data-assign-to="${escapeAttribute(selectedAthleteFilter)}">
                🌅 + Add Morning Session
              </button>
              <button class="secondary-action" type="button" data-view="admin">
                Open Admin Hub
              </button>
            </div>
          </article>
        ` : ""}

        <article class="todo-info-card">
          <p class="eyebrow">Current phase</p>
          <h2>${escapeHtml(phase.title)}</h2>
          <p>${escapeHtml(phase.goal)}</p>
        </article>

        ${phase.weeklyCheckFields.length > 0 ? `
          <article class="todo-info-card">
            <p class="eyebrow">Weekly checks</p>
            <ul class="simple-list">
              ${phase.weeklyCheckFields.map((field) => `<li>${escapeHtml(field)}</li>`).join("")}
            </ul>
          </article>
        ` : ""}

        ${trainingPlan.personalReminders.length > 0 ? renderTodoSection("personal-reminders", "Personal Reminders", trainingPlan.personalReminders, undefined, undefined, false, effectiveAthleteFilter) : ""}
      </aside>
    </section>
  `;
}

function renderImportedSections(plan: TrainingPlanTemplate, filterAthlete: string = "all"): string {
  if (plan.importedSections.length === 0) return "";

  const renderedSections = plan.importedSections
    .map((section) => renderTodoSection(`imported-${section.id}`, section.title, section.items, undefined, undefined, false, filterAthlete))
    .filter(Boolean)
    .join("");

  if (!renderedSections) return "";

  return `
    <section class="imported-plan">
      <div class="form-heading">
        <p class="eyebrow">Imported markdown</p>
        <h2>Imported checklist sections</h2>
        <span>Known exercises are matched to existing how-to guides.</span>
      </div>
      ${renderedSections}
    </section>
  `;
}

function renderTodoSection(
  scope: string,
  title: string,
  items: TrainingTodoItem[],
  note?: string,
  dayId?: string,
  isMorning?: boolean,
  filterAthlete: string = "all"
): string {
  const visibleItems = items.filter((todoItem) => isItemVisibleForAthlete(todoItem, filterAthlete));
  const coachMode = isCoach();

  // If in athlete mode and no items are assigned to this athlete in this section, hide section
  if (!coachMode && visibleItems.length === 0) {
    return "";
  }

  const collapsed = isTodoSectionCollapsed(scope);
  const completed = visibleItems.filter((todoItem) => isTodoComplete(makeProgressId(scope, todoItem.id))).length;

  return `
    <article class="todo-section ${collapsed ? "is-collapsed" : ""} ${isMorning ? "todo-section-morning" : ""}">
      <button
        class="todo-section-header"
        type="button"
        data-toggle-section="${escapeAttribute(scope)}"
        aria-expanded="${collapsed ? "false" : "true"}"
      >
        <div>
          <h2>${isMorning ? "🌅 " : ""}${escapeHtml(title)}</h2>
          ${note ? `<p>${escapeHtml(note)}</p>` : ""}
        </div>
        <div class="section-header-right">
          <span class="section-toggle-summary">
            <strong>${completed}/${visibleItems.length}</strong>
            <span>${collapsed ? "Show" : "Hide"}</span>
          </span>
        </div>
      </button>
      ${
        collapsed
          ? ""
          : `<div class="todo-items">
              ${visibleItems.length === 0 ? `<p class="empty-section-hint">No exercises in this section yet.</p>` : ""}
              ${visibleItems.map((todoItem) => renderTodoRow(scope, todoItem)).join("")}
              ${coachMode && dayId ? `
                <div class="section-add-footer">
                  <button class="ghost-action add-to-section-btn" type="button" data-open-add-workout data-day-id="${escapeAttribute(dayId)}" data-section-title="${escapeAttribute(title)}" data-assign-to="${escapeAttribute(filterAthlete)}">
                    + Add to ${escapeHtml(title)}
                  </button>
                </div>
              ` : ""}
            </div>`
      }
    </article>
  `;
}

function renderTodoRow(scope: string, todoItem: TrainingTodoItem): string {
  const progressId = makeProgressId(scope, todoItem.id);
  const checked = isTodoComplete(progressId);
  const guide =
    todoItem.exerciseId && trainingPlan ? trainingPlan.exerciseGuides[todoItem.exerciseId] : undefined;
  const coachMode = isCoach();
  const isCustomForMe = !coachMode && todoItem.assignedTo && profile && todoItem.assignedTo.toLowerCase() === profile.username.toLowerCase();
  const isCustomForOther = coachMode && todoItem.assignedTo && todoItem.assignedTo !== "all";

  return `
    <div class="todo-row ${checked ? "is-completed-row" : ""}">
      <div class="todo-row-main">
        <label class="todo-check">
          <input
            type="checkbox"
            data-progress-id="${escapeAttribute(progressId)}"
            data-item-id="${escapeAttribute(todoItem.id)}"
            ${checked ? "checked" : ""}
          />
          <div class="todo-label-group">
            <div class="todo-label-title-row">
              <span class="todo-label ${checked ? "is-complete" : ""}">${escapeHtml(todoItem.label)}</span>
              ${isCustomForMe ? `<span class="badge-personal-pill">✨ Custom for You</span>` : ""}
              ${isCustomForOther ? `<span class="badge-athlete-pill">👤 For @${escapeHtml(todoItem.assignedTo!)}</span>` : ""}
              ${coachMode && (!todoItem.assignedTo || todoItem.assignedTo === "all") ? `<span class="badge-squad-pill">👥 Squad</span>` : ""}
            </div>
            <div class="todo-meta-badges">
              ${todoItem.setsReps ? `<span class="badge-sets">${escapeHtml(todoItem.setsReps)}</span>` : ""}
              ${todoItem.category ? `<span class="badge-cat">${escapeHtml(todoItem.category)}</span>` : ""}
              ${todoItem.sessionType === "morning" ? `<span class="badge-morning">🌅 AM</span>` : ""}
            </div>
            ${todoItem.notes ? `
              <div class="todo-coach-notes">
                <span class="coach-note-icon">💡</span>
                <span>${escapeHtml(todoItem.notes)}</span>
              </div>
            ` : ""}
          </div>
        </label>
      </div>

      <div class="todo-row-actions">
        ${
          guide
            ? `<button class="ghost-action how-to-button" type="button" data-guide-id="${guide.id}">How to do</button>`
            : ""
        }
        ${
          coachMode
            ? `<button class="coach-delete-item-btn" type="button" data-delete-workout-item data-item-id="${escapeAttribute(todoItem.id)}" title="Delete exercise">✕</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderGuideDrawer(): string {
  if (!trainingPlan || !activeGuideId) return "";
  const guide = trainingPlan.exerciseGuides[activeGuideId];
  if (!guide) return "";

  return `
    <div class="drawer-backdrop" data-close-guide></div>
    <aside class="guide-drawer" aria-label="Exercise how-to">
      ${
        guideEditMode
          ? renderGuideEditForm(guide)
          : renderGuideDetails(guide)
      }
    </aside>
  `;
}

function renderGuideDetails(guide: ExerciseGuide): string {
  return `
    <div class="guide-header">
      <div>
        <p class="eyebrow">${escapeHtml(guide.category)}</p>
        <h2>${escapeHtml(guide.title)}</h2>
        <p>${guide.equipment.length ? `Equipment: ${guide.equipment.map(escapeHtml).join(", ")}` : "No equipment required"}</p>
      </div>
      <button class="ghost-action icon-action" type="button" data-close-guide>Close</button>
    </div>

    ${renderGuideList("Steps", guide.steps, true)}
    ${renderGuideList("Coaching cues", guide.coachingCues)}
    ${renderGuideList("Common mistakes", guide.commonMistakes)}
    ${renderGuideList("Safety notes", guide.safetyNotes)}

    <div class="guide-actions">
      ${
        guide.externalLinks.websiteUrl
          ? `<a class="secondary-link" href="${escapeAttribute(guide.externalLinks.websiteUrl)}" target="_blank" rel="noreferrer">Website</a>`
          : ""
      }
      ${
        guide.externalLinks.youtubeUrl
          ? `<a class="secondary-link" href="${escapeAttribute(guide.externalLinks.youtubeUrl)}" target="_blank" rel="noreferrer">YouTube</a>`
          : ""
      }
      <button class="primary-action" type="button" data-edit-guide="${guide.id}">Edit guide</button>
    </div>
  `;
}

function renderGuideEditForm(guide: ExerciseGuide): string {
  return `
    <form class="guide-edit-form" id="guide-edit-form" novalidate>
      <div class="guide-header">
        <div>
          <p class="eyebrow">Edit guide</p>
          <h2>${escapeHtml(guide.title)}</h2>
        </div>
        <button class="ghost-action icon-action" type="button" data-cancel-guide-edit>Cancel</button>
      </div>

      <label class="field">
        <span>Equipment, comma-separated</span>
        <input name="equipment" value="${escapeAttribute(guide.equipment.join(", "))}" />
      </label>

      ${renderGuideTextarea("steps", "Steps", guide.steps)}
      ${renderGuideTextarea("coachingCues", "Coaching cues", guide.coachingCues)}
      ${renderGuideTextarea("commonMistakes", "Common mistakes", guide.commonMistakes)}
      ${renderGuideTextarea("safetyNotes", "Safety notes", guide.safetyNotes)}

      <label class="field">
        <span>Website URL</span>
        <input name="websiteUrl" type="url" value="${escapeAttribute(guide.externalLinks.websiteUrl ?? "")}" placeholder="https://example.com" />
      </label>

      <label class="field">
        <span>YouTube URL</span>
        <input name="youtubeUrl" type="url" value="${escapeAttribute(guide.externalLinks.youtubeUrl ?? "")}" placeholder="https://youtube.com/watch?v=..." />
      </label>

      <p class="form-error" id="guide-error" role="alert"></p>
      <button class="primary-action" type="submit">Save guide</button>
    </form>
  `;
}

function renderGuideTextarea(name: string, label: string, values: string[]): string {
  return `
    <label class="field">
      <span>${escapeHtml(label)} - one per line</span>
      <textarea name="${name}" rows="5">${escapeHtml(values.join("\n"))}</textarea>
    </label>
  `;
}

function renderGuideList(title: string, values: string[], ordered = false): string {
  const tag = ordered ? "ol" : "ul";
  return `
    <section class="guide-section">
      <h3>${escapeHtml(title)}</h3>
      <${tag} class="simple-list">
        ${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}
      </${tag}>
    </section>
  `;
}

function renderEventView(eventType: EventType): string {
  const summary = calculateEventSummary(eventType, evaluations);
  const rank = getRankForScore(summary.score);
  const tests = getEventTests(eventType)
    .map((test) => renderTestRow(eventType, test))
    .join("");

  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Event evaluation</p>
        <h1>${EVENT_LABELS[eventType]}</h1>
        <p class="lead">${EVENT_KICKERS[eventType]}</p>
        <div class="event-card-meta">
          ${renderRankChip(rank)}
          <span style="color:var(--text-muted);font-size:0.84rem">${summary.completedTests}/${summary.totalTests} tests logged</span>
        </div>
      </div>
      ${renderScoreGauge(summary.score, true)}
    </section>

    <section class="event-overview">
      ${renderRankProgress(rank)}
      <div class="stats-grid" style="margin-top:1rem">
        ${renderStat("Composite score", formatScore(summary.score))}
        ${renderStat("Weighted z-score", formatZScore(summary.zScore))}
        ${renderStat("Completeness", `${summary.completeness}%`)}
        ${renderStat("Tests completed", `${summary.completedTests}/${summary.totalTests}`)}
      </div>
    </section>

    <section class="test-list" aria-label="${EVENT_LABELS[eventType]} tests">
      ${tests}
    </section>
  `;
}

function renderTestRow(eventType: EventType, test: TestDefinition): string {
  const records = recordsForTest(eventType, test.id);
  const stats = calculateTestStats(records);
  const latest = stats.latest;
  const rank = getRankForScore(latest ? latest.score : null);

  return `
    <article class="test-row">
      <div class="test-row-top">
        <div class="test-main">
          <div>
            <p class="eyebrow">${test.weight}% event weight</p>
            <h2>${test.title}</h2>
            <p>${test.description}</p>
          </div>
        </div>

        <div class="test-stats">
          ${renderStat("Latest", latest ? `${latest.resultValue} ${latest.resultUnit}` : "-")}
          ${renderStat("Score", latest ? String(latest.score) : "-")}
          ${renderStat("z-score", latest ? formatZScore(latest.zScore) : "-")}
          ${renderStat("Trend", formatDelta(stats.rollingTrend))}
        </div>

        <button class="primary-action narrow" type="button" data-evaluate-event="${eventType}" data-evaluate-test="${test.id}">
          Evaluate
        </button>
      </div>
      ${latest ? `<div style="margin-top:0.85rem">${renderRankProgress(rank)}</div>` : ""}
    </article>
  `;
}

function renderEvaluationRankingPanel(active: ActiveEvaluation, test: TestDefinition): string {
  const records = recordsForTest(active.eventType, active.testId);

  if (records.length === 0) {
    return `
      <aside class="ranking-panel">
        <div class="form-heading">
          <p class="eyebrow">Ranking</p>
          <h2>Saved attempts</h2>
          <span>No saved evaluations for this test yet.</span>
        </div>
        <p class="rank-empty">Save this evaluation to start building a ranked history for ${escapeHtml(test.shortTitle)}.</p>
      </aside>
    `;
  }

  const rows = rankEvaluationRecords(records)
    .map((record, index) => {
      const recordId = escapeAttribute(record.id);
      const isCurrent = record.id === active.recordId;
      const attemptRank = getRankForScore(record.score);

      return `
        <div class="ranking-row ${isCurrent ? "is-current" : ""}">
          <span class="rank-badge">#${index + 1}</span>
          <div class="ranking-body">
            <div class="ranking-row-top">
              <div>
                <strong>${record.score}/100</strong>
                <small>${formatDateTime(record.createdAt)}${record.video ? " | video" : ""}</small>
              </div>
              <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-end">
                ${isCurrent ? `<span class="rank-status">Editing</span>` : ""}
                ${renderRankChip(attemptRank)}
              </div>
            </div>

            <div class="ranking-meta">
              <span>${record.resultValue} ${escapeHtml(record.resultUnit)}</span>
              <span>z ${formatZScore(record.zScore)}</span>
              <span>${escapeHtml(record.rating)}</span>
            </div>

            <div class="ranking-actions">
              <button class="ghost-action compact-action" type="button" data-edit-evaluation="${recordId}">Edit</button>
              <button class="danger-action compact-action" type="button" data-delete-evaluation="${recordId}">Delete</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <aside class="ranking-panel" aria-label="${escapeAttribute(test.shortTitle)} saved attempt ranking">
      <div class="form-heading">
        <p class="eyebrow">Ranking</p>
        <h2>Saved attempts</h2>
        <span>Ranked by statistical score, then z-score.</span>
      </div>

      <div class="ranking-list">
        ${rows}
      </div>
    </aside>
  `;
}

function rankEvaluationRecords(records: EvaluationRecord[]): EvaluationRecord[] {
  return [...records].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.zScore !== a.zScore) return b.zScore - a.zScore;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function renderEvaluationView(active: ActiveEvaluation): string {
  const test = getTestDefinition(active.eventType, active.testId);
  if (!test) {
    return `
      <section class="page-header">
        <div>
          <p class="eyebrow">Missing test</p>
          <h1>Evaluation not found</h1>
        </div>
      </section>
    `;
  }

  const existingRecord = active.recordId
    ? evaluations.find((record) => record.id === active.recordId)
    : null;
  const inputFields = test.inputs
    .map((input) => {
      const existingValue = existingRecord?.inputs[input.id];
      return `
        <label class="field">
          <span>${input.label}</span>
          <div class="input-unit">
            <input
              name="${input.id}"
              type="number"
              min="${input.min}"
              max="${input.max}"
              step="${input.step}"
              placeholder="${input.placeholder}"
              inputmode="decimal"
              value="${Number.isFinite(existingValue) ? String(existingValue) : ""}"
            />
            <small>${input.unit}</small>
          </div>
        </label>
      `;
    })
    .join("");

  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">${active.recordId ? "Edit evaluation" : EVENT_LABELS[active.eventType]}</p>
        <h1>${test.title}</h1>
        <p class="lead">${
          existingRecord
            ? `Saved ${formatDateTime(existingRecord.createdAt)}. Edits update this evaluation, not a new one.`
            : test.description
        }</p>
      </div>
      <button class="ghost-action" type="button" data-back-to-event="${active.eventType}">Back</button>
    </section>

    <section class="evaluation-layout">
      <form class="evaluation-form" id="evaluation-form" novalidate>
        <div class="form-heading">
          <p class="eyebrow">Manual measurements</p>
          <h2>${test.resultLabel}</h2>
          <span>Benchmark: ${test.benchmarkLabel}</span>
        </div>

        <div class="input-grid">
          ${inputFields}
        </div>

        <p class="form-error" id="evaluation-error" role="alert"></p>

        <div class="action-row">
          <button class="primary-action" type="submit">${active.recordId ? "Update evaluation" : "Save evaluation"}</button>
          <button class="ghost-action" type="button" data-back-to-event="${active.eventType}">Cancel</button>
        </div>
      </form>

      ${renderEvaluationRankingPanel(active, test)}

      ${renderRecorderPanel(active)}
    </section>
  `;
}

function renderRecorderPanel(active: ActiveEvaluation): string {
  const src = active.video ? `src="${createRenderedVideoUrl(active.video.blob)}"` : "";

  return `
    <section class="recorder-panel">
      <div class="form-heading">
        <p class="eyebrow">Optional evidence</p>
        <h2>Video attachment</h2>
        <span>Evidence is saved with the evaluation, not used in scoring yet.</span>
      </div>

      <video id="recorder-preview" class="recorder-preview" ${src} playsinline muted controls></video>

      <div class="recorder-controls">
        <button class="secondary-action" type="button" id="start-camera">Start camera</button>
        <button class="secondary-action" type="button" id="flip-camera">Flip</button>
        <button class="primary-action" type="button" id="start-record">Record</button>
        <button class="danger-action" type="button" id="stop-record">Stop</button>
        <button class="ghost-action" type="button" id="clear-video">Clear</button>
      </div>

      <div class="recorder-status">
        <span id="camera-label">Camera: Back</span>
        <span id="time-remaining">Time left: 1:30</span>
        <span id="recording-status">No video evidence attached.</span>
      </div>
    </section>
  `;
}

function renderComparisonView(): string {
  if (!profile) return "";

  const rows = profile.events
    .flatMap((eventType) =>
      getEventTests(eventType).map((test) => renderComparisonRow(eventType, test))
    )
    .join("");

  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Comparison</p>
        <h1>Statistical history</h1>
        <p class="lead">Latest score, best score, consistency, and rolling trend by test.</p>
      </div>
    </section>

    <section class="table-panel">
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Test</th>
            <th>Latest</th>
            <th>Rank</th>
            <th>Best</th>
            <th>Average</th>
            <th>SD</th>
            <th>Change</th>
            <th>3-result trend</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="10">No evaluations saved yet.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function renderComparisonRow(eventType: EventType, test: TestDefinition): string {
  const stats = calculateTestStats(recordsForTest(eventType, test.id));
  const rank = getRankForScore(stats.latest ? stats.latest.score : null);

  return `
    <tr>
      <td>${EVENT_LABELS[eventType]}</td>
      <td>${test.shortTitle}</td>
      <td>${stats.latest ? stats.latest.score : "-"}</td>
      <td>${renderRankChip(rank)}</td>
      <td>${stats.bestScore ?? "-"}</td>
      <td>${stats.averageScore ?? "-"}</td>
      <td>${stats.standardDeviation ?? "-"}</td>
      <td>${formatDelta(stats.changeFromPrevious)}</td>
      <td>${formatDelta(stats.rollingTrend)}</td>
      <td>${stats.count}</td>
    </tr>
  `;
}

function renderVideosView(): string {
  const evaluationVideos = evaluations.filter((record) => Boolean(record.video));
  const legacyVideos = legacyAttempts.filter((attempt) => Boolean(attempt.video));

  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Videos</p>
        <h1>Evidence library</h1>
        <p class="lead">Saved evaluation clips and older recorder attempts stored on this device.</p>
      </div>
    </section>

    <section class="video-grid">
      ${
        evaluationVideos.length
          ? evaluationVideos.map(renderEvaluationVideo).join("")
          : `<article class="empty-state"><h2>No evaluation videos yet</h2><p>Attach video evidence from any evaluation form.</p></article>`
      }
      ${legacyVideos.map(renderLegacyVideo).join("")}
    </section>
  `;
}

function renderEvaluationVideo(record: EvaluationRecord): string {
  const test = getTestDefinition(record.eventType, record.testId);
  const video = record.video;
  if (!video) return "";

  return `
    <article class="video-card">
      <video src="${createRenderedVideoUrl(video.blob)}" controls></video>
      <div>
        <p class="eyebrow">${EVENT_LABELS[record.eventType]}</p>
        <h2>${test?.shortTitle ?? record.testId}</h2>
        <p>${record.score}/100, z ${formatZScore(record.zScore)} - ${new Date(record.createdAt).toLocaleString()}</p>
      </div>
    </article>
  `;
}

function renderLegacyVideo(attempt: Attempt): string {
  if (!attempt.video) return "";

  return `
    <article class="video-card legacy">
      <video src="${createRenderedVideoUrl(attempt.video)}" controls></video>
      <div>
        <p class="eyebrow">Legacy recorder</p>
        <h2>${escapeHtml(attempt.testType.toUpperCase())}</h2>
        <p>${escapeHtml(attempt.scoreText)} - ${new Date(attempt.createdAt).toLocaleString()}</p>
      </div>
    </article>
  `;
}

function renderProfileView(): string {
  if (!profile) return "";

  const coachMode = isCoach();

  return `
    <section class="page-header">
      <div>
        <div class="todo-title-row">
          <p class="eyebrow">Profile & Role Settings</p>
          ${coachMode ? `<span class="coach-tag">Coach / Admin</span>` : `<span class="athlete-tag">Athlete</span>`}
        </div>
        <h1>Athlete Settings</h1>
        <p class="lead">${
          authSession
            ? `Signed in as ${escapeHtml(authSession.user.email ?? "Supabase user")}. Profile changes sync to Supabase.`
            : "Profile changes sync to Supabase after sign in."
        }</p>
      </div>
    </section>

    <form class="profile-form" id="profile-form" novalidate>
      <label class="field">
        <span>Username</span>
        <input id="profile-username" name="username" type="text" value="${escapeAttribute(profile.username)}" required />
      </label>

      <label class="field">
        <span>Date of birth</span>
        <input id="profile-dob" name="dob" type="date" value="${escapeAttribute(profile.dob)}" required />
      </label>

      <label class="field">
        <span>Account Role</span>
        <select id="profile-role" name="role">
          <option value="coach" ${profile.role === "coach" ? "selected" : ""}>Coach / Admin (Manage Workouts & Squad Diagnostics)</option>
          <option value="athlete" ${profile.role === "athlete" ? "selected" : ""}>Athlete (View Workouts & Mark Done Only)</option>
        </select>
        <small class="field-hint">Coaches can add/delete workouts and access the Admin Hub. Toggle to Athlete to test the student view.</small>
      </label>

      <label class="morning-session-toggle-label" style="margin: 0.75rem 0;">
        <input type="checkbox" id="profile-morning-sessions" name="morningSessionsEnabled" ${profile.morningSessionsEnabled ? "checked" : ""} />
        <span>🌅 Enable Morning Training Sessions (AM mobility, activation & drills)</span>
      </label>

      <fieldset class="event-select">
        <legend>Events</legend>
        ${renderEventChoice("long-jump", profile.events.includes("long-jump"))}
        ${renderEventChoice("triple-jump", profile.events.includes("triple-jump"))}
      </fieldset>

      <p class="form-error" id="profile-error" role="alert"></p>
      <button class="primary-action" type="submit">Save Profile & Role</button>
    </form>
  `;
}

function renderWorkoutModal(): string {
  if (!workoutModalOpen || !isCoach() || !trainingPlan) return "";

  const days = trainingPlan.days;
  const presetSections = [
    "Dynamic Warm-Up",
    "🌅 Morning Activation",
    "Plyometrics & Bounds",
    "Technical Run-Up & Jumps",
    "Strength & Power",
    "Core & Mobility",
    "Cooldown & Recovery",
  ];

  return `
    <div class="workout-modal-backdrop" data-close-workout-modal></div>
    <div class="workout-modal" role="dialog" aria-modal="true" aria-labelledby="modal-workout-title">
      <div class="workout-modal-header">
        <div>
          <p class="eyebrow">Coach Workout Assignment</p>
          <h2 id="modal-workout-title">Add Exercise to Schedule</h2>
        </div>
        <button class="workout-modal-close" type="button" data-close-workout-modal aria-label="Close dialog">✕</button>
      </div>

      <form id="modal-workout-form" class="workout-modal-form" novalidate>
        <div class="modal-form-row">
          <label class="field">
            <span>Day of Week</span>
            <select name="dayId" required>
              ${days.map(d => `<option value="${d.id}" ${d.id === workoutModalDayId ? "selected" : ""}>${escapeHtml(d.name)}</option>`).join("")}
            </select>
          </label>

          <label class="field">
            <span>Session Timing</span>
            <select name="sessionType">
              <option value="main">Main Track Session (Afternoon / Evening)</option>
              <option value="morning">🌅 Morning Session (Early Activation / Mobility)</option>
            </select>
          </label>
        </div>

        <div class="modal-form-row">
          <label class="field">
            <span>Category</span>
            <select name="category">
              <option value="jump">Jump / Technical</option>
              <option value="plyometric">Plyometric / Bounds</option>
              <option value="sprint">Sprint / Speed</option>
              <option value="strength">Strength / Power</option>
              <option value="core">Core / Posture</option>
              <option value="mobility">Mobility / Warmup</option>
              <option value="recovery">Recovery / Cooldown</option>
            </select>
          </label>

          <label class="field">
            <span>Assign Workout To</span>
            <select name="assignedTo">
              <option value="all" ${workoutModalAssignTo === "all" ? "selected" : ""}>👥 Entire Squad (All Students)</option>
              ${squadAthletes.map(a => `<option value="${escapeAttribute(a.username)}" ${workoutModalAssignTo === a.username ? "selected" : ""}>🏃 @${escapeHtml(a.username)} (Individual Drill)</option>`).join("")}
            </select>
          </label>
        </div>

        <div class="field">
          <span>Section / Phase</span>
          <div class="preset-pill-row">
            ${presetSections.map(preset => `
              <button class="preset-pill ${preset === workoutModalSectionTitle ? "is-selected" : ""}" type="button" data-set-section="${escapeAttribute(preset)}">
                ${escapeHtml(preset)}
              </button>
            `).join("")}
          </div>
          <input name="sectionTitle" type="text" value="${escapeAttribute(workoutModalSectionTitle)}" placeholder="e.g. Dynamic Warm-Up" required />
        </div>

        <label class="field">
          <span>Exercise Name</span>
          <input name="label" type="text" placeholder="e.g. Approach Run-throughs (12-stride) or Box Drop to Hurdle Hop" required />
        </label>

        <label class="field">
          <span>Sets & Reps / Prescription</span>
          <input name="setsReps" type="text" placeholder="e.g. 5 sets x 3 reps (full recovery) or 4x30m flys" />
        </label>

        <label class="field">
          <span>Coaching Cues & Notes for Athlete</span>
          <textarea name="notes" rows="2" placeholder="e.g. Focus on tall posture, active pawing takeoff foot, violent free knee drive"></textarea>
        </label>

        <p class="form-error" id="modal-workout-error" role="alert"></p>

        <div class="workout-modal-actions">
          <button class="ghost-action" type="button" data-close-workout-modal>Cancel</button>
          <button class="primary-action" type="submit">+ Add Exercise</button>
        </div>
      </form>
    </div>
  `;
}

function renderMarkdownModal(): string {
  if (!markdownModalOpen || !isCoach()) return "";

  return `
    <div class="workout-modal-backdrop" data-close-markdown-modal></div>
    <div class="workout-modal markdown-import-modal" role="dialog" aria-modal="true" aria-labelledby="modal-md-title">
      <div class="workout-modal-header">
        <div>
          <p class="eyebrow">Whole Week Workout Import</p>
          <h2 id="modal-md-title">Import Weekly Training Markdown</h2>
        </div>
        <button class="workout-modal-close" type="button" data-close-markdown-modal aria-label="Close dialog">✕</button>
      </div>

      <p class="muted" style="margin-bottom: 0.75rem; font-size: 0.85rem;">
        Paste your markdown below. Use day headings (<code># Monday</code>, <code>## Tuesday</code>, etc.) and section headings (<code>### Dynamic Warm-Up</code>, <code>### Technical Jumps</code>, etc.). Use pipe <code>|</code> to separate sets/reps and cues (e.g. <code>- [ ] A-Skips | 3x25m | Tall posture</code>).
      </p>

      <div class="md-template-actions">
        <button class="ghost-action compact-btn" type="button" id="load-sample-md-btn">
          📋 Load Sample 7-Day Plan Template
        </button>
        <button class="ghost-action compact-btn" type="button" id="clear-md-btn">
          Clear
        </button>
      </div>

      <form id="markdown-import-form" class="workout-modal-form" novalidate style="margin-top: 0.6rem;">
        <label class="field" style="margin-bottom: 0.75rem;">
          <span>Markdown Text</span>
          <textarea
            id="markdown-import-textarea"
            name="markdown"
            rows="14"
            placeholder="# 12-Week Squad Plan&#10;&#10;## Monday: Speed & Approach&#10;### Dynamic Warm-Up&#10;- [ ] Jog & Mobility Flow | 10 mins&#10;- [ ] A-Skips & B-Skips | 3x25m | Tall hips&#10;&#10;### Technical Jumps&#10;- [ ] 6-Stride Pop-Offs | 4 jumps | Fast penultimate step&#10;&#10;## Tuesday: Plyometrics & Strength&#10;### Plyometrics & Bounds&#10;- [ ] Depth Jumps (4x4 reps) | Minimal ground contact&#10;- [ ] Trap Bar Deadlift | 4x5 @ 75%"
            style="font-family: monospace; font-size: 0.82rem; line-height: 1.5; resize: vertical;"
            required
          ></textarea>
        </label>

        <p class="form-error" id="markdown-import-error" role="alert"></p>

        <div class="workout-modal-actions">
          <button class="ghost-action" type="button" data-close-markdown-modal>Cancel</button>
          <button class="primary-action" type="submit">🚀 Import Entire Week</button>
        </div>
      </form>
    </div>
  `;
}



function renderAdminView(): string {
  if (!profile || !trainingPlan) return "";

  const coachMode = isCoach();
  if (!coachMode) {
    return `
      <section class="page-header">
        <div>
          <p class="eyebrow">Restricted</p>
          <h1>Coach Access Required</h1>
          <p class="lead">You are currently in athlete mode. Toggle your role to Coach in Profile to manage squad workouts.</p>
        </div>
      </section>
      <div class="empty-plan-card">
        <p>Switch your role to Coach / Admin in the Profile tab to unlock workout scheduling and athlete diagnostics.</p>
        <button class="primary-action" type="button" data-view="profile">Go to Profile Settings</button>
      </div>
    `;
  }

  const totalExercises = countPlanItems(trainingPlan);
  const totalEvals = evaluations.length;
  const totalVideos = evaluations.filter((record) => Boolean(record.video)).length +
    legacyAttempts.filter((attempt) => Boolean(attempt.video)).length;
  const days = trainingPlan.days;

  const presetSections = [
    "Dynamic Warm-Up",
    "🌅 Morning Activation",
    "Plyometrics & Bounds",
    "Technical Run-Up & Jumps",
    "Strength & Power",
    "Core & Mobility",
    "Cooldown & Recovery",
  ];

  return `
    <section class="page-header admin-header">
      <div>
        <div class="todo-title-row">
          <p class="eyebrow">Coach Command Center</p>
          <span class="coach-tag">Admin Hub</span>
        </div>
        <h1>Coach Dashboard: @${escapeHtml(profile.username)}</h1>
        <p class="lead">Manage student training schedules, prescribe workouts, and review squad evaluation diagnostics.</p>
      </div>
      <div class="header-metrics">
        ${renderMiniMetric("Workouts", String(totalExercises))}
        ${renderMiniMetric("Evaluations", String(totalEvals))}
        ${renderMiniMetric("Videos", String(totalVideos))}
      </div>
    </section>

    <!-- Cloud Squad Sync Status & Push Button -->
    <section class="admin-cloud-sync-banner ${authSession ? "is-connected" : "is-disconnected"}">
      <div class="admin-cloud-sync-status">
        <span class="status-indicator-dot ${authSession ? "dot-online" : "dot-offline"}"></span>
        <div>
          <strong>${authSession ? "☁️ Supabase Cloud: Connected" : "⚠️ Cloud Sync: Offline / Guest Mode"}</strong>
          <small class="muted" style="display:block;">
            ${authSession
              ? `Logged in as Coach (@${escapeHtml(profile.username)} • ${escapeHtml(authSession.user.email ?? "coach")}). Workouts sync directly to all student athlete devices.`
              : `You are in offline mode. Changes added on this phone will NOT reach athlete devices until you sign in.`
            }
          </small>
        </div>
      </div>
      <div class="admin-cloud-sync-actions">
        ${authSession
          ? `<button class="primary-action compact-btn" type="button" id="push-schedule-to-cloud-btn" title="Push your active schedule and tailored workouts to Supabase">
              ☁️ Push Schedule to Squad
            </button>`
          : `<button class="primary-action compact-btn" type="button" data-view="profile" title="Sign into Supabase">
              🔑 Sign In to Sync
            </button>`
        }
      </div>
    </section>

    <!-- Admin Navigation Tabs -->
    <div class="admin-tab-bar">
      <button class="admin-tab ${adminTab === "students" ? "is-active" : ""}" type="button" data-admin-tab="students">
        👥 Students (${squadAthletes.length})
      </button>
      <button class="admin-tab ${adminTab === "workouts" ? "is-active" : ""}" type="button" data-admin-tab="workouts">
        🏋️ Weekly Schedule
      </button>
      <button class="admin-tab ${adminTab === "analysis" ? "is-active" : ""}" type="button" data-admin-tab="analysis">
        📊 Squad Diagnostics & Tests
      </button>
    </div>

    ${adminTab === "students" ? `
      <!-- Students Directory & Workout Assignment Tab -->
      <section class="roster-view-container">
        <div class="roster-view-header">
          <div>
            <div class="todo-title-row">
              <p class="eyebrow">Database Roster</p>
              <span class="live-pill">Live DB</span>
            </div>
            <h2>Student Athletes (${squadAthletes.length} Available)</h2>
            <p class="muted">Registered athletes retrieved from database. Select any student to view their workout schedule and prescribe custom sessions.</p>
          </div>
          <div class="roster-actions-row">
            <button class="secondary-action compact-btn" type="button" id="refresh-students-btn" title="Refresh athlete list from database">
              🔄 Refresh from DB
            </button>
          </div>
        </div>

        ${squadAthletes.length === 0 ? `
          <div class="empty-plan-card">
            <div class="empty-plan-icon">👥</div>
            <h3>No Students Found in Database</h3>
            <p>Athletes who register on this platform with an "Athlete" account will automatically show up here.</p>
            <p class="muted">If an athlete just signed up, click below to re-query the database.</p>
            <button class="primary-action compact-btn" type="button" id="refresh-students-empty-btn">
              🔄 Refresh from DB
            </button>
          </div>
        ` : `
          <!-- Quick Student Selector Bar -->
          <div class="student-selector-bar">
            <span class="selector-label">Select Student:</span>
            <div class="student-pills-row">
              <button 
                class="student-pill ${activeStudentUsername === null ? "is-active" : ""}" 
                type="button" 
                data-select-student="all"
              >
                👥 All Students (${squadAthletes.length})
              </button>
              ${squadAthletes.map(ath => {
                const isSelected = activeStudentUsername?.toLowerCase() === ath.username.toLowerCase();
                const customCount = countAthleteWorkouts(trainingPlan, ath.username);
                return `
                  <button 
                    class="student-pill ${isSelected ? "is-active" : ""}" 
                    type="button" 
                    data-select-student="${escapeAttribute(ath.username)}"
                  >
                    <span class="pill-avatar">${escapeHtml(ath.username.slice(0, 2).toUpperCase())}</span>
                    <span class="pill-name">@${escapeHtml(ath.username)}</span>
                    ${customCount > 0 ? `<span class="pill-count">${customCount}</span>` : ""}
                    ${ath.morningSessionsEnabled ? `<span class="pill-badge" title="Morning routine active">🌅</span>` : ""}
                  </button>
                `;
              }).join("")}
            </div>
          </div>

          ${(() => {
            const activeStudent = activeStudentUsername
              ? squadAthletes.find((a) => a.username.toLowerCase() === activeStudentUsername!.toLowerCase())
              : null;

            if (activeStudent) {
              const customWorkoutsCount = countAthleteWorkouts(trainingPlan, activeStudent.username);
              return `
                <!-- Selected Student Workspace -->
                <div class="student-workspace">
                  <!-- Student Top Profile Bar -->
                  <div class="student-profile-bar">
                    <div class="student-profile-left">
                      <div class="athlete-card-avatar large-avatar">
                        <span>${escapeHtml(activeStudent.username.slice(0, 2).toUpperCase())}</span>
                      </div>
                      <div class="student-profile-details">
                        <div class="student-name-row">
                          <h3>@${escapeHtml(activeStudent.username)}</h3>
                          <span class="badge-cat">Student Athlete</span>
                        </div>
                        <div class="athlete-card-events">
                          ${activeStudent.events.map(ev => `<span class="athlete-event-pill">${EVENT_LABELS[ev] || ev}</span>`).join("")}
                          <span class="dob-pill">DOB: ${escapeHtml(activeStudent.dob)}</span>
                        </div>
                      </div>
                    </div>

                    <div class="student-profile-controls">
                      <div class="student-morning-box">
                        <span class="morning-status-text">Early Morning Routine:</span>
                        <button
                          class="athlete-morning-toggle-btn ${activeStudent.morningSessionsEnabled ? "is-active" : "is-off"}"
                          type="button"
                          data-toggle-athlete-morning="${escapeAttribute(activeStudent.username)}"
                          title="Toggle morning activation workouts"
                        >
                          ${activeStudent.morningSessionsEnabled ? "🌅 Morning: ACTIVE (Tap to turn off)" : "🌙 Morning: OFF (Tap to turn on)"}
                        </button>
                      </div>
                      <div class="student-profile-actions">
                        <button class="secondary-action compact-btn" type="button" data-coach-view-athlete-plan="${escapeAttribute(activeStudent.username)}">
                          📱 View as Athlete
                        </button>
                        <button class="ghost-action compact-btn" type="button" data-select-student="all">
                          ✕ Close Student
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Two-Column Workspace: Left = Prescribe Workout Form, Right = Assigned Workouts -->
                  <div class="student-workspace-grid">
                    <!-- Left: Prescribe Form for this Student -->
                    <article class="workout-builder-card student-prescribe-card">
                      <div class="builder-card-header">
                        <div>
                          <p class="eyebrow">Dedicated Prescription</p>
                          <h2>Prescribe Workout for @${escapeHtml(activeStudent.username)}</h2>
                        </div>
                        <span class="badge-cat">Individual</span>
                      </div>
                      <p class="muted">Add a tailored workout item specifically assigned to @${escapeHtml(activeStudent.username)}.</p>

                      <form id="student-prescribe-form" class="builder-form" novalidate>
                        <input type="hidden" name="assignedTo" value="${escapeAttribute(activeStudent.username)}" />

                        <div class="builder-form-row">
                          <label class="field">
                            <span>Assign to Day</span>
                            <select name="dayId" id="student-prescribe-day-select" required>
                              ${days.map(d => `<option value="${d.id}" ${d.id === selectedDayId ? "selected" : ""}>${escapeHtml(d.name)}</option>`).join("")}
                            </select>
                          </label>

                          <label class="field">
                            <span>Session Timing</span>
                            <select name="sessionType">
                              <option value="main">Main Track Session (Afternoon / Evening)</option>
                              <option value="morning" ${activeStudent.morningSessionsEnabled ? "" : "disabled"}>
                                🌅 Morning Activation ${activeStudent.morningSessionsEnabled ? "" : "(Enable morning routine above first)"}
                              </option>
                            </select>
                          </label>
                        </div>

                        <div class="builder-form-row">
                          <label class="field">
                            <span>Category</span>
                            <select name="category">
                              <option value="jump">Jump / Technical</option>
                              <option value="plyometric">Plyometric / Bounds</option>
                              <option value="sprint">Sprint / Speed</option>
                              <option value="strength">Strength / Power</option>
                              <option value="core">Core / Posture</option>
                              <option value="mobility">Mobility / Warmup</option>
                              <option value="recovery">Recovery / Cooldown</option>
                            </select>
                          </label>

                          <label class="field">
                            <span>Sets & Reps / Volume</span>
                            <input name="setsReps" type="text" placeholder="e.g. 4x30m sleds, 3x5 bounds" />
                          </label>
                        </div>

                        <div class="field">
                          <span>Section / Focus Area</span>
                          <div class="preset-pill-row">
                            ${presetSections.map(preset => `
                              <button class="preset-pill ${preset === "Dynamic Warm-Up" ? "is-selected" : ""}" type="button" data-student-set-section="${escapeAttribute(preset)}">
                                ${escapeHtml(preset)}
                              </button>
                            `).join("")}
                          </div>
                          <input name="sectionTitle" id="student-section-input" type="text" value="Dynamic Warm-Up" placeholder="e.g. Plyometrics & Bounds" required />
                        </div>

                        <label class="field">
                          <span>Exercise Name</span>
                          <input name="label" id="student-prescribe-label-input" type="text" placeholder="e.g. 30m Sled Acceleration / Single-leg Hurdle Bounds" required />
                        </label>

                        <label class="field">
                          <span>Coach Cues / Technical Instructions</span>
                          <textarea name="notes" rows="2" placeholder="e.g. Strike under hip with stiff ankle; tall chest at takeoff"></textarea>
                        </label>

                        <p class="form-error" id="student-prescribe-error" role="alert"></p>

                        <button class="primary-action full-width-btn" type="submit">
                          ＋ Add Workout to @${escapeHtml(activeStudent.username)}
                        </button>
                      </form>
                    </article>

                    <!-- Right: Scheduled Workouts for this Student across Monday to Sunday -->
                    <div class="student-workouts-panel">
                      <div class="student-workouts-header">
                        <div>
                          <p class="eyebrow">Weekly Schedule</p>
                          <h3>Workouts for @${escapeHtml(activeStudent.username)}</h3>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center;">
                          <span class="stat-pill">${customWorkoutsCount} Custom Items</span>
                          <button class="secondary-action compact-btn" type="button" data-push-cloud-now title="Push current schedule to cloud so @${escapeHtml(activeStudent.username)} sees it immediately">
                            ☁️ Push to Cloud
                          </button>
                        </div>
                      </div>

                      <div class="student-days-workout-list">
                        ${days.map(d => {
                          const target = activeStudent.username.toLowerCase();
                          const allItemsForDay: { item: TrainingTodoItem; sectionTitle: string; isCustom: boolean }[] = [];
                          for (const s of d.sections) {
                            for (const item of s.items) {
                              const isCustom = Boolean(item.assignedTo && item.assignedTo.toLowerCase() === target);
                              const isSquad = !item.assignedTo || item.assignedTo === "all";
                              if (isCustom || isSquad) {
                                allItemsForDay.push({ item, sectionTitle: s.title, isCustom });
                              }
                            }
                          }

                          return `
                            <article class="student-day-box">
                              <div class="student-day-header">
                                <div class="student-day-title-row">
                                  <h4>${escapeHtml(d.name)}</h4>
                                  <span class="day-phase-tag">${escapeHtml(d.focus || d.title || "Training")}</span>
                                </div>
                                <div class="student-day-actions">
                                  <button class="secondary-action compact-btn" type="button" data-student-quick-add="${escapeAttribute(d.id)}" title="Add workout specifically to ${d.name}">
                                    ＋ Add to ${d.name}
                                  </button>
                                </div>
                              </div>

                              ${allItemsForDay.length === 0 ? `
                                <p class="empty-day-note">Rest / No workouts scheduled for ${escapeHtml(d.name)}.</p>
                              ` : `
                                <ul class="student-items-list">
                                  ${allItemsForDay.map(({ item, sectionTitle, isCustom }) => `
                                    <li class="student-workout-item ${isCustom ? "is-custom-item" : "is-squad-item"}">
                                      <div class="student-item-main">
                                        <div class="student-item-title-row">
                                          <strong class="student-item-label">${escapeHtml(item.label)}</strong>
                                          ${isCustom ? `
                                            <span class="workout-assigned-badge is-custom">👤 Custom for @${escapeHtml(activeStudent.username)}</span>
                                          ` : `
                                            <span class="workout-assigned-badge is-squad">👥 Squad Workout</span>
                                          `}
                                          ${item.sessionType === "morning" ? `<span class="morning-tag">🌅 Morning</span>` : ""}
                                        </div>
                                        <div class="student-item-meta">
                                          <span class="item-sec-name">${escapeHtml(sectionTitle)}</span>
                                          ${item.setsReps ? `<span class="item-sets-reps">📊 ${escapeHtml(item.setsReps)}</span>` : ""}
                                          ${item.category ? `<span class="item-cat-pill">${escapeHtml(item.category)}</span>` : ""}
                                        </div>
                                        ${item.notes ? `<p class="item-notes-text">💡 ${escapeHtml(item.notes)}</p>` : ""}
                                      </div>
                                      <div class="student-item-actions">
                                        <button 
                                          class="ghost-action compact-btn delete-item-btn" 
                                          type="button" 
                                          data-delete-workout-item 
                                          data-item-id="${escapeAttribute(item.id)}" 
                                          data-scope="day:${escapeAttribute(d.id)}"
                                          title="Delete this workout"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </li>
                                  `).join("")}
                                </ul>
                              `}
                            </article>
                          `;
                        }).join("")}
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }

            // No active student selected: show all available student cards
            return `
              <div class="squad-athletes-grid">
                ${squadAthletes.map(ath => {
                  const customWorkoutsCount = countAthleteWorkouts(trainingPlan, ath.username);
                  return `
                    <article class="athlete-roster-card">
                      <div class="athlete-card-top">
                        <div class="athlete-card-avatar">
                          <span>${escapeHtml(ath.username.slice(0, 2).toUpperCase())}</span>
                        </div>
                        <div class="athlete-card-meta">
                          <div class="athlete-card-name-row">
                            <h3 class="athlete-card-username">@${escapeHtml(ath.username)}</h3>
                          </div>
                          <div class="athlete-card-events">
                            ${ath.events.map(ev => `<span class="athlete-event-pill">${EVENT_LABELS[ev] || ev}</span>`).join("")}
                          </div>
                          <small class="athlete-card-sub">DOB: ${escapeHtml(ath.dob)}</small>
                        </div>
                      </div>

                      <div class="athlete-card-body">
                        <div class="athlete-stat-tile">
                          <span class="stat-tile-num">${customWorkoutsCount}</span>
                          <span class="stat-tile-lbl">Custom Workouts Assigned</span>
                        </div>

                        <div class="athlete-morning-control">
                          <span class="morning-control-label">Morning Activation Routine:</span>
                          <button
                            class="athlete-morning-toggle-btn ${ath.morningSessionsEnabled ? "is-active" : "is-off"}"
                            type="button"
                            data-toggle-athlete-morning="${escapeAttribute(ath.username)}"
                          >
                            ${ath.morningSessionsEnabled ? "🌅 Morning: ACTIVE (Tap to turn off)" : "🌙 Morning: OFF (Tap to turn on)"}
                          </button>
                        </div>
                      </div>

                      <div class="athlete-card-actions">
                        <button class="primary-action compact-btn" type="button" data-select-student="${escapeAttribute(ath.username)}">
                          👉 Select & Prescribe Workouts
                        </button>
                        <button class="secondary-action compact-btn" type="button" data-coach-view-athlete-plan="${escapeAttribute(ath.username)}">
                          📅 View Schedule
                        </button>
                      </div>
                    </article>
                  `;
                }).join("")}
              </div>
            `;
          })()}
        `}
      </section>
    ` : adminTab === "workouts" ? `
      <!-- Batch Whole Week Markdown Importer Banner -->
      <section class="admin-import-banner">
        <div class="admin-import-banner-left">
          <span class="banner-icon">📝</span>
          <div>
            <strong>Batch Import Full Week Schedule (Markdown)</strong>
            <p>Upload a .md file or paste your week's training markdown. Days, sections, sets/reps, and coaching cues are automatically assigned across Monday to Sunday.</p>
          </div>
        </div>
        <div class="admin-import-banner-actions">
          <button class="primary-action compact-btn" type="button" data-open-markdown-modal>
            📋 Paste Weekly Markdown
          </button>
          <label class="secondary-action compact-btn" for="admin-plan-import" style="cursor: pointer; margin: 0; display: inline-flex; align-items: center; justify-content: center;">
            📁 Upload .md File
          </label>
          <input id="admin-plan-import" type="file" accept=".md,text/markdown,text/plain" style="display:none;" />
        </div>
      </section>

      <div class="admin-grid">
        <!-- Left: Quick Workout Builder Form -->
        <article class="workout-builder-card">
          <div class="builder-card-header">
            <div>
              <p class="eyebrow">Workout Creator</p>
              <h2>Add New Exercise</h2>
            </div>
            <span class="badge-cat">Live Sync</span>
          </div>
          <p class="muted">Prescribe an exercise with sets, reps, and coaching cues. Prescribe for the whole squad or an individual athlete.</p>

          <form id="workout-builder-form" class="builder-form" novalidate>
            <div class="builder-form-row">
              <label class="field">
                <span>Assign to Day</span>
                <select name="dayId" required>
                  ${days.map(d => `<option value="${d.id}" ${d.id === selectedDayId ? "selected" : ""}>${escapeHtml(d.name)}</option>`).join("")}
                </select>
              </label>

              <label class="field">
                <span>Session Timing</span>
                <select name="sessionType">
                  <option value="main">Main Track Session (Afternoon / Evening)</option>
                  <option value="morning">🌅 Morning Session (Early Activation / Mobility)</option>
                </select>
              </label>
            </div>

            <div class="builder-form-row">
              <label class="field">
                <span>Assign Workout To</span>
                <select name="assignedTo">
                  <option value="all" ${selectedAthleteFilter === "all" ? "selected" : ""}>👥 Entire Squad (All Students)</option>
                  ${squadAthletes.map(a => `<option value="${escapeAttribute(a.username)}" ${selectedAthleteFilter.toLowerCase() === a.username.toLowerCase() ? "selected" : ""}>🏃 @${escapeHtml(a.username)} (Individual Workout)</option>`).join("")}
                </select>
              </label>

              <label class="field">
                <span>Category</span>
                <select name="category">
                  <option value="jump">Jump / Technical</option>
                  <option value="plyometric">Plyometric / Bounds</option>
                  <option value="sprint">Sprint / Speed</option>
                  <option value="strength">Strength / Power</option>
                  <option value="core">Core / Posture</option>
                  <option value="mobility">Mobility / Warmup</option>
                  <option value="recovery">Recovery / Cooldown</option>
                </select>
              </label>
            </div>

            <div class="field">
              <span>Section / Focus Area</span>
              <div class="preset-pill-row">
                ${presetSections.map(preset => `
                  <button class="preset-pill ${preset === "Dynamic Warm-Up" ? "is-selected" : ""}" type="button" data-builder-set-section="${escapeAttribute(preset)}">
                    ${escapeHtml(preset)}
                  </button>
                `).join("")}
              </div>
              <input name="sectionTitle" id="builder-section-input" type="text" value="Dynamic Warm-Up" placeholder="e.g. Plyometrics & Bounds" required />
            </div>

            <label class="field">
              <span>Exercise Name</span>
              <input name="label" type="text" placeholder="e.g. 5-Stride Approach Pop-Offs or Box Drop to Hurdle Hop" required />
            </label>

            <label class="field">
              <span>Sets & Reps / Intensity</span>
              <input name="setsReps" type="text" placeholder="e.g. 4 sets x 5 reps (full rest) or 3x30m flys" />
            </label>

            <label class="field">
              <span>Coach Cues / Technical Instructions</span>
              <textarea name="notes" rows="2" placeholder="e.g. Strike under hip with stiff ankle; tall chest at takeoff"></textarea>
            </label>

            <p class="form-error" id="builder-error" role="alert"></p>

            <div class="builder-form-actions">
              <button class="primary-action" type="submit">+ Add Exercise to Schedule</button>
            </div>
          </form>
        </article>

        <!-- Right: Weekly Schedule Manager -->
        <article class="weekly-schedule-manager">
          <div class="builder-card-header">
            <div>
              <p class="eyebrow">Weekly Master Schedule</p>
              <h2>Current Squad Workouts</h2>
            </div>
            <button class="danger-action compact-btn" type="button" data-clear-all-workouts>
              Clear All Workouts
            </button>
          </div>
          <p class="muted">Review workouts scheduled across the 7-day training week. Filter by athlete to see individual plans.</p>

          <!-- Schedule Filter Selector -->
          <div class="admin-schedule-filter-bar">
            <div class="admin-schedule-filter-left">
              <span>Viewing Schedule:</span>
              <select id="admin-athlete-filter" class="admin-filter-select">
                <option value="all" ${selectedAthleteFilter === "all" ? "selected" : ""}>👥 Entire Squad (All Workouts)</option>
                ${squadAthletes.map(a => `<option value="${escapeAttribute(a.username)}" ${selectedAthleteFilter.toLowerCase() === a.username.toLowerCase() ? "selected" : ""}>🏃 @${escapeHtml(a.username)} Only</option>`).join("")}
              </select>
            </div>
            ${selectedAthleteFilter !== "all" ? `
              <span class="admin-filter-tag">Filtered: @${escapeHtml(selectedAthleteFilter)}</span>
            ` : ""}
          </div>

          <div class="admin-days-list">
            ${days.map(d => {
              const dayItems = d.sections
                .flatMap(s => s.items)
                .filter(i => isItemVisibleForAthlete(i, selectedAthleteFilter));
              const dayItemsCount = dayItems.length;

              const visibleSections = d.sections
                .map(s => ({
                  ...s,
                  items: s.items.filter(i => isItemVisibleForAthlete(i, selectedAthleteFilter)),
                }))
                .filter(s => s.items.length > 0);

              return `
                <div class="admin-day-accordion">
                  <div class="admin-day-summary">
                    <div class="admin-day-left">
                      <strong>${escapeHtml(d.name)}</strong>
                      <span class="admin-day-badge">${dayItemsCount} exercises</span>
                    </div>
                    <button class="ghost-action compact-btn" type="button" data-open-add-workout data-day-id="${escapeAttribute(d.id)}" data-assign-to="${escapeAttribute(selectedAthleteFilter)}">
                      + Add
                    </button>
                  </div>

                  ${visibleSections.length > 0 ? `
                    <div class="admin-day-sections">
                      ${visibleSections.map(s => `
                        <div class="admin-sub-section">
                          <div class="admin-sub-section-title">${escapeHtml(s.title)} (${s.items.length})</div>
                          <div class="admin-items-list">
                            ${s.items.map(item => `
                              <div class="admin-item-row">
                                <div class="admin-item-info">
                                  <div class="admin-item-title-row">
                                    <span class="admin-item-title">${escapeHtml(item.label)}</span>
                                    ${item.assignedTo && item.assignedTo !== "all"
                                      ? `<span class="badge-athlete-pill">👤 For @${escapeHtml(item.assignedTo)}</span>`
                                      : `<span class="badge-squad-pill">👥 Squad</span>`}
                                  </div>
                                  <div class="todo-meta-badges">
                                    ${item.setsReps ? `<span class="badge-sets">${escapeHtml(item.setsReps)}</span>` : ""}
                                    ${item.category ? `<span class="badge-cat">${escapeHtml(item.category)}</span>` : ""}
                                    ${item.sessionType === "morning" ? `<span class="badge-morning">🌅 AM</span>` : ""}
                                  </div>
                                  ${item.notes ? `<div class="todo-coach-notes"><span class="coach-note-icon">💡</span> ${escapeHtml(item.notes)}</div>` : ""}
                                </div>
                                <button class="coach-delete-item-btn" type="button" data-delete-workout-item data-item-id="${escapeAttribute(item.id)}" title="Delete exercise">✕</button>
                              </div>
                            `).join("")}
                          </div>
                        </div>
                      `).join("")}
                    </div>
                  ` : `
                    <p class="admin-empty-day-hint">No exercises scheduled for ${escapeHtml(d.name)} ${selectedAthleteFilter !== "all" ? `for @${escapeHtml(selectedAthleteFilter)}` : ""}.</p>
                  `}
                </div>
              `;
            }).join("")}
          </div>
        </article>
      </div>
    ` : `
      <!-- Stats Analysis & Morning Session Management Tab -->
      <div class="admin-analysis-grid">
        <!-- Morning Session Controls Card -->
        <article class="analysis-card squad-settings-card">
          <div class="builder-card-header">
            <div>
              <p class="eyebrow">Squad Management</p>
              <h2>Morning Training Session Roster</h2>
            </div>
            <span class="badge-cat">Student Controls</span>
          </div>
          <p class="muted">Enable early morning training routines (sunrise activation, mobility & core prep) for student athletes. When enabled, morning drills appear with a golden sunrise header in their schedule.</p>

          <div class="morning-roster-box">
            ${squadAthletes.map(ath => `
              <div class="morning-roster-row" style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.06);">
                <div class="morning-roster-user">
                  <span class="mobile-avatar-circle">${escapeHtml(ath.username.charAt(0).toUpperCase())}</span>
                  <div>
                    <strong>@${escapeHtml(ath.username)}</strong>
                    <small>${ath.events.map((e) => EVENT_LABELS[e]).join(" / ")}</small>
                  </div>
                </div>
                <div class="morning-roster-status">
                  <button
                    class="${ath.morningSessionsEnabled ? "secondary-action" : "primary-action"} compact-btn"
                    type="button"
                    data-toggle-athlete-morning="${escapeAttribute(ath.username)}"
                  >
                    ${ath.morningSessionsEnabled ? "🌅 Morning Active (Tap to Disable)" : "🌙 Morning Off (Tap to Enable)"}
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
        </article>

        <article class="analysis-card">
          <div class="builder-card-header">
            <div>
              <p class="eyebrow">Squad Diagnostics</p>
              <h2>Jumping Performance & Battery Tests</h2>
            </div>
            <button class="primary-action compact-btn" type="button" data-view="long-jump">
              Evaluate Student
            </button>
          </div>
          <p class="muted">Performance tests provide composite scores, z-score statistical baselines, and percentile ranks across squad events.</p>

          <div class="analysis-battery-grid">
            <div class="battery-tile">
              <span class="battery-metric-label">Speed & Elasticity</span>
              <strong>30m Sprint & CMJ</strong>
              <p>Measures max sprint velocity and reactive leg power. High CMJ + sub-4.2s 30m correlates with 6.5m+ LJ potential.</p>
            </div>
            <div class="battery-tile">
              <span class="battery-metric-label">Horizontal Power</span>
              <strong>Standing Broad & 5-Bound</strong>
              <p>Key indicators of horizontal force application and eccentric tolerance on touchdown.</p>
            </div>
            <div class="battery-tile">
              <span class="battery-metric-label">Triple Jump Ratio</span>
              <strong>Phase Balance Analysis</strong>
              <p>Target distribution: Hop 35%, Step 30%, Jump 35%. Identifies step collapse and energy preservation.</p>
            </div>
          </div>
        </article>

        <article class="analysis-card">
          <div class="builder-card-header">
            <div>
              <p class="eyebrow">Test Archive</p>
              <h2>Logged Squad Evaluations (${evaluations.length})</h2>
            </div>
            <button class="secondary-action compact-btn" type="button" data-view="comparison">
              Compare Attempts
            </button>
          </div>

          ${evaluations.length === 0 ? `
            <div class="empty-plan-card">
              <p>No evaluations recorded yet. Take field measurements with video verification to begin tracking squad trends.</p>
              <button class="primary-action" type="button" data-view="long-jump">Record First Evaluation</button>
            </div>
          ` : `
            <div class="admin-eval-table-wrapper">
              <table class="admin-eval-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th>Test</th>
                    <th>Result</th>
                    <th>Score</th>
                    <th>Rating</th>
                    <th>Video</th>
                  </tr>
                </thead>
                <tbody>
                  ${evaluations.slice(0, 15).map(rec => {
                    const testDef = getTestDefinition(rec.eventType, rec.testId);
                    return `
                      <tr>
                        <td>${escapeHtml(rec.createdAt.slice(0, 10))}</td>
                        <td>${rec.eventType === "long-jump" ? "LJ" : "TJ"}</td>
                        <td><strong>${escapeHtml(testDef?.title ?? rec.testId)}</strong></td>
                        <td>${escapeHtml(String(rec.resultValue))} ${escapeHtml(rec.resultUnit)}</td>
                        <td>${formatScore(rec.score)}/100</td>
                        <td><span class="rating-badge rating-${rec.rating.toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(rec.rating)}</span></td>
                        <td>${rec.video ? "🎥 Yes" : "—"}</td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          `}
        </article>
      </div>
    `}
  `;
}

function renderMiniMetric(label: string, value: string): string {
  return `
    <div class="mini-metric">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function renderStat(label: string, value: string): string {
  return `
    <div class="stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderScoreGauge(score: number | null, large = false): string {
  const display = formatScore(score);
  const gaugeValue = score ?? 0;
  const rank = getRankForScore(score);
  const tierClass = rank ? `gauge-${rank.tier.id}` : "gauge-bronze";
  const sizeClass = large ? " gauge-lg" : "";
  return `
    <div class="score-gauge ${tierClass}${sizeClass}" style="--score:${gaugeValue}">
      <strong>${display}</strong>
      <span>/100</span>
    </div>
  `;
}

function tierColorClass(rank: RankStatus | null): string {
  return rank ? `tier-${rank.tier.id}` : "";
}

function renderRankChip(rank: RankStatus | null): string {
  if (!rank) {
    return `<span class="rank-chip rank-empty">Unranked</span>`;
  }
  return `<span class="rank-chip ${tierColorClass(rank)}">${escapeHtml(rank.tier.label)}</span>`;
}

function renderRankProgress(rank: RankStatus | null): string {
  if (!rank) {
    return `<p class="muted" style="margin:0;font-size:0.82rem">Log a test to earn a rank.</p>`;
  }

  if (!rank.nextTier || rank.pointsToNext === null) {
    return `
      <div class="rank-progress ${tierColorClass(rank)}">
        <div class="rank-progress-track"><div class="rank-progress-fill" style="width:100%"></div></div>
        <div class="rank-progress-label"><strong>Top tier reached</strong><span>${rank.tier.label}</span></div>
      </div>
    `;
  }

  return `
    <div class="rank-progress ${tierColorClass(rank)}">
      <div class="rank-progress-track"><div class="rank-progress-fill" style="width:${rank.progressPct}%"></div></div>
      <div class="rank-progress-label">
        <strong>${rank.pointsToNext} pts to ${escapeHtml(rank.nextTier.label)}</strong>
        <span>${rank.tier.label}</span>
      </div>
    </div>
  `;
}

function renderContributionList(items: ReturnType<typeof calculateEventSummary>["strengths"], empty: string): string {
  if (items.length === 0) {
    return `<p class="muted">${empty}</p>`;
  }

  return `
    <ul class="pill-list">
      ${items
        .map(
          ({ test, record }) =>
            `<li><span>${test.shortTitle}</span><strong>${record.score}</strong></li>`
        )
        .join("")}
    </ul>
  `;
}

function bindAuthScreen(): void {
  qsa<HTMLButtonElement>("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      authMode = button.dataset.authMode === "sign-up" ? "sign-up" : "sign-in";
      authError = "";
      authMessage = "";
      render();
    });
  });

  const offlineButton = document.querySelector<HTMLButtonElement>("[data-offline-mode]");
  if (offlineButton) {
    offlineButton.addEventListener("click", () => {
      showAuthScreenExplicitly = false;
      if (profile) {
        activeView = "dashboard";
        notice = "Continuing in offline mode.";
      }
      render();
    });
  }

  const demoButton = document.querySelector<HTMLButtonElement>("[data-load-demo]");
  if (demoButton) {
    demoButton.addEventListener("click", () => {
      void loadDemoData();
    });
  }

  qs<HTMLFormElement>("#auth-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAuthForm(qs<HTMLFormElement>("#auth-form"));
  });
}

async function submitAuthForm(form: HTMLFormElement): Promise<void> {
  if (!supabase) {
    authError = "Supabase is not configured. You can continue offline.";
    render();
    return;
  }

  const email = qs<HTMLInputElement>("#auth-email", form).value.trim();
  const password = qs<HTMLInputElement>("#auth-password", form).value;
  authDraftEmail = email;
  authError = "";
  authMessage = "";

  if (!email) {
    authError = "Enter your email.";
    render();
    return;
  }

  if (password.length < 6) {
    authError = "Password must be at least 6 characters.";
    render();
    return;
  }

  let newProfile: AthleteProfile | null = null;

  if (authMode === "sign-up") {
    const parsedProfile = readAccountProfileForm(form);
    authDraftUsername = parsedProfile.username;
    authDraftDob = parsedProfile.dob;
    authDraftEvents = parsedProfile.events.length ? parsedProfile.events : authDraftEvents;
    authDraftRole = parsedProfile.role;
    authDraftMorning = parsedProfile.morningSessionsEnabled;

    if (parsedProfile.error) {
      authError = parsedProfile.error;
      render();
      return;
    }

    const now = new Date().toISOString();
    newProfile = {
      id: "local-athlete",
      username: parsedProfile.username,
      dob: parsedProfile.dob,
      events: parsedProfile.events,
      role: parsedProfile.role,
      morningSessionsEnabled: parsedProfile.morningSessionsEnabled,
      createdAt: now,
      updatedAt: now,
    };
  }

  authBusy = true;
  render();

  try {
    const result =
      authMode === "sign-up"
        ? await supabase.auth.signUp({
            email,
            password,
            options: newProfile
              ? {
                  emailRedirectTo: getAuthRedirectUrl(),
                  data: {
                    username: newProfile.username,
                    dob: newProfile.dob,
                    events: newProfile.events,
                    role: newProfile.role,
                    morningSessionsEnabled: newProfile.morningSessionsEnabled,
                  },
                }
              : undefined,
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      authError = result.error.message;
      return;
    }

    if (!result.data.session) {
      authMessage = "Account created. Check your email confirmation setting in Supabase, then sign in.";
      authMode = "sign-in";
      return;
    }

    await clearLocalAccountCache();

    if (authMode === "sign-up" && newProfile) {
      try {
        await upsertCloudProfile(result.data.session.user.id, newProfile);
      } catch (errorValue) {
        await supabase.auth.signOut();
        authError = formatCloudError(errorValue, "Could not create the account profile.");
        authSession = null;
        return;
      }
    }

    authSession = result.data.session;
    showAuthScreenExplicitly = false;
    activeView = "dashboard";
    await syncAccountAndReload({ resetLocalCache: true });
  } catch (errorValue) {
    const rawMsg = errorValue instanceof Error ? errorValue.message : "Authentication failed.";
    if (rawMsg.toLowerCase().includes("failed to fetch") || rawMsg.toLowerCase().includes("network")) {
      authError = "Cloud service unreachable (Supabase may be paused or offline). You can continue offline below.";
    } else {
      authError = rawMsg;
    }
  } finally {
    authBusy = false;
    render();
  }
}

function getAuthRedirectUrl(): string {
  return `${window.location.origin}/`;
}

function bindTodoView(): void {
  const athleteFilterSelect = document.querySelector<HTMLSelectElement>("#todo-athlete-filter");
  if (athleteFilterSelect) {
    athleteFilterSelect.addEventListener("change", (event) => {
      selectedAthleteFilter = (event.target as HTMLSelectElement).value;
      render();
    });
  }

  const resetFilterBtn = document.querySelector<HTMLButtonElement>("[data-reset-athlete-filter]");
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener("click", () => {
      selectedAthleteFilter = "all";
      render();
    });
  }

  const refreshAthleteBtn = document.querySelector<HTMLButtonElement>("#refresh-athlete-schedule-btn");
  if (refreshAthleteBtn) {
    refreshAthleteBtn.addEventListener("click", async () => {
      refreshAthleteBtn.disabled = true;
      refreshAthleteBtn.innerHTML = "⏳ Syncing...";
      try {
        const latest = await fetchLatestSquadTrainingPlan();
        if (latest) {
          trainingPlan = sanitizeTrainingPlan(latest);
          await saveTrainingPlan(trainingPlan);
          notice = "Synced latest squad workouts from coach.";
        } else {
          notice = "No coach training plan found in database.";
        }
      } catch (err) {
        notice = "Could not sync workouts: " + (err instanceof Error ? err.message : String(err));
      }
      render();
    });
  }

  const pushTodoBtn = document.querySelector<HTMLButtonElement>("#push-schedule-to-cloud-btn-todo");
  if (pushTodoBtn) {
    pushTodoBtn.addEventListener("click", async () => {
      pushTodoBtn.disabled = true;
      pushTodoBtn.innerHTML = "⏳ Pushing...";
      await pushScheduleToCloud();
      pushTodoBtn.disabled = false;
      pushTodoBtn.innerHTML = "<span class=\"btn-icon\">☁️</span> Push to Squad";
    });
  }

  qs<HTMLSelectElement>("#week-select").addEventListener("change", (event) => {
    selectedWeek = Number((event.target as HTMLSelectElement).value);
    notice = "";
    render();
  });

  qsa<HTMLButtonElement>("[data-toggle-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.dataset.toggleSection;
      if (!sectionId) return;
      void toggleTodoSection(sectionId);
    });
  });

  qsa<HTMLButtonElement>("[data-day-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDayId = button.dataset.dayId ?? selectedDayId;
      notice = "";
      render();
    });
  });

  qsa<HTMLInputElement>("[data-progress-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      void saveTodoCheckbox(checkbox);
    });
  });

  qsa<HTMLButtonElement>("[data-guide-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      activeGuideId = button.dataset.guideId ?? null;
      guideEditMode = false;
      render();
    });
  });

  qsa<HTMLElement>("[data-close-guide]").forEach((element) => {
    element.addEventListener("click", () => {
      activeGuideId = null;
      guideEditMode = false;
      render();
    });
  });

  qsa<HTMLButtonElement>("[data-edit-guide]").forEach((button) => {
    button.addEventListener("click", () => {
      activeGuideId = button.dataset.editGuide ?? activeGuideId;
      guideEditMode = true;
      render();
    });
  });

  qsa<HTMLButtonElement>("[data-cancel-guide-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      guideEditMode = false;
      render();
    });
  });

  const editForm = document.querySelector<HTMLFormElement>("#guide-edit-form");
  if (editForm) {
    editForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void saveGuideEdit(editForm);
    });
  }

  const planImport = document.querySelector<HTMLInputElement>("#plan-import");
  if (planImport) {
    planImport.addEventListener("change", (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      void importMarkdownPlan(file);
    });
  }
}

async function saveTodoCheckbox(checkbox: HTMLInputElement): Promise<void> {
  if (!trainingPlan) return;

  const progressId = checkbox.dataset.progressId;
  const itemId = checkbox.dataset.itemId;
  if (!progressId || !itemId) return;

  const now = new Date().toISOString();
  const progress: TodoProgress = {
    id: progressId,
    planId: trainingPlan.id,
    itemId,
    completed: checkbox.checked,
    completedAt: checkbox.checked ? now : undefined,
    updatedAt: now,
  };

  if (authSession) {
    void saveCloudFirst("todo progress", () =>
      upsertCloudTodoProgress(authSession!.user.id, progress)
    );
  }

  await saveTodoProgress(progress);
  todoProgress = upsertProgress(todoProgress, progress);
  render();
}

async function saveGuideEdit(form: HTMLFormElement): Promise<void> {
  if (!trainingPlan || !activeGuideId) return;
  const guide = trainingPlan.exerciseGuides[activeGuideId];
  if (!guide) return;

  const formData = new FormData(form);
  const websiteUrl = String(formData.get("websiteUrl") ?? "").trim();
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim();
  const error = qs<HTMLElement>("#guide-error", form);

  if (websiteUrl && !isValidUrl(websiteUrl)) {
    error.textContent = "Website URL must start with http:// or https://.";
    return;
  }

  if (youtubeUrl && !isValidUrl(youtubeUrl)) {
    error.textContent = "YouTube URL must start with http:// or https://.";
    return;
  }

  const updatedGuide: ExerciseGuide = {
    ...guide,
    equipment: splitCommaList(String(formData.get("equipment") ?? "")),
    steps: splitLines(String(formData.get("steps") ?? "")),
    coachingCues: splitLines(String(formData.get("coachingCues") ?? "")),
    commonMistakes: splitLines(String(formData.get("commonMistakes") ?? "")),
    safetyNotes: splitLines(String(formData.get("safetyNotes") ?? "")),
    externalLinks: {
      websiteUrl: websiteUrl || null,
      youtubeUrl: youtubeUrl || null,
    },
    updatedAt: new Date().toISOString(),
  };

  const nextPlan = {
    ...trainingPlan,
    exerciseGuides: {
      ...trainingPlan.exerciseGuides,
      [updatedGuide.id]: updatedGuide,
    },
    updatedAt: new Date().toISOString(),
  };

  if (authSession) {
    const cloudOk = await saveCloudFirst("training plan guide", () =>
      upsertCloudTrainingPlan(authSession!.user.id, nextPlan)
    );
    if (!cloudOk) {
      console.warn("Could not sync guide to cloud, saved locally.");
    }
  }

  trainingPlan = nextPlan;
  await saveTrainingPlan(trainingPlan);
  guideEditMode = false;
  notice = `${updatedGuide.title} guide updated ${authSession ? "and synced" : "locally"}.`;
  render();
}

async function importMarkdownText(markdown: string): Promise<void> {
  if (!trainingPlan) return;
  const nextPlan = parseMarkdownChecklist(markdown, trainingPlan);
  nextPlan.updatedAt = new Date().toISOString();

  if (authSession) {
    const cloudOk = await saveCloudFirst("imported weekly training plan", () =>
      upsertCloudTrainingPlan(authSession!.user.id, nextPlan)
    );
    if (!cloudOk) {
      console.warn("Cloud sync for imported plan failed, saved locally.");
    }
  }

  trainingPlan = nextPlan;
  await saveTrainingPlan(trainingPlan);
  todoProgress = await listTodoProgress(trainingPlan.id);
  const totalItems = countPlanItems(trainingPlan);
  notice = `Whole week plan imported successfully (${totalItems} total exercises scheduled). Linked to how-to guides.`;
  markdownModalOpen = false;
  render();
}

async function importMarkdownPlan(file: File): Promise<void> {
  const markdown = await file.text();
  await importMarkdownText(markdown);
}

function bindOnboarding(): void {
  const form = qs<HTMLFormElement>("#onboarding-form");
  const backBtn = form.querySelector<HTMLButtonElement>("[data-back-to-auth]");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      showAuthScreenExplicitly = true;
      render();
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = qs<HTMLElement>("#onboarding-error", form);
    error.textContent = "";

    const parsedProfile = readAccountProfileForm(form);
    if (parsedProfile.error) {
      error.textContent = parsedProfile.error;
      return;
    }

    const now = new Date().toISOString();
    const nextProfile: AthleteProfile = {
      id: "local-athlete",
      username: parsedProfile.username,
      dob: parsedProfile.dob,
      events: parsedProfile.events,
      role: parsedProfile.role,
      morningSessionsEnabled: parsedProfile.morningSessionsEnabled,
      createdAt: now,
      updatedAt: now,
    };

    const nextPlan = trainingPlan ?? createDefaultTrainingPlan();

    if (authSession) {
      try {
        await upsertCloudProfile(authSession.user.id, nextProfile);
        await upsertCloudTrainingPlan(authSession.user.id, nextPlan);
      } catch (errorValue) {
        console.warn("Could not sync profile to cloud:", errorValue);
      }
    }

    await saveProfile(nextProfile);
    await saveTrainingPlan(nextPlan);

    profile = nextProfile;
    trainingPlan = nextPlan;
    notice = authSession ? "Account profile created and synced." : "Local athlete profile created.";
    activeView = "dashboard";
    render();
  });
}

function bindAppShell(): void {
  const signOutButton = document.querySelector<HTMLButtonElement>("[data-sign-out]");
  if (signOutButton) {
    signOutButton.addEventListener("click", () => {
      void signOut();
    });
  }

  const switchAuthButton = document.querySelector<HTMLButtonElement>("[data-switch-auth]");
  if (switchAuthButton) {
    switchAuthButton.addEventListener("click", () => {
      showAuthScreenExplicitly = true;
      authError = "";
      authMessage = "";
      render();
    });
  }

  const dismissNoticeButton = document.querySelector<HTMLButtonElement>("[data-dismiss-notice]");
  if (dismissNoticeButton) {
    dismissNoticeButton.addEventListener("click", () => {
      notice = "";
      render();
    });
  }

  qsa<HTMLButtonElement>("[data-toggle-mobile-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      mobileMenuOpen = !mobileMenuOpen;
      render();
    });
  });

  qsa<HTMLElement>("[data-close-mobile-menu]").forEach((el) => {
    el.addEventListener("click", () => {
      mobileMenuOpen = false;
      render();
    });
  });

  qsa<HTMLElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.view as ViewId | undefined;
      if (!nextView) return;
      mobileMenuOpen = false;
      resetActiveEvaluation();
      activeGuideId = null;
      guideEditMode = false;
      activeView = nextView;
      notice = "";
      render();
    });
  });

  qsa<HTMLButtonElement>("[data-evaluate-event][data-evaluate-test]").forEach((button) => {
    button.addEventListener("click", () => {
      const eventType = button.dataset.evaluateEvent as EventType | undefined;
      const testId = button.dataset.evaluateTest;
      if (!eventType || !testId) return;
      openEvaluation(eventType, testId);
    });
  });

  qsa<HTMLButtonElement>("[data-edit-evaluation]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = evaluations.find((evaluation) => evaluation.id === button.dataset.editEvaluation);
      if (!record) return;
      openEvaluation(record.eventType, record.testId, record.id);
    });
  });

  qsa<HTMLButtonElement>("[data-delete-evaluation]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = evaluations.find((evaluation) => evaluation.id === button.dataset.deleteEvaluation);
      if (!record) return;
      void deleteSavedEvaluation(record);
    });
  });

  qsa<HTMLButtonElement>("[data-back-to-event]").forEach((button) => {
    button.addEventListener("click", () => {
      const eventType = button.dataset.backToEvent as EventType | undefined;
      resetActiveEvaluation();
      activeView = eventType ?? "dashboard";
      render();
    });
  });

  qsa<HTMLButtonElement>("[data-open-add-workout]").forEach((button) => {
    button.addEventListener("click", () => {
      workoutModalOpen = true;
      if (button.dataset.dayId) workoutModalDayId = button.dataset.dayId;
      if (button.dataset.sectionTitle) workoutModalSectionTitle = button.dataset.sectionTitle;
      if (button.dataset.assignTo) workoutModalAssignTo = button.dataset.assignTo;
      render();
    });
  });


  qsa<HTMLButtonElement>("[data-delete-workout-item]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const itemId = button.dataset.itemId;
      if (itemId) {
        void deleteWorkoutItem(button.dataset.scope ?? "", itemId);
      }
    });
  });

  qsa<HTMLElement>("[data-open-markdown-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      markdownModalOpen = true;
      render();
    });
  });

  const adminPlanImport = document.querySelector<HTMLInputElement>("#admin-plan-import");
  if (adminPlanImport) {
    adminPlanImport.addEventListener("change", (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      void importMarkdownPlan(file);
    });
  }

  bindWorkoutModalEvents();
  bindMarkdownModalEvents();
}

async function signOut(): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.auth.signOut();
  } catch (errorValue) {
    console.error(errorValue);
  }

  await clearLocalAccountCache();
  await loadLocalState({ saveDefaultTrainingPlan: false });
  authSession = null;
  profile = null;
  evaluations = [];
  legacyAttempts = [];
  activeView = "dashboard";
  activeEvaluation = null;
  activeGuideId = null;
  guideEditMode = false;
  authMessage = "Signed out. Sign in again to sync this device.";
  notice = "";
  render();
}

async function saveCloudFirst(label: string, action: () => Promise<void>): Promise<boolean> {
  if (!authSession) return false;

  try {
    await action();
    return true;
  } catch (errorValue) {
    console.error(`Cloud save failed: ${label}`, errorValue);
    return false;
  }
}

function bindEvaluationView(active: ActiveEvaluation): void {
  const form = qs<HTMLFormElement>("#evaluation-form");
  form.addEventListener("input", () => {
    const error = document.querySelector<HTMLElement>("#evaluation-error");
    if (error) error.textContent = "";
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveCurrentEvaluation(active);
  });

  qs<HTMLButtonElement>("#start-camera").addEventListener("click", () => {
    void startRecorderCamera();
  });
  qs<HTMLButtonElement>("#flip-camera").addEventListener("click", () => {
    void flipRecorderCamera();
  });
  qs<HTMLButtonElement>("#start-record").addEventListener("click", startEvidenceRecording);
  qs<HTMLButtonElement>("#stop-record").addEventListener("click", stopEvidenceRecording);
  qs<HTMLButtonElement>("#clear-video").addEventListener("click", () => {
    if (activeEvaluation) activeEvaluation.video = null;
    resetRecorderSession();
    render();
  });
}

function bindProfileView(): void {
  qs<HTMLFormElement>("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!profile) return;

    const form = qs<HTMLFormElement>("#profile-form");
    const error = qs<HTMLElement>("#profile-error");
    const parsedProfile = readAccountProfileForm(form);

    if (parsedProfile.error) {
      error.textContent = parsedProfile.error;
      return;
    }

    const nextProfile: AthleteProfile = {
      ...profile,
      username: parsedProfile.username,
      dob: parsedProfile.dob,
      events: parsedProfile.events,
      role: parsedProfile.role,
      morningSessionsEnabled: parsedProfile.morningSessionsEnabled,
      updatedAt: new Date().toISOString(),
    };

    profile = nextProfile;
    await saveProfile(profile);

    if (authSession) {
      try {
        await upsertCloudProfile(authSession.user.id, nextProfile);
      } catch (errorValue) {
        console.warn("Could not sync profile to cloud:", errorValue);
      }
    }

    activeView = "dashboard";
    notice = `Switched to ${nextProfile.role === "coach" ? "Coach" : "Athlete"} mode. Profile updated and saved.`;
    render();
  });
}

async function addWorkoutItem(
  dayId: string,
  sectionTitle: string,
  itemData: {
    label: string;
    setsReps?: string;
    category?: ExerciseCategory;
    notes?: string;
    exerciseId?: string;
    sessionType?: "morning" | "main";
    assignedTo?: string;
  }
): Promise<void> {
  if (!trainingPlan) return;

  const targetDay = trainingPlan.days.find((d) => d.id === dayId);
  if (!targetDay) return;

  let targetSection = targetDay.sections.find(
    (s) => s.title.toLowerCase().trim() === sectionTitle.toLowerCase().trim()
  );

  if (!targetSection) {
    const slug = sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    targetSection = {
      id: `${dayId}-${slug || "custom"}-${Date.now().toString(36)}`,
      title: sectionTitle.trim(),
      items: [],
    };
    targetDay.sections.push(targetSection);
  }

  const assignedTo = itemData.assignedTo && itemData.assignedTo !== "all" ? itemData.assignedTo.toLowerCase().trim() : undefined;

  const newItem = createWorkoutItem(itemData.label, {
    setsReps: itemData.setsReps,
    category: itemData.category,
    notes: itemData.notes,
    exerciseId: itemData.exerciseId,
    sessionType: itemData.sessionType,
    assignedTo,
  });

  targetSection.items.push(newItem);
  trainingPlan.updatedAt = new Date().toISOString();
  await saveTrainingPlan(trainingPlan);

  // Attempt to recover or verify session on demand if currently missing
  if (!authSession && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        authSession = data.session;
      }
    } catch {
      // offline
    }
  }

  let cloudSynced = false;
  let cloudErrorMsg = "";

  if (authSession) {
    try {
      await upsertCloudTrainingPlan(authSession.user.id, trainingPlan);
      cloudSynced = true;
    } catch (err) {
      cloudErrorMsg = err instanceof Error ? err.message : String(err);
      console.error("Cloud sync failed in addWorkoutItem:", err);
    }
  }

  const targetLabel = assignedTo ? `@${assignedTo}` : "entire squad";
  if (cloudSynced) {
    notice = `Added "${itemData.label}" for ${targetLabel} to ${targetDay.name} (${targetSection.title}) and synced to cloud.`;
  } else if (!authSession) {
    notice = `⚠️ Saved "${itemData.label}" for ${targetLabel} on this device only. (Not signed into Supabase: sign in to sync with athlete phones).`;
  } else {
    notice = `⚠️ Saved "${itemData.label}" locally, but cloud sync failed: ${cloudErrorMsg}`;
  }
  render();
}

async function pushScheduleToCloud(): Promise<void> {
  if (!trainingPlan) return;

  if (!authSession && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        authSession = data.session;
      }
    } catch {
      // offline
    }
  }

  if (!authSession) {
    notice = "⚠️ Cannot push to squad: You are in offline mode. Please sign into Supabase to sync workouts.";
    render();
    return;
  }

  try {
    trainingPlan.updatedAt = new Date().toISOString();
    await saveTrainingPlan(trainingPlan);
    await upsertCloudTrainingPlan(authSession.user.id, trainingPlan);

    let customCount = 0;
    for (const d of trainingPlan.days) {
      for (const s of d.sections) {
        for (const it of s.items) {
          if (it.assignedTo && it.assignedTo !== "all") customCount++;
        }
      }
    }

    notice = `✅ Pushed schedule to Supabase Cloud! Squad athlete devices (including ${customCount} tailored workout${customCount === 1 ? "" : "s"}) will update immediately.`;
  } catch (err) {
    notice = `❌ Cloud push failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  render();
}

async function deleteWorkoutItem(_scope: string, itemId: string): Promise<void> {
  if (!trainingPlan || !isCoach()) return;

  let found = false;

  for (const day of trainingPlan.days) {
    for (const section of day.sections) {
      const idx = section.items.findIndex((item) => item.id === itemId);
      if (idx !== -1) {
        section.items.splice(idx, 1);
        found = true;
        break;
      }
    }
    day.sections = day.sections.filter((s) => s.items.length > 0);
    if (found) break;
  }

  if (!found) {
    const dailyIdx = trainingPlan.dailyChecklist.findIndex((i) => i.id === itemId);
    if (dailyIdx !== -1) {
      trainingPlan.dailyChecklist.splice(dailyIdx, 1);
      found = true;
    }
  }

  if (found) {
    trainingPlan.updatedAt = new Date().toISOString();
    await saveTrainingPlan(trainingPlan);

    if (!authSession && supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) authSession = data.session;
      } catch {
        // offline
      }
    }

    let cloudSynced = false;
    if (authSession) {
      try {
        await upsertCloudTrainingPlan(authSession.user.id, trainingPlan);
        cloudSynced = true;
      } catch (err) {
        console.error("Cloud sync failed in deleteWorkoutItem:", err);
      }
    }

    notice = cloudSynced
      ? "Exercise removed from training plan and synced to cloud."
      : "Exercise removed locally (cloud sync offline).";
    render();
  }
}

async function clearAllWorkouts(): Promise<void> {
  if (!trainingPlan || !isCoach()) return;
  if (!confirm("Are you sure you want to clear all workouts for every day? This cannot be undone.")) {
    return;
  }

  trainingPlan = createDefaultTrainingPlan();
  trainingPlan.updatedAt = new Date().toISOString();
  await saveTrainingPlan(trainingPlan);
  if (authSession) {
    void saveCloudFirst("clear all workouts", () =>
      upsertCloudTrainingPlan(authSession!.user.id, trainingPlan!)
    );
  }
  notice = "All workouts cleared. Training plan reset to a clean slate.";
  render();
}

function bindWorkoutModalEvents(): void {
  qsa<HTMLElement>("[data-close-workout-modal]").forEach((el) => {
    el.addEventListener("click", () => {
      workoutModalOpen = false;
      render();
    });
  });

  qsa<HTMLButtonElement>("[data-set-section]").forEach((pill) => {
    pill.addEventListener("click", () => {
      const section = pill.dataset.setSection;
      const input = document.querySelector<HTMLInputElement>('#modal-workout-form input[name="sectionTitle"]');
      if (input && section) {
        input.value = section;
        workoutModalSectionTitle = section;
        qsa<HTMLButtonElement>("[data-set-section]").forEach((p) => p.classList.remove("is-selected"));
        pill.classList.add("is-selected");
      }
    });
  });

  const modalForm = document.querySelector<HTMLFormElement>("#modal-workout-form");
  if (modalForm) {
    modalForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(modalForm);
      const dayId = formData.get("dayId") as string;
      const sectionTitle = (formData.get("sectionTitle") as string)?.trim() || "Dynamic Warm-Up";
      const label = (formData.get("label") as string)?.trim();
      const setsReps = (formData.get("setsReps") as string)?.trim() || undefined;
      const category = (formData.get("category") as ExerciseCategory) || undefined;
      const notes = (formData.get("notes") as string)?.trim() || undefined;
      const sessionType = (formData.get("sessionType") as "morning" | "main") || "main";
      const assignedTo = (formData.get("assignedTo") as string)?.trim() || "all";

      const errEl = document.querySelector<HTMLElement>("#modal-workout-error");
      if (!label) {
        if (errEl) errEl.textContent = "Please enter an exercise name.";
        return;
      }
      if (errEl) errEl.textContent = "";

      const exerciseId = trainingPlan ? matchExerciseId(label, trainingPlan.exerciseGuides) : undefined;
      workoutModalOpen = false;
      await addWorkoutItem(dayId, sectionTitle, {
        label,
        setsReps,
        category,
        notes,
        exerciseId,
        sessionType,
        assignedTo,
      });
    });
  }
}

function bindMarkdownModalEvents(): void {
  qsa<HTMLElement>("[data-close-markdown-modal]").forEach((el) => {
    el.addEventListener("click", () => {
      markdownModalOpen = false;
      render();
    });
  });

  const loadSampleBtn = document.querySelector<HTMLButtonElement>("#load-sample-md-btn");
  if (loadSampleBtn) {
    loadSampleBtn.addEventListener("click", () => {
      const textarea = document.querySelector<HTMLTextAreaElement>("#markdown-import-textarea");
      if (textarea) {
        textarea.value = SAMPLE_WEEKLY_MARKDOWN;
      }
    });
  }

  const clearBtn = document.querySelector<HTMLButtonElement>("#clear-md-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const textarea = document.querySelector<HTMLTextAreaElement>("#markdown-import-textarea");
      if (textarea) {
        textarea.value = "";
      }
    });
  }

  const form = document.querySelector<HTMLFormElement>("#markdown-import-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const textarea = document.querySelector<HTMLTextAreaElement>("#markdown-import-textarea");
      const text = textarea?.value.trim() ?? "";
      const errorEl = document.querySelector<HTMLElement>("#markdown-import-error");

      if (!text) {
        if (errorEl) errorEl.textContent = "Please enter or paste markdown text.";
        return;
      }
      if (errorEl) errorEl.textContent = "";

      await importMarkdownText(text);
    });
  }
}

function bindAdminView(): void {
  qsa<HTMLButtonElement>("[data-admin-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.adminTab as "students" | "workouts" | "analysis" | undefined;
      if (tab) {
        adminTab = tab;
        render();
      }
    });
  });

  const pushBtn = document.querySelector<HTMLButtonElement>("#push-schedule-to-cloud-btn");
  if (pushBtn) {
    pushBtn.addEventListener("click", async () => {
      pushBtn.disabled = true;
      pushBtn.innerHTML = "⏳ Pushing to Squad...";
      await pushScheduleToCloud();
      pushBtn.disabled = false;
      pushBtn.innerHTML = "☁️ Push Schedule to Squad";
    });
  }

  qsa<HTMLButtonElement>("[data-push-cloud-now]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.innerHTML = "⏳ Pushing...";
      await pushScheduleToCloud();
      btn.disabled = false;
      btn.innerHTML = "☁️ Push to Cloud";
    });
  });

  // Student selection buttons (pills and cards)
  qsa<HTMLButtonElement>("[data-select-student]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const username = btn.dataset.selectStudent;
      if (!username || username === "all") {
        activeStudentUsername = null;
      } else {
        activeStudentUsername = username;
      }
      render();
    });
  });

  // DB Refresh buttons
  const handleRefreshStudents = async (btn: HTMLButtonElement | null) => {
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = "⏳ Refreshing...";
    try {
      await loadSquadAthletes();
      if (squadAthletes.length === 0) {
        notice = "Supabase returned 0 student athlete profiles. If athletes have registered in the database, ensure you run the SQL in supabase/schema.sql in your Supabase SQL editor so the coach account has permission to read other profiles.";
      } else {
        notice = `Retrieved ${squadAthletes.length} student athlete${squadAthletes.length > 1 ? "s" : ""} from database: ${squadAthletes.map((a) => "@" + a.username).join(", ")}.`;
      }
    } catch (err) {
      notice = "Could not refresh from database: " + (err instanceof Error ? err.message : String(err));
    }
    render();
  };

  const refreshBtn = document.querySelector<HTMLButtonElement>("#refresh-students-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => void handleRefreshStudents(refreshBtn));
  }

  const refreshEmptyBtn = document.querySelector<HTMLButtonElement>("#refresh-students-empty-btn");
  if (refreshEmptyBtn) {
    refreshEmptyBtn.addEventListener("click", () => void handleRefreshStudents(refreshEmptyBtn));
  }

  // Morning session 1-click toggle buttons
  qsa<HTMLButtonElement>("[data-toggle-athlete-morning]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const username = btn.dataset.toggleAthleteMorning;
      if (username) {
        void toggleAthleteMorningSessions(username);
      }
    });
  });

  // Prescribe workout for specific athlete button
  qsa<HTMLButtonElement>("[data-coach-add-workout-for]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const username = btn.dataset.coachAddWorkoutFor;
      if (username) {
        activeStudentUsername = username;
        adminTab = "students";
        render();
      }
    });
  });

  // Prescribe form preset section buttons
  qsa<HTMLButtonElement>("[data-student-set-section]").forEach((pill) => {
    pill.addEventListener("click", () => {
      const section = pill.dataset.studentSetSection;
      const input = document.querySelector<HTMLInputElement>("#student-section-input");
      if (input && section) {
        input.value = section;
        qsa<HTMLButtonElement>("[data-student-set-section]").forEach((p) => p.classList.remove("is-selected"));
        pill.classList.add("is-selected");
      }
    });
  });

  // Quick-add shortcut on each day card
  qsa<HTMLButtonElement>("[data-student-quick-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dayId = btn.dataset.studentQuickAdd;
      if (dayId) {
        const daySelect = document.querySelector<HTMLSelectElement>("#student-prescribe-day-select");
        if (daySelect) {
          daySelect.value = dayId;
        }
        const labelInput = document.querySelector<HTMLInputElement>("#student-prescribe-label-input");
        if (labelInput) {
          labelInput.focus();
          labelInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    });
  });

  // Dedicated Student Prescription Form Submission
  const studentPrescribeForm = document.querySelector<HTMLFormElement>("#student-prescribe-form");
  if (studentPrescribeForm) {
    studentPrescribeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(studentPrescribeForm);
      const dayId = formData.get("dayId") as string;
      const sectionTitle = (formData.get("sectionTitle") as string)?.trim() || "Dynamic Warm-Up";
      const label = (formData.get("label") as string)?.trim();
      const setsReps = (formData.get("setsReps") as string)?.trim() || undefined;
      const category = (formData.get("category") as ExerciseCategory) || undefined;
      const notes = (formData.get("notes") as string)?.trim() || undefined;
      const sessionType = (formData.get("sessionType") as "morning" | "main") || "main";
      const assignedTo = (formData.get("assignedTo") as string)?.trim() || activeStudentUsername || undefined;

      const errEl = document.querySelector<HTMLElement>("#student-prescribe-error");
      if (!label) {
        if (errEl) errEl.textContent = "Please enter an exercise name.";
        return;
      }
      if (errEl) errEl.textContent = "";

      const exerciseId = trainingPlan ? matchExerciseId(label, trainingPlan.exerciseGuides) : undefined;
      await addWorkoutItem(dayId, sectionTitle, {
        label,
        setsReps,
        category,
        notes,
        exerciseId,
        sessionType,
        assignedTo,
      });
    });
  }

  // View specific athlete schedule button
  qsa<HTMLButtonElement>("[data-coach-view-athlete-plan]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const username = btn.dataset.coachViewAthletePlan;
      if (username) {
        selectedAthleteFilter = username;
        activeView = "todo";
        render();
      }
    });
  });

  // Remove athlete from squad button
  qsa<HTMLButtonElement>("[data-coach-remove-athlete]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const username = btn.dataset.coachRemoveAthlete;
      if (!username) return;
      if (!confirm(`Are you sure you want to remove @${username} from the squad roster?`)) return;
      squadAthletes = squadAthletes.filter((a) => a.username.toLowerCase() !== username.toLowerCase());
      notice = `Removed @${username} from squad roster view.`;
      render();
    });
  });

  // Filter in Weekly Schedule Manager
  const adminAthleteFilter = document.querySelector<HTMLSelectElement>("#admin-athlete-filter");
  if (adminAthleteFilter) {
    adminAthleteFilter.addEventListener("change", (e) => {
      selectedAthleteFilter = (e.target as HTMLSelectElement).value;
      render();
    });
  }

  qsa<HTMLButtonElement>("[data-builder-set-section]").forEach((pill) => {
    pill.addEventListener("click", () => {
      const section = pill.dataset.builderSetSection;
      const input = document.querySelector<HTMLInputElement>("#builder-section-input");
      if (input && section) {
        input.value = section;
        qsa<HTMLButtonElement>("[data-builder-set-section]").forEach((p) => p.classList.remove("is-selected"));
        pill.classList.add("is-selected");
      }
    });
  });

  const builderForm = document.querySelector<HTMLFormElement>("#workout-builder-form");
  if (builderForm) {
    builderForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(builderForm);
      const dayId = formData.get("dayId") as string;
      const sectionTitle = (formData.get("sectionTitle") as string)?.trim() || "Dynamic Warm-Up";
      const label = (formData.get("label") as string)?.trim();
      const setsReps = (formData.get("setsReps") as string)?.trim() || undefined;
      const category = (formData.get("category") as ExerciseCategory) || undefined;
      const notes = (formData.get("notes") as string)?.trim() || undefined;
      const sessionType = (formData.get("sessionType") as "morning" | "main") || "main";
      const assignedTo = (formData.get("assignedTo") as string)?.trim() || "all";

      const errEl = document.querySelector<HTMLElement>("#builder-error");
      if (!label) {
        if (errEl) errEl.textContent = "Please enter an exercise name.";
        return;
      }
      if (errEl) errEl.textContent = "";

      const exerciseId = trainingPlan ? matchExerciseId(label, trainingPlan.exerciseGuides) : undefined;
      await addWorkoutItem(dayId, sectionTitle, {
        label,
        setsReps,
        category,
        notes,
        exerciseId,
        sessionType,
        assignedTo,
      });
    });
  }

  const clearBtn = document.querySelector<HTMLButtonElement>("[data-clear-all-workouts]");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      void clearAllWorkouts();
    });
  }
}

function openEvaluation(eventType: EventType, testId: string, recordId?: string): void {
  const existingRecord = recordId
    ? evaluations.find((record) => record.id === recordId)
    : undefined;

  resetRecorderSession();
  activeView = eventType;
  activeEvaluation = {
    eventType,
    testId,
    recordId,
    video: existingRecord?.video ?? null,
  };
  notice = "";
  render();
}

async function deleteSavedEvaluation(record: EvaluationRecord): Promise<void> {
  const test = getTestDefinition(record.eventType, record.testId);
  const ok = window.confirm(
    `Delete ${test?.shortTitle ?? record.testId} from ${formatDateTime(record.createdAt)}? This cannot be undone.`
  );
  if (!ok) return;

  if (authSession) {
    const cloudOk = await saveCloudFirst("delete evaluation", () =>
      deleteCloudEvaluation(authSession!.user.id, record.id)
    );
    if (!cloudOk) {
      console.warn("Could not delete from cloud, proceeding with local delete.");
    }
  }

  await deleteEvaluation(record.id);
  evaluations = await listEvaluations();
  notice = `${test?.shortTitle ?? "Evaluation"} deleted.`;
  render();
}

async function saveCurrentEvaluation(active: ActiveEvaluation): Promise<void> {
  const test = getTestDefinition(active.eventType, active.testId);
  if (!test) return;

  const parsed = readEvaluationInputs(test, true);
  const error = qs<HTMLElement>("#evaluation-error");

  if (!parsed.complete || parsed.error) {
    error.textContent = parsed.error ?? "Complete every required measurement.";
    return;
  }

  try {
    const result = test.calculate(parsed.values);
    const existingRecord = active.recordId
      ? evaluations.find((record) => record.id === active.recordId)
      : undefined;
    const record: EvaluationRecord = {
      id: existingRecord?.id ?? crypto.randomUUID(),
      eventType: active.eventType,
      testId: active.testId,
      createdAt: existingRecord?.createdAt ?? new Date().toISOString(),
      inputs: parsed.values,
      resultValue: result.value,
      resultUnit: result.unit,
      score: result.score,
      zScore: result.zScore,
      rating: result.rating,
      video: active.video
        ? {
            blob: active.video.blob,
            mimeType: active.video.mimeType,
            durationMs: active.video.durationMs,
          }
        : undefined,
    };

    if (authSession) {
      const cloudOk = await saveCloudFirst("evaluation", () =>
        upsertCloudEvaluation(authSession!.user.id, record)
      );
      if (!cloudOk) {
        await saveEvaluation(record);
        evaluations = await listEvaluations();
        resetActiveEvaluation();
        activeView = record.eventType;
        notice = `${test.shortTitle} ${existingRecord ? "updated" : "saved"} locally (cloud sync unavailable).`;
        render();
        return;
      }
    }

    await saveEvaluation(record);
    evaluations = await listEvaluations();
    resetActiveEvaluation();
    activeView = record.eventType;
    notice = `${test.shortTitle} ${existingRecord ? "updated" : "saved"} ${authSession ? "and synced" : "locally"}: ${record.score}/100, z ${formatZScore(record.zScore)}.`;
    render();
  } catch (errorValue) {
    error.textContent = errorValue instanceof Error ? errorValue.message : "Could not calculate score.";
  }
}

function readEvaluationInputs(
  test: TestDefinition,
  requireComplete: boolean
): { values: Record<string, number>; complete: boolean; error: string | null } {
  const values: Record<string, number> = {};

  for (const input of test.inputs) {
    const element = document.querySelector<HTMLInputElement>(`[name="${input.id}"]`);
    const rawValue = element?.value.trim() ?? "";

    if (!rawValue) {
      if (requireComplete) {
        return {
          values,
          complete: false,
          error: `${input.label} is required.`,
        };
      }

      return { values, complete: false, error: null };
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      return { values, complete: false, error: `${input.label} must be a number.` };
    }

    if (value < input.min || value > input.max) {
      return {
        values,
        complete: false,
        error: `${input.label} must be between ${input.min} and ${input.max} ${input.unit}.`,
      };
    }

    values[input.id] = value;
  }

  return { values, complete: true, error: null };
}

async function startRecorderCamera(): Promise<void> {
  const preview = document.querySelector<HTMLVideoElement>("#recorder-preview");
  if (!preview) return;

  try {
    if (currentStream) {
      stopCamera(currentStream);
      currentStream = null;
    }

    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
      currentPreviewUrl = null;
    }

    preview.src = "";
    preview.controls = false;
    currentStream = await startCamera(preview, {
      video: { facingMode: { ideal: cameraFacing } },
      audio: false,
    });
    updateRecorderUi("Camera ready.");
  } catch (errorValue) {
    console.error(errorValue);
    updateRecorderUi("Camera access denied or unavailable.");
  }
}

async function flipRecorderCamera(): Promise<void> {
  const preview = document.querySelector<HTMLVideoElement>("#recorder-preview");
  if (!preview || !currentStream) return;

  if (currentRecording?.recorder.state === "recording") return;

  cameraFacing = cameraFacing === "environment" ? "user" : "environment";

  try {
    stopCamera(currentStream);
    currentStream = null;
    preview.srcObject = null;
    currentStream = await startCamera(preview, {
      video: { facingMode: { ideal: cameraFacing } },
      audio: false,
    });
    updateRecorderUi("Camera switched.");
  } catch (errorValue) {
    console.error(errorValue);
    cameraFacing = cameraFacing === "environment" ? "user" : "environment";
    updateRecorderUi("Could not switch camera on this device.");
  }
}

function startEvidenceRecording(): void {
  if (!currentStream || !activeEvaluation) return;

  isCancellingRecording = false;
  activeEvaluation.video = null;
  currentRecording = recordVideo(currentStream, MAX_RECORDING_MS);
  recordStartedAt = Date.now();
  setTimeLeft(MAX_RECORDING_MS);

  countdownTimer = window.setInterval(() => {
    const elapsed = Date.now() - recordStartedAt;
    const remaining = Math.max(0, MAX_RECORDING_MS - elapsed);
    setTimeLeft(remaining);
    if (remaining <= 0) stopCountdown();
  }, 250);

  updateRecorderUi("Recording evidence.");

  currentRecording.done
    .then((result) => {
      if (isCancellingRecording || !activeEvaluation) return;

      activeEvaluation.video = result;
      if (currentStream) {
        stopCamera(currentStream);
        currentStream = null;
      }
      currentRecording = null;
      stopCountdown();
      setPreviewFromBlob(result.blob);
      updateRecorderUi(`Evidence captured: ${formatMs(result.durationMs)}.`);
    })
    .catch((errorValue) => {
      console.error(errorValue);
      currentRecording = null;
      stopCountdown();
      updateRecorderUi("Recording failed.");
    });
}

function stopEvidenceRecording(): void {
  if (currentRecording?.recorder.state === "recording") {
    currentRecording.stop();
  }
}

function resetActiveEvaluation(): void {
  resetRecorderSession();
  activeEvaluation = null;
}

function resetRecorderSession(): void {
  stopCountdown();
  isCancellingRecording = true;

  if (currentRecording?.recorder.state === "recording") {
    currentRecording.stop();
  }
  currentRecording = null;

  if (currentStream) {
    stopCamera(currentStream);
    currentStream = null;
  }

  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = null;
  }

  cameraFacing = "environment";
}

function updateRecorderUi(message?: string): void {
  const isRecording = currentRecording?.recorder.state === "recording";
  const hasVideo = Boolean(activeEvaluation?.video);
  const startCameraButton = document.querySelector<HTMLButtonElement>("#start-camera");
  const flipButton = document.querySelector<HTMLButtonElement>("#flip-camera");
  const startRecordButton = document.querySelector<HTMLButtonElement>("#start-record");
  const stopRecordButton = document.querySelector<HTMLButtonElement>("#stop-record");
  const clearButton = document.querySelector<HTMLButtonElement>("#clear-video");
  const cameraLabel = document.querySelector<HTMLElement>("#camera-label");
  const status = document.querySelector<HTMLElement>("#recording-status");

  if (!startCameraButton || !flipButton || !startRecordButton || !stopRecordButton || !clearButton) {
    return;
  }

  startCameraButton.disabled = Boolean(currentStream) || isRecording;
  flipButton.disabled = !currentStream || isRecording;
  startRecordButton.disabled = !currentStream || isRecording;
  stopRecordButton.disabled = !isRecording;
  clearButton.disabled = !hasVideo && !currentStream;

  if (cameraLabel) {
    cameraLabel.textContent = cameraFacing === "environment" ? "Camera: Back" : "Camera: Front";
  }

  if (status && message) {
    status.textContent = message;
  }
}

function setPreviewFromBlob(blob: Blob): void {
  const preview = document.querySelector<HTMLVideoElement>("#recorder-preview");
  if (!preview) return;

  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
  }

  currentPreviewUrl = URL.createObjectURL(blob);
  preview.srcObject = null;
  preview.src = currentPreviewUrl;
  preview.controls = true;
}

function setTimeLeft(msLeft: number): void {
  const timeRemaining = document.querySelector<HTMLElement>("#time-remaining");
  if (timeRemaining) {
    timeRemaining.textContent = `Time left: ${formatMs(msLeft)}`;
  }
}

function stopCountdown(): void {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

async function toggleTodoSection(sectionId: string): Promise<void> {
  const currentlyCollapsed = isTodoSectionCollapsed(sectionId);
  const preference: TodoSectionPreference = {
    id: sectionId,
    sectionId,
    collapsed: !currentlyCollapsed,
    updatedAt: new Date().toISOString(),
  };

  if (authSession) {
    void saveCloudFirst("todo section preference", () =>
      upsertCloudTodoSectionPreference(authSession!.user.id, preference)
    );
  }

  await saveTodoSectionPreference(preference);
  todoSectionPreferences = upsertSectionPreference(todoSectionPreferences, preference);
  render();
}

function isTodoSectionCollapsed(sectionId: string): boolean {
  const preference = todoSectionPreferences.find((record) => record.sectionId === sectionId);
  return preference?.collapsed ?? true;
}

function upsertSectionPreference(
  records: TodoSectionPreference[],
  next: TodoSectionPreference
): TodoSectionPreference[] {
  const existingIndex = records.findIndex((record) => record.sectionId === next.sectionId);
  if (existingIndex === -1) return [...records, next];
  return records.map((record, index) => (index === existingIndex ? next : record));
}

function collectVisibleProgressIds(
  plan: TrainingPlanTemplate,
  day: TrainingDayPlan,
  phase: ReturnType<typeof getPhaseForWeek>,
  filterAthlete: string = "all"
): string[] {
  const isAssigned = (todoItem: TrainingTodoItem): boolean => {
    if (filterAthlete === "all") return true;
    if (!todoItem.assignedTo || todoItem.assignedTo === "all" || todoItem.assignedTo === "squad") return true;
    return todoItem.assignedTo.toLowerCase() === filterAthlete.toLowerCase();
  };

  const ids = [
    ...plan.dailyChecklist.filter(isAssigned).map((todoItem) => makeProgressId("daily", todoItem.id)),
    ...day.sections.flatMap((section) =>
      section.items.filter(isAssigned).map((todoItem) =>
        makeProgressId(`week-${selectedWeek}-${day.id}-${section.id}`, todoItem.id)
      )
    ),
    ...phase.items.filter(isAssigned).map((todoItem) => makeProgressId(`phase-${selectedWeek}`, todoItem.id)),
    ...plan.personalReminders.filter(isAssigned).map((todoItem) => makeProgressId("personal-reminders", todoItem.id)),
    ...plan.importedSections.flatMap((section) =>
      section.items.filter(isAssigned).map((todoItem) => makeProgressId(`imported-${section.id}`, todoItem.id))
    ),
  ];

  return ids;
}

function makeProgressId(scope: string, itemId: string): string {
  return `${scope}:${itemId}`;
}

function isTodoComplete(progressId: string): boolean {
  return Boolean(todoProgress.find((record) => record.id === progressId)?.completed);
}

function upsertProgress(records: TodoProgress[], next: TodoProgress): TodoProgress[] {
  const existingIndex = records.findIndex((record) => record.id === next.id);
  if (existingIndex === -1) return [...records, next];
  return records.map((record, index) => (index === existingIndex ? next : record));
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((itemValue) => itemValue.trim())
    .filter(Boolean);
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const hostname = url.hostname.toLowerCase();
    if (!hostname || hostname === "localhost" || !hostname.includes(".")) return false;
    if (hostname.startsWith(".") || hostname.endsWith(".") || hostname.includes("..")) return false;

    return hostname.split(".").every((label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    );
  } catch {
    return false;
  }
}

function recordsForTest(eventType: EventType, testId: string): EvaluationRecord[] {
  return evaluations.filter(
    (record) => record.eventType === eventType && record.testId === testId
  );
}

function readAccountProfileForm(form: HTMLFormElement): {
  username: string;
  dob: string;
  events: EventType[];
  role: UserRole;
  morningSessionsEnabled: boolean;
  error: string | null;
} {
  const usernameInput = form.querySelector<HTMLInputElement>('input[name="username"]');
  const dobInput = form.querySelector<HTMLInputElement>('input[name="dob"]');
  const username = (usernameInput?.value.trim() ?? "").toLowerCase();
  const dob = dobInput?.value.trim() ?? "";
  const events = selectedEventValues(form);

  const roleRadio = form.querySelector<HTMLInputElement>('input[name="role"]:checked');
  const roleSelect = form.querySelector<HTMLSelectElement>('select[name="role"]');
  const roleValue = (roleRadio?.value ?? roleSelect?.value) as UserRole | undefined;
  const role: UserRole = roleValue === "coach" ? "coach" : "athlete";

  const morningInput = form.querySelector<HTMLInputElement>('input[name="morningSessionsEnabled"]');
  const morningSessionsEnabled = Boolean(morningInput?.checked);

  if (!username) {
    return { username, dob, events, role, morningSessionsEnabled, error: "Enter a username." };
  }

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return {
      username,
      dob,
      events,
      role,
      morningSessionsEnabled,
      error: "Username must be 3-24 characters using lowercase letters, numbers, or underscore.",
    };
  }

  if (!dob) {
    return { username, dob, events, role, morningSessionsEnabled, error: "Enter date of birth." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(new Date(`${dob}T00:00:00`).getTime())) {
    return { username, dob, events, role, morningSessionsEnabled, error: "Date of birth must be a valid date." };
  }

  if (dob > new Date().toISOString().slice(0, 10)) {
    return { username, dob, events, role, morningSessionsEnabled, error: "Date of birth cannot be in the future." };
  }

  if (events.length === 0) {
    return { username, dob, events, role, morningSessionsEnabled, error: "Select at least one event." };
  }

  return { username, dob, events, role, morningSessionsEnabled, error: null };
}

function formatCloudError(errorValue: unknown, fallback: string): string {
  const message =
    errorValue instanceof Error
      ? errorValue.message
      : typeof errorValue === "object" && errorValue && "message" in errorValue
        ? String((errorValue as { message: unknown }).message)
        : "";

  if (/duplicate|unique|profiles_username/i.test(message)) {
    return "Username is already taken. Try another username.";
  }

  if (/row-level|policy|permission/i.test(message)) {
    return `${fallback} Supabase blocked the write. Run the latest schema.sql and check RLS policies.`;
  }

  return message ? `${fallback} ${message}` : fallback;
}

function selectedEventValues(form: HTMLFormElement): EventType[] {
  const values = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="events"]:checked'))
    .map((input) => input.value)
    .filter((value): value is EventType => value === "long-jump" || value === "triple-jump");

  return values;
}

function createRenderedVideoUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  renderedVideoUrls.push(url);
  return url;
}

function cleanupRenderedVideoUrls(): void {
  for (const url of renderedVideoUrls) {
    URL.revokeObjectURL(url);
  }
  renderedVideoUrls = [];
}

function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function qs<T extends HTMLElement>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element as T;
}

function qsa<T extends HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll(selector)) as T[];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return replacements[character] ?? character;
  });
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

window.addEventListener("beforeunload", () => {
  resetRecorderSession();
  cleanupRenderedVideoUrls();
});
