import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import logoIconBlack from "@assets/LegalNote_Logo_-_Black_on_White_1766066417574.png";
import logoIconWhite from "@assets/LegalNote_Logo_-_White_on_Black_1766074833463.png";

export type LegalNoteMarkState = "idle" | "listening" | "processing";

interface AnimatedLegalNoteMarkProps {
  state?: LegalNoteMarkState;
  className?: string;
  /** Light mark for dark surfaces. */
  tone?: "light" | "dark";
}

/**
 * Official LegalNote icon with motion states for the voice-command trigger.
 * Listening = soft terracotta halo + breathe; waveform viz lives in the panel.
 */
export function AnimatedLegalNoteMark({
  state = "idle",
  className,
  tone = "dark",
}: AnimatedLegalNoteMarkProps) {
  const reduceMotion = usePrefersReducedMotion();
  const src = tone === "light" ? logoIconWhite : logoIconBlack;

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        (state === "idle" || state === "listening") && !reduceMotion && "ln-mark-breathe",
        className,
      )}
    >
      {state === "listening" && !reduceMotion && (
        <span
          className="pointer-events-none absolute inset-[-22%] z-0 rounded-full ln-mark-halo"
          aria-hidden
        />
      )}
      <img
        src={src}
        alt=""
        draggable={false}
        className="relative z-[1] h-full w-full object-contain select-none pointer-events-none"
      />
    </span>
  );
}

/** Standalone live waveform — used in the voice command panel. */
export function VoiceWaveform({
  state = "listening",
  className,
  bars = 24,
}: {
  state?: LegalNoteMarkState;
  className?: string;
  bars?: number;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const levels = useWaveLevels(bars, state, reduceMotion);

  return (
    <div
      className={cn("flex h-10 items-end justify-center gap-[3px]", className)}
      aria-hidden
    >
      {levels.map((level, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] rounded-full bg-[hsl(18,70%,42%)]",
            state === "listening" && !reduceMotion && "ln-wave-glow-bar",
          )}
          style={{ height: `${Math.max(12, level * 100)}%` }}
        />
      ))}
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useWaveLevels(count: number, state: LegalNoteMarkState, reduceMotion: boolean) {
  const [levels, setLevels] = useState(() => Array(count).fill(0.28));
  const frame = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion || state === "idle") {
      setLevels(Array(count).fill(0.28));
      return;
    }

    const speed = state === "listening" ? 0.16 : 0.07;
    const amp = state === "listening" ? 0.5 : 0.22;

    const tick = () => {
      frame.current += 1;
      const t = frame.current * speed;
      setLevels(
        Array.from({ length: count }, (_, i) => {
          const envelope = 0.55 + 0.45 * Math.sin((i / count) * Math.PI);
          return 0.18 + envelope * (0.35 + (0.5 + 0.5 * Math.sin(t + i * 0.55)) * amp);
        }),
      );
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [count, state, reduceMotion]);

  return levels;
}
