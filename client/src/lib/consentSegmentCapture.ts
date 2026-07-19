/**
 * Snapshot the audio recorded so far as a consent evidence blob.
 * Uses MediaRecorder.requestData() so the flush is included before the snapshot.
 */
export async function snapshotConsentSegment(params: {
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
  mimeType?: string;
}): Promise<Blob | null> {
  const { mediaRecorder, audioChunks } = params;
  if (!mediaRecorder || mediaRecorder.state !== "recording") {
    if (audioChunks.length === 0) return null;
    return new Blob(audioChunks, { type: params.mimeType || "audio/webm" });
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const previousHandler = mediaRecorder.ondataavailable;
    mediaRecorder.ondataavailable = (event) => {
      if (typeof previousHandler === "function") {
        previousHandler.call(mediaRecorder, event);
      } else if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
      finish();
    };
    try {
      mediaRecorder.requestData();
    } catch {
      finish();
      return;
    }
    window.setTimeout(finish, 250);
  });

  if (audioChunks.length === 0) return null;
  return new Blob(audioChunks, { type: params.mimeType || mediaRecorder.mimeType || "audio/webm" });
}

export function appendConsentSegmentToFormData(
  formData: FormData,
  consentBlob: Blob | null | undefined,
  consentDurationSeconds: number | null | undefined,
): void {
  if (!consentBlob || consentBlob.size === 0) return;
  const extension = consentBlob.type.includes("mp4")
    ? "mp4"
    : consentBlob.type.includes("ogg")
      ? "ogg"
      : consentBlob.type.includes("mpeg") || consentBlob.type.includes("mp3")
        ? "mp3"
        : "webm";
  formData.append("consentSegment", consentBlob, `consent-segment.${extension}`);
  if (consentDurationSeconds != null && Number.isFinite(consentDurationSeconds)) {
    formData.append("consentDurationSeconds", String(Math.max(1, Math.round(consentDurationSeconds))));
  }
}
