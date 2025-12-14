export type RecordingResult = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
};

export async function startCamera(constraints: MediaStreamConstraints = { video: true, audio: false }) {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  return stream;
}

export async function recordVideo(stream: MediaStream) {
  const mimeType =
    MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" :
    MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ? "video/webm;codecs=vp8" :
    "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  const startedAt = performance.now();

  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const stop = () =>
    new Promise<RecordingResult>((resolve) => {
      recorder.onstop = () => {
        const endedAt = performance.now();
        resolve({
          blob: new Blob(chunks, { type: mimeType }),
          mimeType,
          durationMs: Math.max(0, Math.round(endedAt - startedAt)),
        });
      };
      recorder.stop();
    });

  recorder.start();
  return { recorder, stop };
}
