import { useCallback, useEffect, useRef, useState } from "react";

function getSupportedMimeType(): { mimeType: string; extension: string } {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return { mimeType: "audio/webm", extension: ".webm" };
  }
  const types = [
    { mimeType: "audio/webm", extension: ".webm" },
    { mimeType: "audio/mp4", extension: ".mp4" },
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type.mimeType)) return type;
  }
  return { mimeType: "audio/webm", extension: ".webm" };
}

export type VoiceRecognitionStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "denied"
  | "unsupported"
  | "error";

const MAX_COMMAND_MS = 7000;

/**
 * Voice-command capture via MediaRecorder + LegalNote `/api/transcribe` (AssemblyAI EU).
 * Avoids Chrome Web Speech (Google cloud), which often fails with "network" errors.
 */
export function useVoiceCommandRecognition(options?: {
  onFinalTranscript?: (transcript: string) => void;
}) {
  const onFinalRef = useRef(options?.onFinalTranscript);
  onFinalRef.current = options?.onFinalTranscript;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const formatRef = useRef(getSupportedMimeType());
  /** When true, onstop discards audio instead of transcribing. */
  const discardRef = useRef(false);

  const [status, setStatus] = useState<VoiceRecognitionStatus>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanupStream = useCallback(() => {
    if (maxTimerRef.current != null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const transcribeBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 200) {
      setStatus("error");
      setErrorMessage("Didn’t catch that — try again and speak a bit longer.");
      return;
    }

    setStatus("transcribing");
    setInterimTranscript("");
    setErrorMessage(null);

    try {
      const formData = new FormData();
      const { extension } = formatRef.current;
      formData.append("audio", blob, `voice-command${extension}`);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Transcription failed");
      }

      const data = (await res.json()) as { text?: string };
      const text = (data.text || "").trim();
      if (!text) {
        setStatus("error");
        setErrorMessage("Didn’t catch that — try again.");
        return;
      }

      setFinalTranscript(text);
      setStatus("idle");
      onFinalRef.current?.(text);
    } catch (err) {
      console.error("Voice command transcription failed", err);
      setStatus("error");
      setErrorMessage("Couldn’t transcribe that. Check your connection and try again.");
    }
  }, []);

  const finish = useCallback(() => {
    discardRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        cleanupStream();
        setStatus("idle");
      }
    }
  }, [cleanupStream]);

  const cancel = useCallback(() => {
    discardRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        cleanupStream();
      }
    } else {
      cleanupStream();
    }
    setStatus("idle");
    setInterimTranscript("");
  }, [cleanupStream]);

  const start = useCallback(async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setErrorMessage("This browser can’t capture microphone audio for voice commands.");
      return;
    }

    // Cancel any in-flight capture
    discardRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    cleanupStream();

    discardRef.current = false;
    setInterimTranscript("");
    setFinalTranscript("");
    setErrorMessage(null);
    chunksRef.current = [];
    formatRef.current = getSupportedMimeType();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const { mimeType } = formatRef.current;
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setStatus("error");
        setErrorMessage("Microphone capture failed.");
        cleanupStream();
      };

      recorder.onstop = () => {
        const shouldDiscard = discardRef.current;
        const blob = new Blob(chunksRef.current, { type: formatRef.current.mimeType });
        cleanupStream();
        if (shouldDiscard) {
          setStatus("idle");
          return;
        }
        void transcribeBlob(blob);
      };

      recorder.start();
      setStatus("listening");

      maxTimerRef.current = window.setTimeout(() => {
        finish();
      }, MAX_COMMAND_MS);
    } catch (err: any) {
      cleanupStream();
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("denied");
        setErrorMessage("Microphone permission blocked. Allow mic access for this site.");
        return;
      }
      setStatus("error");
      setErrorMessage(err?.message || "Failed to access microphone.");
    }
  }, [cleanupStream, finish, transcribeBlob]);

  useEffect(() => () => cancel(), [cancel]);

  return {
    status,
    interimTranscript,
    finalTranscript,
    errorMessage,
    supported: typeof MediaRecorder !== "undefined",
    start,
    /** Stop capture and send audio for transcription. */
    finish,
    /** Abort without transcribing. */
    cancel,
    setErrorMessage,
  };
}
