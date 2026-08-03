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

/** Hard cap — safety net if silence detection never fires. */
const MAX_COMMAND_MS = 10000;
/** Ignore silence until we've heard speech for at least this long. */
const MIN_SPEECH_MS = 350;
/** Stop after this much quiet once speech was detected. */
const SILENCE_AFTER_SPEECH_MS = 1100;
/** Don't auto-stop in the first moments (mic warmup / breath). */
const MIN_LISTEN_BEFORE_SILENCE_MS = 600;
/** RMS threshold — below this counts as silence (0–1 scale from Analyser). */
const SILENCE_RMS = 0.018;

/**
 * Voice-command capture via MediaRecorder + LegalNote `/api/transcribe` (AssemblyAI EU).
 * Auto-stops shortly after you finish speaking (silence detection).
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
  const finishRef = useRef<() => void>(() => {});

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceRafRef = useRef<number | null>(null);
  const listenStartedAtRef = useRef(0);
  const speechStartedAtRef = useRef<number | null>(null);
  const lastLoudAtRef = useRef(0);
  const heardSpeechRef = useRef(false);

  const [status, setStatus] = useState<VoiceRecognitionStatus>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopSilenceMonitor = useCallback(() => {
    if (silenceRafRef.current != null) {
      cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (maxTimerRef.current != null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    stopSilenceMonitor();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, [stopSilenceMonitor]);

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
    stopSilenceMonitor();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        cleanupStream();
        setStatus("idle");
      }
    }
  }, [cleanupStream, stopSilenceMonitor]);

  finishRef.current = finish;

  const cancel = useCallback(() => {
    discardRef.current = true;
    stopSilenceMonitor();
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
  }, [cleanupStream, stopSilenceMonitor]);

  const startSilenceMonitor = useCallback((stream: MediaStream) => {
    stopSilenceMonitor();
    listenStartedAtRef.current = performance.now();
    speechStartedAtRef.current = null;
    lastLoudAtRef.current = 0;
    heardSpeechRef.current = false;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Float32Array(analyser.fftSize);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buffer);

        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = buffer[i];
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const now = performance.now();
        const listeningFor = now - listenStartedAtRef.current;

        if (rms >= SILENCE_RMS) {
          lastLoudAtRef.current = now;
          if (!heardSpeechRef.current) {
            heardSpeechRef.current = true;
            speechStartedAtRef.current = now;
          }
        }

        const speechLongEnough =
          heardSpeechRef.current &&
          speechStartedAtRef.current != null &&
          now - speechStartedAtRef.current >= MIN_SPEECH_MS;

        const quietLongEnough =
          heardSpeechRef.current &&
          lastLoudAtRef.current > 0 &&
          now - lastLoudAtRef.current >= SILENCE_AFTER_SPEECH_MS;

        if (
          listeningFor >= MIN_LISTEN_BEFORE_SILENCE_MS &&
          speechLongEnough &&
          quietLongEnough &&
          mediaRecorderRef.current?.state === "recording"
        ) {
          finishRef.current();
          return;
        }

        silenceRafRef.current = requestAnimationFrame(tick);
      };

      // Resume context if browser starts it suspended
      void ctx.resume().catch(() => undefined);
      silenceRafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.warn("Voice silence monitor unavailable; using max duration only", err);
    }
  }, [stopSilenceMonitor]);

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
      startSilenceMonitor(stream);

      maxTimerRef.current = window.setTimeout(() => {
        finishRef.current();
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
  }, [cleanupStream, startSilenceMonitor, transcribeBlob]);

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
