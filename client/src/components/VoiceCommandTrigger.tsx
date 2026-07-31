import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Loader2, X } from "lucide-react";
import {
  AnimatedLegalNoteMark,
  VoiceWaveform,
  type LegalNoteMarkState,
} from "@/components/AnimatedLegalNoteMark";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useVoiceCommandRecognition } from "@/hooks/useVoiceCommandRecognition";
import { QUICK_RECORD_SHORTCUT_EVENT } from "@/hooks/useQuickRecordShortcut";
import { buildCapturePath } from "@/lib/capture";
import { cn } from "@/lib/utils";
import {
  ADVICE_SOFT_BLOCK_MESSAGE,
  caseViewPath,
  parseVoiceCommand,
  rankMattersForVoiceOpen,
  type CaseView,
  type VoiceIntent,
  type VoiceMatterCandidate,
} from "@/lib/voiceCommandIntents";
import { answerVoiceAsk, type VoiceAskAnswer } from "@/lib/voiceAskAnswers";
import type { Case } from "@shared/schema";

const SHORTCUT_HINT = "Ctrl+Shift+Space";

type MatterHit = VoiceMatterCandidate;

type PanelPhase =
  | "idle"
  | "listening"
  | "working"
  | "choose_matter"
  | "answer"
  | "done"
  | "error";

/**
 * Bottom-left voice command trigger — LegalNote mark, not the red record mic.
 * Captures mic audio and transcribes via AssemblyAI EU (/api/transcribe).
 */
export function VoiceCommandTrigger() {
  const [, setLocation] = useLocation();
  const [matchCase, caseParams] = useRoute("/case/:id");
  const activeCaseId = matchCase ? caseParams?.id ?? null : null;
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [panelPhase, setPanelPhase] = useState<PanelPhase>("idle");
  const [statusLine, setStatusLine] = useState("Ask what’s outstanding, or open a matter");
  const [heardText, setHeardText] = useState("");
  const [matterChoices, setMatterChoices] = useState<MatterHit[]>([]);
  const [pendingView, setPendingView] = useState<CaseView | null>(null);
  const [askAnswer, setAskAnswer] = useState<VoiceAskAnswer | null>(null);

  const activeCaseIdRef = useRef(activeCaseId);
  const pendingViewRef = useRef(pendingView);
  activeCaseIdRef.current = activeCaseId;
  pendingViewRef.current = pendingView;

  const closeRef = useRef<() => void>(() => {});

  const executeIntent = useCallback(
    async (intent: VoiceIntent) => {
      try {
        if (intent.type === "advice_blocked") {
          setAskAnswer({
            headline: ADVICE_SOFT_BLOCK_MESSAGE,
            detail: "Try: “What needs attention?”, “What’s outstanding on this matter?”, or “Open [client]”.",
            actions: [
              { label: "What needs attention?", path: undefined },
              { label: "Go to dashboard", path: "/" },
            ],
          });
          setPanelPhase("answer");
          setStatusLine("I can pull file status — not legal advice");
          return;
        }

        if (intent.type === "ask") {
          setStatusLine("Checking your matters…");
          const answer = await answerVoiceAsk(intent.topic, activeCaseIdRef.current);
          setAskAnswer(answer);
          setPanelPhase("answer");
          setStatusLine("From your LegalNote file");
          return;
        }

        if (intent.type === "navigate") {
          setLocation(intent.path);
          setPanelPhase("done");
          setStatusLine(`Opened ${intent.label}`);
          toast({ title: intent.label, description: "Opened via voice command" });
          window.setTimeout(() => closeRef.current(), 900);
          return;
        }

        if (intent.type === "start_recording") {
          window.dispatchEvent(new CustomEvent(QUICK_RECORD_SHORTCUT_EVENT));
          setPanelPhase("done");
          setStatusLine("Starting Quick Record…");
          toast({ title: "Quick Record", description: "Started via voice command" });
          window.setTimeout(() => closeRef.current(), 700);
          return;
        }

        if (intent.type === "start_livebot") {
          setLocation(buildCapturePath({ mode: "join" }));
          setPanelPhase("done");
          setStatusLine("Opening Join Meeting…");
          window.setTimeout(() => closeRef.current(), 900);
          return;
        }

        if (intent.type === "case_view") {
          const caseId = activeCaseIdRef.current;
          if (!caseId) {
            setPanelPhase("error");
            setStatusLine(`Open a matter first, then say “${intent.label.toLowerCase()}”.`);
            return;
          }
          setLocation(caseViewPath(caseId, intent.view));
          setPanelPhase("done");
          setStatusLine(`Showing ${intent.label}`);
          window.setTimeout(() => closeRef.current(), 900);
          return;
        }

        if (intent.type === "open_matter") {
          setStatusLine(`Searching for “${intent.query}”…`);
          const { ranked, autoOpen } = await searchMatters(intent.query);
          if (ranked.length === 0) {
            setPanelPhase("error");
            setStatusLine(`No matter found for “${intent.query}”.`);
            return;
          }

          const chosen = autoOpen ?? (ranked.length === 1 ? ranked[0] : null);
          if (chosen) {
            const view = pendingViewRef.current;
            const path = view ? caseViewPath(chosen.id, view) : `/case/${chosen.id}`;
            setLocation(path);
            setPanelPhase("done");
            setStatusLine(`Opened ${chosen.title || chosen.clientName || "matter"}`);
            toast({
              title: chosen.title || "Matter opened",
              description: chosen.clientName || undefined,
            });
            window.setTimeout(() => closeRef.current(), 900);
            return;
          }

          setMatterChoices(ranked);
          setPanelPhase("choose_matter");
          setStatusLine(`Found ${ranked.length} close matches — tap one to open`);
          return;
        }

        setPanelPhase("error");
        setStatusLine(
          intent.raw
            ? `Didn’t understand “${intent.raw}”. Try “What needs attention?” or “Open Adam Reeve”.`
            : "Didn’t catch a command. Try again.",
        );
      } catch (err) {
        console.error("Voice command failed", err);
        setPanelPhase("error");
        setStatusLine("Something went wrong running that command.");
      }
    },
    [setLocation, toast],
  );

  const handleFinalTranscript = useCallback(
    (transcript: string) => {
      setHeardText(transcript);
      setPanelPhase("working");
      setStatusLine("Searching…");
      void executeIntent(parseVoiceCommand(transcript));
    },
    [executeIntent],
  );

  const recognition = useVoiceCommandRecognition({
    onFinalTranscript: handleFinalTranscript,
  });

  const close = useCallback(() => {
    recognition.cancel();
    setOpen(false);
    setPanelPhase("idle");
    setHeardText("");
    setMatterChoices([]);
    setPendingView(null);
    setAskAnswer(null);
    setStatusLine("Ask what’s outstanding, or open a matter");
  }, [recognition]);

  closeRef.current = close;

  const openListening = useCallback(() => {
    setOpen(true);
    setPanelPhase("listening");
    setHeardText("");
    setMatterChoices([]);
    setPendingView(null);
    setAskAnswer(null);
    setStatusLine("Speak now — tap Done when finished");
    void recognition.start();
  }, [recognition]);

  const toggle = useCallback(() => {
    if (!open) {
      openListening();
      return;
    }
    // Second tap while listening = finish & run command
    if (recognition.status === "listening") {
      setStatusLine("Searching…");
      recognition.finish();
      return;
    }
    close();
  }, [open, close, openListening, recognition]);

  useEffect(() => {
    if (recognition.status === "transcribing") {
      setPanelPhase("working");
      setStatusLine("Searching…");
    }
  }, [recognition.status]);

  useEffect(() => {
    if (
      recognition.status === "denied" ||
      recognition.status === "unsupported" ||
      recognition.status === "error"
    ) {
      if (recognition.errorMessage) {
        setPanelPhase("error");
        setStatusLine(recognition.errorMessage);
      }
    }
  }, [recognition.status, recognition.errorMessage]);

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

  const markState: LegalNoteMarkState = useMemo(() => {
    if (panelPhase === "listening" || recognition.status === "listening") return "listening";
    if (panelPhase === "working" || recognition.status === "transcribing") return "processing";
    return open ? "listening" : "idle";
  }, [open, panelPhase, recognition.status]);

  const title =
    recognition.status === "transcribing" || panelPhase === "working"
      ? "Searching…"
      : panelPhase === "listening"
        ? "Listening…"
        : panelPhase === "choose_matter"
          ? "Choose a matter"
          : panelPhase === "answer"
            ? "Answer"
            : panelPhase === "done"
              ? "Done"
              : panelPhase === "error"
                ? "Try again"
                : "Voice command";

  const pickMatter = (hit: MatterHit) => {
    const view = pendingViewRef.current;
    const path = view ? caseViewPath(hit.id, view) : `/case/${hit.id}`;
    setLocation(path);
    setPanelPhase("done");
    setStatusLine(`Opened ${hit.title || hit.clientName || "matter"}`);
    toast({ title: hit.title || "Matter opened", description: hit.clientName || undefined });
    window.setTimeout(() => close(), 700);
  };

  const runAskAction = (label: string, path?: string) => {
    if (path) {
      setLocation(path);
      setPanelPhase("done");
      setStatusLine("Opening…");
      window.setTimeout(() => close(), 700);
      return;
    }
    // Soft-block CTA with no path: run the suggested ask
    if (/needs attention/i.test(label)) {
      setPanelPhase("working");
      setStatusLine("Checking your matters…");
      void executeIntent({ type: "ask", topic: "needs_attention" });
    }
  };

  const retry = () => {
    setMatterChoices([]);
    setPendingView(null);
    setAskAnswer(null);
    setHeardText("");
    setPanelPhase("listening");
    setStatusLine("Speak now — tap Done when finished");
    void recognition.start();
  };

  const finishListening = () => {
    setPanelPhase("working");
    setStatusLine("Searching…");
    recognition.finish();
  };

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
                  <p className="text-sm font-medium tracking-tight">{title}</p>
                  <p className="text-xs text-muted-foreground">{statusLine}</p>
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
              {(panelPhase === "listening" ||
                panelPhase === "working" ||
                recognition.status === "transcribing") && (
                <VoiceWaveform
                  state={
                    panelPhase === "working" || recognition.status === "transcribing"
                      ? "processing"
                      : "listening"
                  }
                  className="mb-3"
                />
              )}

              {(panelPhase === "working" || recognition.status === "transcribing") && (
                <div className="mb-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching…
                </div>
              )}

              {heardText ? (
                <p className="text-center text-sm text-foreground" data-testid="voice-command-transcript">
                  “{heardText}”
                </p>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Try{" "}
                  <span className="text-foreground">“What needs attention?”</span> or{" "}
                  <span className="text-foreground">“Open Adam Reeve”</span>
                </p>
              )}

              {recognition.status === "listening" && (
                <div className="mt-3 flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    onClick={finishListening}
                    data-testid="button-voice-command-done"
                  >
                    Done speaking
                  </Button>
                </div>
              )}

              {panelPhase === "answer" && askAnswer && (
                <div className="mt-3 space-y-2 text-left" data-testid="voice-ask-answer">
                  <p className="text-sm font-medium text-foreground">{askAnswer.headline}</p>
                  {askAnswer.detail && (
                    <p className="text-xs text-muted-foreground">{askAnswer.detail}</p>
                  )}
                  {askAnswer.bullets && askAnswer.bullets.length > 0 && (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {askAnswer.bullets.map((b) => (
                        <li key={b} className="truncate">
                          · {b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {askAnswer.actions && askAnswer.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {askAnswer.actions.map((a) => (
                        <Button
                          key={a.label}
                          type="button"
                          size="sm"
                          variant={a.path ? "default" : "outline"}
                          onClick={() => runAskAction(a.label, a.path)}
                        >
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {panelPhase === "choose_matter" && matterChoices.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {matterChoices.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          pickMatter(hit);
                        }}
                        className={cn(
                          "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-left text-sm",
                          "hover:border-[hsl(18,70%,42%)]/60 hover:bg-[hsl(18,70%,42%)]/10",
                          "active:bg-[hsl(18,70%,42%)]/15 transition-colors cursor-pointer",
                        )}
                        data-testid={`voice-matter-choice-${hit.id}`}
                      >
                        <span className="font-medium block truncate">{hit.title}</span>
                        {(hit.clientName || hit.matterReference) && (
                          <span className="text-xs text-muted-foreground truncate block">
                            {[hit.clientName, hit.matterReference].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(panelPhase === "error" || panelPhase === "done" || panelPhase === "answer") && (
              <div className="mt-3 flex justify-end">
                <Button type="button" size="sm" variant="outline" onClick={retry}>
                  Listen again
                </Button>
              </div>
            )}

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              File status only — not legal advice. Speak, then tap Done (or wait ~7s).
            </p>
          </div>
        </div>
      )}
    </>
  );
}

async function searchMatters(query: string) {
  // Use the case list (client/title/ref) — not enhanced search, which also
  // matches transcript body and returns unrelated matters.
  const response = await fetch("/api/cases", { credentials: "include" });
  if (!response.ok) throw new Error("Search failed");
  const cases = (await response.json()) as Case[];
  const candidates: VoiceMatterCandidate[] = cases.map((c) => ({
    id: c.id,
    title: c.title,
    clientName: c.clientName ?? null,
    matterReference: c.matterReference ?? null,
  }));
  return rankMattersForVoiceOpen(candidates, query);
}
