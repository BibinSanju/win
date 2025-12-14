import "@picocss/pico/css/pico.classless.min.css";

import { startCamera, stopCamera, recordVideo } from "./recorder";
import type { RecordingController, RecordingResult } from "./recorder";

import { saveAttempt, listAttempts } from "./db";
import type { TestType, Attempt } from "./db";

let currentStream: MediaStream | null = null;
let currentRecording: RecordingController | null = null;
let isCancelling = false;

let currentTestType: TestType | null = null;
let recordedVideo: RecordingResult | null = null;

let lastPreviewUrl: string | null = null;

const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;

// UI sections
const testSelectSection = $("#test-select");
const recordUI = $("#record-ui");
const attemptsContainer = $("#attempts-container");

// Controls
const preview = $<HTMLVideoElement>("#preview");
const startCameraBtn = $<HTMLButtonElement>("#start-camera");
const startRecordBtn = $<HTMLButtonElement>("#start-record");
const stopRecordBtn = $<HTMLButtonElement>("#stop-record");
const backBtn = $<HTMLButtonElement>("#back-to-tests");
const saveSection = $<HTMLElement>("#save-section");
const scoreInput = $<HTMLInputElement>("#score-input");
const saveAttemptBtn = $<HTMLButtonElement>("#save-attempt");
const currentTestTitle = $("#current-test-title");

// Test selection
document.querySelectorAll("[data-test]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const testType = (e.target as HTMLElement).dataset.test as TestType;
    openTestRecorder(testType);
  });
});

function setPreviewFromBlob(videoEl: HTMLVideoElement, blob: Blob) {
  if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
  lastPreviewUrl = URL.createObjectURL(blob);
  videoEl.srcObject = null;
  videoEl.src = lastPreviewUrl;
  videoEl.controls = true;
}

function openTestRecorder(testType: TestType) {
  currentTestType = testType;
  currentTestTitle.textContent = `Test: ${testType.toUpperCase()}`;

  testSelectSection.style.display = "none";
  recordUI.style.display = "block";

  // reset view state for new recording
  saveSection.style.display = "none";
  recordedVideo = null;

  // buttons initial states
  startCameraBtn.disabled = false;
  startRecordBtn.disabled = true;
  stopRecordBtn.disabled = true;
}

startCameraBtn.addEventListener("click", async () => {
  try {
    // If camera was somehow left open, close it first
    if (currentStream) stopCamera(currentStream);

    currentStream = await startCamera(preview);

    startCameraBtn.disabled = true;
    startRecordBtn.disabled = false;
  } catch (err) {
    alert("Camera access denied or unavailable.");
    console.error(err);
  }
});

startRecordBtn.addEventListener("click", () => {
  if (!currentStream) return;

  isCancelling = false;

  // Start recording immediately, and it will auto-stop at 90s.
  currentRecording = recordVideo(currentStream, 90_000);

  startRecordBtn.disabled = true;
  stopRecordBtn.disabled = false;

  // IMPORTANT: finalize UI when recording really stops (manual stop OR auto-stop).
  currentRecording.done
    .then((result: RecordingResult) => {
      // If user pressed Back while recording, ignore the result.
      if (isCancelling) return;

      recordedVideo = result;

      // Release camera hardware now that recording is done.
      if (currentStream) stopCamera(currentStream);
      currentStream = null;

      // Show preview + save UI
      setPreviewFromBlob(preview, recordedVideo.blob);
      saveSection.style.display = "block";

      stopRecordBtn.disabled = true;
    })
    .catch((err) => {
      console.error(err);
      alert("Recording failed.");

      // UI recovery
      stopRecordBtn.disabled = true;
      startRecordBtn.disabled = false;
      startCameraBtn.disabled = false;
    });
});

stopRecordBtn.addEventListener("click", () => {
  if (!currentRecording) return;

  // Stop button triggers stop; result is handled by currentRecording.done above.
  currentRecording.stop();
});

saveAttemptBtn.addEventListener("click", async () => {
  if (!recordedVideo || !currentTestType) return;

  const score = scoreInput.value.trim();
  if (!score) {
    alert("Please enter a score.");
    return;
  }

  const attempt: Attempt = {
    id: crypto.randomUUID(),
    testType: currentTestType,
    createdAt: new Date().toISOString(),
    verified: false,
    scoreText: score,
    video: recordedVideo.blob,
    mimeType: recordedVideo.mimeType,
    durationMs: recordedVideo.durationMs,
  };

  await saveAttempt(attempt);

  alert("Attempt saved!");
  resetRecorder();
  loadAttempts();
});

backBtn.addEventListener("click", () => {
  // If recording is active, stop it but do NOT show Save/Preview.
  // Using MediaRecorder.state is the correct way to check if it's recording. [web:572]
  if (currentRecording && currentRecording.recorder.state === "recording") {
    isCancelling = true;
    currentRecording.stop();
  }

  resetRecorder();
});

function resetRecorder() {
  // cleanup preview blob URL
  if (lastPreviewUrl) {
    URL.revokeObjectURL(lastPreviewUrl);
    lastPreviewUrl = null;
  }

  // stop camera if running
  if (currentStream) {
    stopCamera(currentStream);
    currentStream = null;
  }

  // reset UI
  preview.srcObject = null;
  preview.src = "";
  preview.controls = false;

  recordUI.style.display = "none";
  testSelectSection.style.display = "block";

  startCameraBtn.disabled = false;
  startRecordBtn.disabled = true;
  stopRecordBtn.disabled = true;

  saveSection.style.display = "none";
  scoreInput.value = "";

  // reset state
  currentTestType = null;
  recordedVideo = null;
  currentRecording = null;
  isCancelling = false;
}

async function loadAttempts() {
  const attempts = await listAttempts();

  // NOTE: this creates object URLs inside HTML string; OK for now.
  // Later we can improve by rendering with DOM nodes and revoking URLs on cleanup.
  attemptsContainer.innerHTML = attempts.length
    ? attempts
        .map(
          (a) => `
      <article>
        <header><strong>${a.testType.toUpperCase()}</strong> - ${a.scoreText} ${
            a.verified ? "✅" : "⚠️ Unverified"
          }</header>
        <p>${new Date(a.createdAt).toLocaleString()}</p>
        ${
          a.video
            ? `<video src="${URL.createObjectURL(
                a.video
              )}" controls style="width:100%; max-width:400px;"></video>`
            : ""
        }
      </article>
    `
        )
        .join("")
    : "<p>No attempts yet. Record your first test!</p>";
}

// Load attempts on startup
loadAttempts();
