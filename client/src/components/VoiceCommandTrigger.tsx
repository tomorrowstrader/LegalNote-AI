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
              "border border-border/80 bg-card text-foreground shadow-lg",
              "transition-[transform,box-shadow,background-color] duration-200",
              "hover:scale-[1.04] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "dark:border-white/10 dark:bg-[hsl(222,47%,12%)]",
              open && "ring-2 ring-[hsl(18,70%,42%)]/50 scale-[1.04]",
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
              "rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md",
              "dark:border-white/10 dark:bg-[hsl(222,47%,11%)]/95",
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
                "rounded-xl border border-border/80 bg-muted/30 px-3 py-4",
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
