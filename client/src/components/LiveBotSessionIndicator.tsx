import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Video, CheckCircle2 } from "lucide-react";
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
import MeetingNotesCapture from "@/components/MeetingNotesCapture";
import RecordingControlCenter, {
  ControlCenterActionButton,
} from "@/components/RecordingControlCenter";
import { useLiveBotSession, type LiveBotPhase } from "@/contexts/LiveBotSessionContext";
import { createProcessingStepTimer } from "@/lib/processingStepTimer";
import {
  flushMeetingNotesToCase,
  hasMeetingNotesDraft,
  liveBotDraftKey,
} from "@/lib/meetingNotesDraft";
import { useToast } from "@/hooks/use-toast";

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

function phaseTone(phase: LiveBotPhase): "recording" | "live" | "processing" {
  if (phase === "recording") return "recording";
  if (phase === "ended" || phase === "processing") return "processing";
  return "live";
}

/**
 * Global bottom-right status for live LegalNote video bots.
 * Survives closing LiveBotModal and drives Meeting-to-Matter when the call ends.
 * Hosts the in-meeting notes capture panel while the bot is live.
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
  const flushedRef = useRef<string | null>(null);

  const notesActive =
    !!session &&
    (phase === "joining" || phase === "waiting" || phase === "recording");

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

  // Flush solicitor notes into the matter Notes section when the call ends
  useEffect(() => {
    if (!session?.importId) return;
    const terminal =
      phase === "ended" ||
      phase === "processing" ||
      phase === "complete";
    if (!terminal || !session.caseId) return;
    if (flushedRef.current === session.importId) return;
    flushedRef.current = session.importId;

    void (async () => {
      try {
        const flushed = await flushMeetingNotesToCase({
          caseId: session.caseId!,
          draftKey: liveBotDraftKey(session.importId),
          caseTitle: session.caseTitle,
        });
        if (flushed) {
          toast({
            title: "Meeting notes saved",
            description: "Your typed notes have been added to the matter Notes section.",
            duration: 5000,
          });
        }
      } catch {
        flushedRef.current = null;
        toast({
          title: "Could not save meeting notes",
          description: "Your draft is still stored locally. Open the matter and try adding a note.",
          variant: "destructive",
          duration: 7000,
        });
      }
    })();
  }, [phase, session?.importId, session?.caseId, session?.caseTitle, toast]);

  useEffect(() => {
    if (!session) flushedRef.current = null;
  }, [session?.importId]);

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

  const draftKey = liveBotDraftKey(session.importId);
  const pendingNotesHint =
    phase === "awaiting_assignment" && hasMeetingNotesDraft(draftKey)
      ? " Your typed meeting notes will be added when you assign the recording."
      : "";

  const showTimer =
    phase === "joining" || phase === "waiting" || phase === "recording";

  return (
    <>
      {showFloating && !showEndDialog && (
        <RecordingControlCenter
          tone={phaseTone(phase)}
          statusLabel={phase === "recording" ? "Recording" : phaseLabel(phase)}
          title={session.caseTitle || "Video meeting"}
          subtitle={
            phase === "ended" || phase === "processing"
              ? "Meeting-to-Matter in progress"
              : session.caseTitle
                ? "Live meeting capture"
                : "Unassigned meeting"
          }
          elapsedSeconds={showTimer ? elapsedSeconds : undefined}
          icon="video"
          safeguards={{
            protected:
              phase === "recording" || phase === "joining" || phase === "waiting",
          }}
          data-testid="live-bot-session-indicator"
          actions={
            !notesActive ? (
              <ControlCenterActionButton
                variant="outline"
                onClick={() => setPanelOpen(true)}
                data-testid="button-open-live-bot-panel"
              >
                {phase === "ended" || phase === "processing" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    View progress
                  </>
                ) : (
                  "Open status"
                )}
              </ControlCenterActionButton>
            ) : undefined
          }
        >
          {notesActive && (
            <div className="max-h-[min(52vh,420px)] overflow-hidden">
              <MeetingNotesCapture
                draftKey={draftKey}
                caseTitle={session.caseTitle}
                elapsedSeconds={elapsedSeconds}
                active
                variant="inline"
                defaultOpen={phase === "recording"}
                liveLabel={phase === "recording" ? "Recording" : phaseLabel(phase)}
                className="rounded-none border-0 shadow-none min-h-[240px] h-[min(48vh,380px)]"
              />
            </div>
          )}
        </RecordingControlCenter>
      )}

      <Dialog
        open={showEndDialog}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open && (phase === "complete" || phase === "error" || phase === "awaiting_assignment")) {
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
                {pendingNotesHint}
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
