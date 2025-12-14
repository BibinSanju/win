// recorder.ts
// Purpose:
// - Start the camera preview (getUserMedia)
// - Record video (MediaRecorder)
// - Provide a "done" Promise that resolves when recording actually stops
//   (works for Stop button + auto-stop timer).
//
// Why "done"? Because the recorder can stop from many reasons, and the most
// reliable moment to build the final Blob is when the recorder fires "stop". [web:532]

export interface RecordingResult {
  blob: Blob;        // Final recorded video file as a Blob
  mimeType: string;  // The MIME type that was actually recorded (browser-dependent)
  durationMs: number;
}

// Controller object returned by recordVideo().
// - stop(): triggers stopping (manual stop)
// - done: resolves to RecordingResult whenever recording stops (manual/auto).
export type RecordingController = {
  recorder: MediaRecorder;
  done: Promise<RecordingResult>;
  stop: () => void;
};

// Pick the best format supported by the current browser.
// This improves cross-browser behavior because support differs between browsers.
function pickBestMimeType(): string | undefined {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4", // sometimes supported in Safari; harmless to try last
  ];

  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined; // let browser pick default
}

// Starts camera preview and returns the stream.
export async function startCamera(
  videoElement: HTMLVideoElement,
  constraints: MediaStreamConstraints = {
    video: { facingMode: "user" },
    audio: false,
  }
): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoElement.srcObject = stream;
  await videoElement.play();
  return stream;
}

// IMPORTANT: Stops the camera hardware (turns off camera light, releases device).
// The correct way is to stop each MediaStreamTrack. [web:504]
export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

// Records video and auto-stops after maxDurationMs (default 1:30).
export function recordVideo(stream: MediaStream, maxDurationMs = 90_000): RecordingController {
  const chosen = pickBestMimeType();

  // Create MediaRecorder. If chosen is undefined, browser picks default recording format.
  const recorder = chosen
    ? new MediaRecorder(stream, { mimeType: chosen })
    : new MediaRecorder(stream);

  const chunks: BlobPart[] = [];
  const startedAt = performance.now();

  // Collect chunks of data as they arrive.
  recorder.addEventListener("dataavailable", (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  });

  // The key improvement:
  // "done" resolves ONLY when the recorder fires "stop".
  // This works even when stop happens due to the auto timer. [web:532]
  const done = new Promise<RecordingResult>((resolve, reject) => {
    recorder.addEventListener("stop", () => {
      const endedAt = performance.now();

      // recorder.mimeType is what browser ended up using.
      const actualMimeType = recorder.mimeType || chosen || "video/webm";

      resolve({
        blob: new Blob(chunks, { type: actualMimeType }),
        mimeType: actualMimeType,
        durationMs: Math.max(0, Math.round(endedAt - startedAt)),
      });
    });

    recorder.addEventListener("error", () => {
      reject(new Error("MediaRecorder error"));
    });
  });

  // Start recording now.
  recorder.start();

  // Auto-stop after 1:30 (or your chosen duration)
  window.setTimeout(() => {
    if (recorder.state === "recording") recorder.stop();
  }, maxDurationMs);

  // Return controller used by UI
  return {
    recorder,
    done,
    stop: () => {
      if (recorder.state === "recording") recorder.stop();
    },
  };
}
