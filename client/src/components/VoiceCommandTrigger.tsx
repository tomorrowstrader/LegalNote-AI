import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { AnimatedLegalNoteMark, VoiceWaveform, type LegalNoteMarkState } from "@/components/AnimatedLegalNoteMark";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SHORTCUT_HINT = "Ctrl+Shift+Space";

/**
 * Bottom-left voice command trigger — LegalNote mark, not the red record mic.
 * Hold or click to open the command bar. STT / intent wiring comes next.
 */
export function VoiceCommandTrigger() {
  const [open, setOpen] = useState(false);
  const [markState, setMarkState] = useState<LegalNoteMarkState>("idle");

  const close = useCallback(() => {
    setOpen(false);
    setMarkState("idle");
  }, []);

  const openListening = useCallback(() => {
    setOpen(true);
    setMarkState("listening");
  }, []);

  const toggle = useCallback(() => {
    if (open) close();
    else openListening();
  }, [open, close, openListening]);

  // Global shortcut — distinct from Ctrl+L (Quick Record)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (!event.ctrlKey || !event.shiftKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      toggle();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [toggle]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, close]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggle}
            data-testid="button-voice-command"
            aria-label="Voice command"
            aria-pressed={open}
            className={cn(
              "fixed bottom-6 left-6 z-[55] flex h-14 w-14 items-center justify-center rounded-full",
              "border-2 border-[hsl(220,15%,78%)] bg-white text-foreground",
              "shadow-[0_4px_6px_-1px_rgba(15,23,42,0.18),0_10px_24px_-4px_rgba(15,23,42,0.28),0_0_0_1px_rgba(15,23,42,0.06)]",
              "transition-[transform,box-shadow,background-color,border-color] duration-200",
              "hover:scale-[1.04] hover:shadow-[0_8px_16px_-2px_rgba(15,23,42,0.22),0_16px_32px_-6px_rgba(15,23,42,0.35)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "dark:border-white/35 dark:bg-[hsl(222,40%,16%)]",
              "dark:shadow-[0_4px_8px_-1px_rgba(0,0,0,0.55),0_14px_32px_-4px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.08)]",
              "dark:hover:shadow-[0_8px_18px_-2px_rgba(0,0,0,0.6),0_20px_40px_-6px_rgba(0,0,0,0.75)]",
              open && "ring-2 ring-[hsl(18,70%,42%)]/70 scale-[1.04] border-[hsl(18,70%,42%)]/60 dark:border-[hsl(18,70%,50%)]/70",
            )}
          >
            <AnimatedLegalNoteMark
              state={markState}
              tone="dark"
              className="h-8 w-8 dark:hidden"
            />
            <AnimatedLegalNoteMark
              state={markState}
              tone="light"
              className="hidden h-8 w-8 dark:flex"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-sans">
          Voice command
          <span className="ml-2 font-mono text-[10px] text-muted-foreground">{SHORTCUT_HINT}</span>
        </TooltipContent>
      </Tooltip>

      {open && (
        <div
          className="fixed bottom-24 left-6 z-[55] w-[min(100vw-3rem,22rem)]"
          role="dialog"
          aria-label="Voice command"
          data-testid="voice-command-panel"
        >
          <div
            className={cn(
              "rounded-2xl border-2 border-[hsl(220,15%,78%)] bg-white p-4 backdrop-blur-md",
              "shadow-[0_8px_16px_-4px_rgba(15,23,42,0.2),0_20px_40px_-8px_rgba(15,23,42,0.32),0_0_0_1px_rgba(15,23,42,0.06)]",
              "dark:border-white/30 dark:bg-[hsl(222,40%,15%)]",
              "dark:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.55),0_24px_48px_-8px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.1)]",
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <AnimatedLegalNoteMark state={markState} tone="dark" className="h-9 w-9 dark:hidden" />
                <AnimatedLegalNoteMark state={markState} tone="light" className="hidden h-9 w-9 dark:flex" />
                <div>
                  <p className="text-sm font-medium tracking-tight">Listening…</p>
                  <p className="text-xs text-muted-foreground">
                    Navigate, open a matter, or start recording
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={close}
                aria-label="Close voice command"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div
              className={cn(
                "rounded-xl border border-[hsl(220,12%,82%)] bg-[hsl(220,14%,96%)] px-3 py-4",
                "dark:border-white/20 dark:bg-[hsl(222,35%,11%)]",
              )}
            >
              <VoiceWaveform state={markState} className="mb-3" />
              <p className="text-center text-sm text-muted-foreground">
                Say something like{" "}
                <span className="text-foreground">“Open Patterson”</span> or{" "}
                <span className="text-foreground">“Show transcript”</span>
              </p>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Preview — speech recognition wires up next. Does not start a meeting recording
              (use the red mic or Ctrl+L for that).
            </p>
          </div>
        </div>
      )}
    </>
  );
}
