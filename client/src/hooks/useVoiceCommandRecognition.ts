import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: Event & { error?: string }) => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export type VoiceRecognitionStatus =
  | "idle"
  | "listening"
  | "unsupported"
  | "denied"
  | "error";

/**
 * Browser Web Speech API — fast command STT for the voice control bar.
 * Chrome/Edge typically process speech via the browser vendor (not AssemblyAI).
 */
export function useVoiceCommandRecognition(options?: {
  lang?: string;
  onFinalTranscript?: (transcript: string) => void;
}) {
  const lang = options?.lang ?? "en-GB";
  const onFinalRef = useRef(options?.onFinalTranscript);
  onFinalRef.current = options?.onFinalTranscript;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const intentionalStopRef = useRef(false);

  const [status, setStatus] = useState<VoiceRecognitionStatus>(() =>
    isSpeechRecognitionSupported() ? "idle" : "unsupported",
  );
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stop = useCallback(() => {
    intentionalStopRef.current = true;
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    recognitionRef.current = null;
    setStatus((s) => (s === "listening" ? "idle" : s));
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      setErrorMessage("Voice commands need Chrome or Edge on this device.");
      return;
    }

    stop();
    intentionalStopRef.current = false;
    setInterimTranscript("");
    setFinalTranscript("");
    setErrorMessage(null);

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus("listening");
    };

    recognition.onerror = (event) => {
      const err = event.error ?? "error";
      if (err === "aborted" && intentionalStopRef.current) return;
      if (err === "no-speech") {
        setErrorMessage("Didn’t catch that — try again.");
        setStatus("idle");
        return;
      }
      if (err === "not-allowed" || err === "service-not-allowed") {
        setStatus("denied");
        setErrorMessage("Microphone permission blocked. Allow mic access for this site.");
        return;
      }
      setStatus("error");
      setErrorMessage(err === "network" ? "Speech service unavailable. Check your connection." : `Speech error: ${err}`);
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interim += text;
      }
      if (interim) setInterimTranscript(interim.trim());
      if (finalText.trim()) {
        const cleaned = finalText.trim();
        setFinalTranscript(cleaned);
        setInterimTranscript("");
        onFinalRef.current?.(cleaned);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus((s) => (s === "listening" ? "idle" : s));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setStatus("error");
      setErrorMessage("Could not start the microphone.");
    }
  }, [lang, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    status,
    interimTranscript,
    finalTranscript,
    errorMessage,
    supported: isSpeechRecognitionSupported(),
    start,
    stop,
    setErrorMessage,
  };
}
