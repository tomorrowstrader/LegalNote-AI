import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Video, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MeetingToMatterProcessingOverlay, {
  type ProcessingStep,
} from "@/components/MeetingToMatterProcessingOverlay";
import { useLiveBotSession, type LiveBotPhase } from "@/contexts/LiveBotSessionContext";
import { createProcessingStepTimer } from "@/lib/processingStepTimer";
import { useToast } from "@/hooks/use-toast";

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function phaseLabel(phase: LiveBotPhase): string {
  switch (phase) {
    case "waiting":
      return "Waiting to join";
    case "joining":
      return "Joining call";
    case "recording":
      return "In meeting";
    case "ended":
      return "Call ended";
    case "processing":
      return "Producing notes";
    case "complete":
      return "Documents ready";
    case "awaiting_assignment":
      return "Assign recording";
    case "error":
      return "Something went wrong";
    default:
      return "Live meeting";
  }
}

function phaseToProcessingStep(phase: LiveBotPhase): ProcessingStep {
  if (phase === "complete") return "complete";
  if (phase === "processing") return "processing";
  if (phase === "ended") return "uploading";
  return "saving";
}

/**
 * Global bottom-right status for live LegalNote video bots.
 * Survives closing LiveBotModal and drives Meeting-to-Matter when the call ends.
 */
export function LiveBotSessionIndicator() {
  const {
    session,
    phase,
    elapsedSeconds,
    panelOpen,
    setPanelOpen,
    liveBotModalOpen,
    clearSession,
  } = useLiveBotSession();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("saving");
  const [didToastEnd, setDidToastEnd] = useState(false);

  const showFloating =
    !!session &&
    !liveBotModalOpen &&
    (phase === "joining" ||
      phase === "waiting" ||
      phase === "recording" ||
      phase === "ended" ||
      phase === "processing");

  const showEndDialog =
    !!session &&
    panelOpen &&
    (phase === "ended" ||
      phase === "processing" ||
      phase === "complete" ||
      phase === "awaiting_assignment" ||
      phase === "error");

  // Drive Meeting-to-Matter step animation from live phase
  useEffect(() => {
    if (!session) return;
    if (phase === "ended" || phase === "processing" || phase === "complete") {
      const advance = createProcessingStepTimer(setProcessingStep, 1500);
      const target = phaseToProcessingStep(phase);
      void (async () => {
        if (target === "uploading") {
          setProcessingStep("saving");
          await advance("uploading");
        } else if (target === "processing") {
          setProcessingStep("uploading");
          await advance("processing");
        } else if (target === "complete") {
          setProcessingStep("processing");
          await advance("complete");
        }
      })();
    }
  }, [phase, session?.importId]);

  useEffect(() => {
    if (!session || didToastEnd) return;
    if (phase === "ended" || phase === "processing") {
      setDidToastEnd(true);
      toast({
        title: "Call ended",
        description: session.caseTitle
          ? `LegalNote is producing the attendance note for “${session.caseTitle}”.`
          : "LegalNote is collecting the recording and producing your attendance note.",
        duration: 6000,
      });
    }
  }, [phase, session, didToastEnd, toast]);

  useEffect(() => {
    if (!session) setDidToastEnd(false);
  }, [session?.importId]);

  if (!session) return null;

  return (
    <>
      {showFloating && !showEndDialog && (
        <div className="fixed bottom-6 right-6 z-50" data-testid="live-bot-session-indicator">
          <div className="flex flex-col gap-2 bg-card border border-card-border rounded-lg p-3 shadow-xl min-w-[200px]">
            <div className="flex items-center justify-between gap-2">
              <Badge
                className={
                  phase === "recording"
                    ? "bg-destructive animate-pulse"
                    : phase === "ended" || phase === "processing"
                      ? "bg-accent"
                      : "bg-muted text-foreground"
                }
                data-testid="badge-live-bot-phase"
              >
                {phase === "recording" ? "Recording" : phaseLabel(phase)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">
                  {session.caseTitle || "Video meeting"}
                </p>
                {(phase === "joining" || phase === "waiting" || phase === "recording") && (
                  <p className="text-lg font-mono font-semibold" data-testid="text-live-bot-duration">
                    {formatElapsed(elapsedSeconds)}
                  </p>
                )}
                {(phase === "ended" || phase === "processing") && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Meeting-to-Matter in progress
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setPanelOpen(true)}
              data-testid="button-open-live-bot-panel"
            >
              {phase === "ended" || phase === "processing" ? "View progress" : "Open status"}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={showEndDialog}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open && (phase === "complete" || phase === "error" || phase === "awaiting_assignment")) {
            // Keep session for awaiting_assignment so dashboard can still find it; clear on complete/error
            if (phase === "complete" || phase === "error") clearSession();
          }
        }}
      >
        <DialogContent className="max-w-md" data-testid="dialog-live-bot-meeting-to-matter">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              {phase === "complete"
                ? "Attendance note ready"
                : phase === "awaiting_assignment"
                  ? "Recording saved"
                  : phase === "error"
                    ? "Processing issue"
                    : "Call ended"}
            </DialogTitle>
            <DialogDescription>
              {session.caseTitle
                ? `Matter: ${session.caseTitle}`
                : "LegalNote captured this meeting and is producing your documents."}
            </DialogDescription>
          </DialogHeader>

          {(phase === "ended" || phase === "processing" || phase === "complete") && (
            <MeetingToMatterProcessingOverlay processingStep={processingStep} variant="live_bot" />
          )}

          {phase === "awaiting_assignment" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
              <p className="text-sm text-muted-foreground">
                The recording is saved. Assign it to a matter from the dashboard to produce the attendance note.
              </p>
              <Button
                onClick={() => {
                  clearSession();
                  setLocation("/");
                }}
                data-testid="button-live-bot-go-dashboard"
              >
                Go to dashboard
              </Button>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Something went wrong while joining or processing this call. Check the matter page or try again.
              </p>
              <Button variant="outline" className="w-full" onClick={() => clearSession()}>
                Dismiss
              </Button>
            </div>
          )}

          {phase === "complete" && (
            <div className="flex flex-col gap-2 pt-2">
              {session.caseId ? (
                <Button
                  onClick={() => {
                    const caseId = session.caseId!;
                    clearSession();
                    setLocation(`/case/${caseId}`);
                  }}
                  data-testid="button-live-bot-view-matter"
                >
                  View matter
                </Button>
              ) : (
                <Button onClick={() => clearSession()}>Done</Button>
              )}
            </div>
          )}

          {(phase === "ended" || phase === "processing") && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setPanelOpen(false)}
              data-testid="button-live-bot-minimize-progress"
            >
              Continue in background
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
