import type { VoiceAskAnswer } from "@/lib/voiceAskAnswers";

const MUTE_KEY = "legalnote.voice.ttsMuted";
const MAX_SPOKEN_CHARS = 420;

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let browserUtterance: SpeechSynthesisUtterance | null = null;

export function isVoiceTtsMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVoiceTtsMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // ignore
  }
  if (muted) stopVoiceSpeak();
}

export function stopVoiceSpeak(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  browserUtterance = null;
}

/** Build a short spoken summary — never the full panel dump. */
export function buildSpokenSummary(answer: VoiceAskAnswer): string {
  const parts: string[] = [];
  if (answer.headline?.trim()) parts.push(answer.headline.trim());

  if (answer.sections && answer.sections.length > 0) {
    for (const section of answer.sections.slice(0, 2)) {
      const n = section.bullets.length;
      if (n === 0) continue;
      const preview = section.bullets[0]?.trim();
      parts.push(
        preview
          ? `${section.title}: ${n} item${n === 1 ? "" : "s"}. ${preview}`
          : `${section.title}: ${n} item${n === 1 ? "" : "s"}.`,
      );
    }
  } else if (answer.bullets && answer.bullets.length > 0) {
    const shown = answer.bullets.slice(0, 2).map((b) => b.trim()).filter(Boolean);
    if (shown.length) parts.push(shown.join(". "));
    if (answer.bullets.length > 2) {
      parts.push(`${answer.bullets.length - 2} more on screen.`);
    }
  }

  return parts
    .join(". ")
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim()
    .slice(0, MAX_SPOKEN_CHARS);
}

function speakViaBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const gb =
      voices.find((v) => /en-GB/i.test(v.lang) && /female|amy|emma|serena|libby/i.test(v.name)) ||
      voices.find((v) => /en-GB/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang));
    if (gb) u.voice = gb;
    browserUtterance = u;
    u.onend = () => {
      browserUtterance = null;
      resolve();
    };
    u.onerror = () => {
      browserUtterance = null;
      resolve();
    };
    window.speechSynthesis.speak(u);
  });
}

async function speakViaPolly(text: string): Promise<boolean> {
  const res = await fetch("/api/voice/tts", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return false;

  const blob = await res.blob();
  if (!blob.size) return false;

  stopVoiceSpeak();
  const url = URL.createObjectURL(blob);
  currentObjectUrl = url;
  const audio = new Audio(url);
  currentAudio = audio;

  await new Promise<void>((resolve) => {
    audio.onended = () => {
      if (currentObjectUrl === url) {
        URL.revokeObjectURL(url);
        currentObjectUrl = null;
      }
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      if (currentObjectUrl === url) {
        URL.revokeObjectURL(url);
        currentObjectUrl = null;
      }
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    void audio.play().catch(() => resolve());
  });
  return true;
}

/**
 * Speak a short reply. Prefers Amazon Polly EU; falls back to browser en-GB.
 * No-ops when muted.
 */
export async function speakVoiceReply(text: string): Promise<void> {
  if (isVoiceTtsMuted()) return;
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, MAX_SPOKEN_CHARS);
  if (cleaned.length < 1) return;

  stopVoiceSpeak();

  try {
    const ok = await speakViaPolly(cleaned);
    if (ok) return;
  } catch {
    // fall through
  }

  await speakViaBrowser(cleaned);
}
