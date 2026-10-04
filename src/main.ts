import "./style.css";

import {
  clearLocalAccountCache,
  deleteCloudEvaluation,
  synchronizeUserData,
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
  findCurrentDayId,
  getPhaseForWeek,
  parseMarkdownChecklist,
} from "./trainingPlan";
import type {
  AthleteProfile,
  Attempt,
  EvaluationRecord,
  EventType,
  ExerciseGuide,
  TodoProgress,
  TodoSectionPreference,
  TrainingDayPlan,
  TrainingPlanTemplate,
  TrainingTodoItem,
} from "./types";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type { AuthSession } from "./supabaseClient";

type ViewId = "dashboard" | "todo" | EventType | "comparison" | "videos" | "profile";

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
        setTimeout(() => reject(new Error("Supabase auth timeout")), 2000)
      );
      const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);
      if (error) {
        authError = error.message;
      }
      authSession = data?.session ?? null;
    } catch {
      console.warn("Supabase connection bypassed (unreachable or paused). Continuing in offline-capable mode.");
      authSession = null;
    }
  }

  await loadLocalState({ saveDefaultTrainingPlan: false });

  if (authSession) {
    await syncAccountAndReload();
  }

  render();
}

async function loadLocalState(options: { saveDefaultTrainingPlan: boolean }): Promise<void> {
  profile = (await getProfile()) ?? null;
  evaluations = await listEvaluations();
  legacyAttempts = await listAttempts();

  const cachedTrainingPlan = await getTrainingPlan();
  trainingPlan = cachedTrainingPlan ?? createDefaultTrainingPlan();
  if (!cachedTrainingPlan && options.saveDefaultTrainingPlan) {
    await saveTrainingPlan(trainingPlan);
  }

  todoProgress = await listTodoProgress(trainingPlan.id);
  todoSectionPreferences = await listTodoSectionPreferences();
}

async function syncAccountAndReload(options: { resetLocalCache?: boolean } = {}): Promise<void> {
  if (!authSession) return;

  try {
    const result = await synchronizeUserData(authSession.user.id, options);
    await loadLocalState({ saveDefaultTrainingPlan: true });
    notice = result.message;
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
          <input id="auth-username" name="username" type="text" autocomplete="username" value="${escapeAttribute(authDraftUsername)}" placeholder="bibin_sanju" required />
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
          <input id="profile-setup-username" name="username" type="text" autocomplete="username" placeholder="bibin_sanju" required />
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
      <aside class="sidebar">
        <div class="brand-block">
          <span class="brand-mark">WIN</span>
          <span class="brand-subtitle">Jumper Lab</span>
        </div>

        <nav class="side-nav" aria-label="Main navigation">
          ${renderNavButton("dashboard", "Dashboard")}
          ${renderNavButton("todo", "Todo")}
          ${profile.events.includes("long-jump") ? renderNavButton("long-jump", "Long Jump") : ""}
          ${profile.events.includes("triple-jump") ? renderNavButton("triple-jump", "Triple Jump") : ""}
          ${renderNavButton("comparison", "Comparison")}
          ${renderNavButton("videos", "Videos")}
          ${renderNavButton("profile", "Profile")}
        </nav>

        <div class="profile-chip">
          <span>@${escapeHtml(profile.username)}</span>
          <small>${profile.events.map((eventType) => EVENT_LABELS[eventType]).join(" / ")}</small>
          <small>${escapeHtml(authSession?.user.email ?? "Synced account")}</small>
          ${
            authSession
              ? `<button class="sidebar-signout" type="button" data-sign-out>Sign out</button>`
              : ""
          }
        </div>
      </aside>

      <main class="workspace">
        ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ""}
        ${content}
      </main>
      ${renderGuideDrawer()}
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

function renderCurrentView(): string {
  if (!profile) return "";

  switch (activeView) {
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

function renderTodoView(): string {
  if (!trainingPlan) return "";

  const day = trainingPlan.days.find((candidate) => candidate.id === selectedDayId) ?? trainingPlan.days[0];
  if (!day) return "";

  const phase = getPhaseForWeek(trainingPlan, selectedWeek);
  const visibleIds = collectVisibleProgressIds(trainingPlan, day, phase);
  const completedCount = visibleIds.filter((id) => isTodoComplete(id)).length;
  const completion = visibleIds.length > 0 ? Math.round((completedCount / visibleIds.length) * 100) : 0;
  const guideCount = Object.keys(trainingPlan.exerciseGuides).length;

  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Training todo</p>
        <h1>${escapeHtml(trainingPlan.title)}</h1>
        <p class="lead">${escapeHtml(trainingPlan.trainingTime)} | ${escapeHtml(trainingPlan.targetPeriod)}</p>
      </div>
      <div class="header-metrics">
        ${renderMiniMetric("Complete", `${completion}%`)}
        ${renderMiniMetric("Guides", String(guideCount))}
        ${renderMiniMetric("Items", String(countPlanItems(trainingPlan)))}
      </div>
    </section>

    <section class="todo-controls">
      <label class="field compact-field">
        <span>Week</span>
        <select id="week-select">
          ${Array.from({ length: 12 }, (_, index) => {
            const week = index + 1;
            return `<option value="${week}" ${week === selectedWeek ? "selected" : ""}>Week ${week}</option>`;
          }).join("")}
        </select>
      </label>

      <div class="import-control">
        <input id="plan-import" type="file" accept=".md,text/markdown,text/plain" />
        <label class="secondary-action" for="plan-import">Import MD plan</label>
      </div>
    </section>

    <section class="day-tabs" aria-label="Training days">
      ${trainingPlan.days
        .map(
          (candidate) => `
            <button class="day-tab ${candidate.id === day.id ? "is-active" : ""}" type="button" data-day-id="${candidate.id}">
              ${candidate.name}
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
              <p class="eyebrow">Week ${selectedWeek} | ${day.name}</p>
              <h2>${escapeHtml(day.title)}</h2>
              <p>${escapeHtml(day.focus)}</p>
            </div>
            ${renderScoreGauge(completion)}
          </div>
        </article>

        ${renderTodoSection("daily", "Daily Training Checklist", trainingPlan.dailyChecklist)}
        ${day.sections
          .map((section) => renderTodoSection(`week-${selectedWeek}-${day.id}-${section.id}`, section.title, section.items, section.note))
          .join("")}
        ${renderTodoSection(`phase-${selectedWeek}`, `${phase.weekRange} - ${phase.title}`, phase.items, phase.goal)}
        ${renderImportedSections(trainingPlan)}
      </div>

      <aside class="todo-side">
        <article class="todo-info-card">
          <p class="eyebrow">Current phase</p>
          <h2>${escapeHtml(phase.title)}</h2>
          <p>${escapeHtml(phase.goal)}</p>
        </article>

        <article class="todo-info-card">
          <p class="eyebrow">Weekly checks</p>
          <ul class="simple-list">
            ${phase.weeklyCheckFields.map((field) => `<li>${escapeHtml(field)}</li>`).join("")}
          </ul>
        </article>

        ${renderTodoSection("personal-reminders", "Personal Reminders", trainingPlan.personalReminders)}
      </aside>
    </section>
  `;
}

function renderImportedSections(plan: TrainingPlanTemplate): string {
  if (plan.importedSections.length === 0) return "";

  return `
    <section class="imported-plan">
      <div class="form-heading">
        <p class="eyebrow">Imported markdown</p>
        <h2>Imported checklist sections</h2>
        <span>Known exercises are matched to existing how-to guides.</span>
      </div>
      ${plan.importedSections
        .map((section) => renderTodoSection(`imported-${section.id}`, section.title, section.items))
        .join("")}
    </section>
  `;
}

function renderTodoSection(
  scope: string,
  title: string,
  items: TrainingTodoItem[],
  note?: string
): string {
  const collapsed = isTodoSectionCollapsed(scope);
  const completed = items.filter((todoItem) => isTodoComplete(makeProgressId(scope, todoItem.id))).length;

  return `
    <article class="todo-section ${collapsed ? "is-collapsed" : ""}">
      <button
        class="todo-section-header"
        type="button"
        data-toggle-section="${escapeAttribute(scope)}"
        aria-expanded="${collapsed ? "false" : "true"}"
      >
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${note ? `<p>${escapeHtml(note)}</p>` : ""}
        </div>
        <span class="section-toggle-summary">
          <strong>${completed}/${items.length}</strong>
          <span>${collapsed ? "Show" : "Hide"}</span>
        </span>
      </button>
      ${
        collapsed
          ? ""
          : `<div class="todo-items">
              ${items.map((todoItem) => renderTodoRow(scope, todoItem)).join("")}
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

  return `
    <div class="todo-row">
      <label class="todo-check">
        <input
          type="checkbox"
          data-progress-id="${escapeAttribute(progressId)}"
          data-item-id="${escapeAttribute(todoItem.id)}"
          ${checked ? "checked" : ""}
        />
        <span class="todo-label ${checked ? "is-complete" : ""}">${escapeHtml(todoItem.label)}</span>
      </label>
      ${
        guide
          ? `<button class="ghost-action how-to-button" type="button" data-guide-id="${guide.id}">How to do</button>`
          : ""
      }
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

  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Profile</p>
        <h1>Athlete settings</h1>
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

      <fieldset class="event-select">
        <legend>Events</legend>
        ${renderEventChoice("long-jump", profile.events.includes("long-jump"))}
        ${renderEventChoice("triple-jump", profile.events.includes("triple-jump"))}
      </fieldset>

      <p class="form-error" id="profile-error" role="alert"></p>
      <button class="primary-action" type="submit">Save profile</button>
    </form>
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

  qs<HTMLInputElement>("#plan-import").addEventListener("change", (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    void importMarkdownPlan(file);
  });
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

async function importMarkdownPlan(file: File): Promise<void> {
  if (!trainingPlan) return;
  const markdown = await file.text();
  const nextPlan = parseMarkdownChecklist(markdown, trainingPlan);

  if (authSession) {
    const cloudOk = await saveCloudFirst("imported training plan", () =>
      upsertCloudTrainingPlan(authSession!.user.id, nextPlan)
    );
    if (!cloudOk) {
      console.warn("Cloud sync for imported plan failed, saved locally.");
    }
  }

  trainingPlan = nextPlan;
  await saveTrainingPlan(trainingPlan);
  todoProgress = await listTodoProgress(trainingPlan.id);
  notice = `Markdown plan imported ${authSession ? "and synced" : "locally"}. Known exercises were linked to how-to guides.`;
  render();
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

  qsa<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.view as ViewId | undefined;
      if (!nextView) return;
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
      updatedAt: new Date().toISOString(),
    };

    if (authSession) {
      try {
        await upsertCloudProfile(authSession.user.id, nextProfile);
      } catch (errorValue) {
        console.warn("Could not sync profile to cloud:", errorValue);
      }
    }

    profile = nextProfile;
    await saveProfile(profile);
    activeView = "dashboard";
    notice = authSession ? "Profile updated and synced." : "Profile updated locally.";
    render();
  });
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
  phase: ReturnType<typeof getPhaseForWeek>
): string[] {
  const ids = [
    ...plan.dailyChecklist.map((todoItem) => makeProgressId("daily", todoItem.id)),
    ...day.sections.flatMap((section) =>
      section.items.map((todoItem) =>
        makeProgressId(`week-${selectedWeek}-${day.id}-${section.id}`, todoItem.id)
      )
    ),
    ...phase.items.map((todoItem) => makeProgressId(`phase-${selectedWeek}`, todoItem.id)),
    ...plan.personalReminders.map((todoItem) => makeProgressId("personal-reminders", todoItem.id)),
    ...plan.importedSections.flatMap((section) =>
      section.items.map((todoItem) => makeProgressId(`imported-${section.id}`, todoItem.id))
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
    return url.protocol === "http:" || url.protocol === "https:";
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
  error: string | null;
} {
  const usernameInput = form.querySelector<HTMLInputElement>('input[name="username"]');
  const dobInput = form.querySelector<HTMLInputElement>('input[name="dob"]');
  const username = (usernameInput?.value.trim() ?? "").toLowerCase();
  const dob = dobInput?.value.trim() ?? "";
  const events = selectedEventValues(form);

  if (!username) {
    return { username, dob, events, error: "Enter a username." };
  }

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return {
      username,
      dob,
      events,
      error: "Username must be 3-24 characters using lowercase letters, numbers, or underscore.",
    };
  }

  if (!dob) {
    return { username, dob, events, error: "Enter date of birth." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(new Date(`${dob}T00:00:00`).getTime())) {
    return { username, dob, events, error: "Date of birth must be a valid date." };
  }

  if (dob > new Date().toISOString().slice(0, 10)) {
    return { username, dob, events, error: "Date of birth cannot be in the future." };
  }

  if (events.length === 0) {
    return { username, dob, events, error: "Select at least one event." };
  }

  return { username, dob, events, error: null };
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
