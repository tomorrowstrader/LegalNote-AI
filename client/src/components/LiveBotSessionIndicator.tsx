import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ExternalLink, Loader2, Video, CheckCircle2 } from "lucide-react";
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
import { useMeetingNotesPopout } from "@/hooks/useMeetingNotesPopout";
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
      return "Meeting not captured";
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
    waitRemainingLabel,
    panelOpen,
    setPanelOpen,
    liveBotModalOpen,
    clearSession,
    cancelSession,
    stopSession,
    cancelling,
    stopping,
    errorMessage,
  } = useLiveBotSession();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("saving");
  const [didToastEnd, setDidToastEnd] = useState(false);
  const flushedRef = useRef<string | null>(null);
  const autoMinimizedRef = useRef<string | null>(null);

  const notesActive =
    !!session &&
    (phase === "joining" || phase === "waiting" || phase === "recording");

  const draftKey = session ? liveBotDraftKey(session.importId) : null;
  const {
    popoutOpen,
    openPopout,
    focusPopout,
    closePopout,
  } = useMeetingNotesPopout(draftKey, {
    active: notesActive,
    caseTitle: session?.caseTitle,
    liveLabel: phase === "recording" ? "Recording" : phaseLabel(phase),
    elapsedSeconds,
  });

  const handlePopOut = () => {
    const ok = openPopout();
    if (!ok) {
      toast({
        title: "Could not open notes window",
        description: "Allow pop-ups for LegalNote, then try again.",
        variant: "destructive",
        duration: 6000,
      });
    }
  };

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

  // Auto-minimize the blocking "Call ended" overlay so users can keep working;
  // production often takes 1–2+ minutes. Status pill remains bottom-right.
  useEffect(() => {
    if (!session) return;
    if (!(phase === "ended" || phase === "processing")) return;
    if (!panelOpen) return;
    if (autoMinimizedRef.current === session.importId) return;

    const timer = window.setTimeout(() => {
      autoMinimizedRef.current = session.importId;
      setPanelOpen(false);
      toast({
        title: "Producing in the background",
        description: "Use the status pill bottom-right to check progress anytime.",
        duration: 5000,
      });
    }, 20_000);

    return () => window.clearTimeout(timer);
  }, [session, phase, panelOpen, setPanelOpen, toast]);

  useEffect(() => {
    if (!session) autoMinimizedRef.current = null;
  }, [session?.importId]);

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
    // Never toast "Call ended" for abandoned / cancelled failures
    if (phase === "error") {
      setDidToastEnd(true);
      toast({
        title: "Meeting not captured",
        description:
          errorMessage ||
          "LegalNote could not join or record this meeting. No attendance note was produced.",
        duration: 7000,
        variant: "destructive",
      });
      return;
    }
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
  }, [phase, session, didToastEnd, toast, errorMessage]);

  useEffect(() => {
    if (!session) setDidToastEnd(false);
  }, [session?.importId]);

  if (!session || !draftKey) return null;

  const pendingNotesHint =
    phase === "awaiting_assignment" && hasMeetingNotesDraft(draftKey)
      ? " Your typed meeting notes will be added when you assign the recording."
      : "";

  const showTimer =
    phase === "joining" || phase === "waiting" || phase === "recording";

  const waitSubtitle =
    (phase === "waiting" || phase === "joining") && waitRemainingLabel
      ? `Auto-leaves in ${waitRemainingLabel} if not admitted`
      : null;

  const handleCancel = async () => {
    const result = await cancelSession();
    if (result.success) {
      toast({
        title: "LegalNote cancelled",
        description: result.errorMessage || "LegalNote left the meeting. No attendance note will be produced.",
        duration: 5000,
      });
    } else {
      toast({
        title: "Could not cancel",
        description: result.errorMessage || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStop = async () => {
    const result = await stopSession();
    if (result.success) {
      toast({
        title: "LegalNote stopped",
        description: "LegalNote left the call. Meeting-to-Matter will produce the attendance note from what was captured.",
        duration: 6000,
      });
    } else {
      toast({
        title: "Could not stop",
        description: result.errorMessage || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const leaveBusy = cancelling || stopping;

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
              : waitSubtitle ||
                (session.caseTitle ? "Live meeting capture" : "Unassigned meeting")
          }
          elapsedSeconds={showTimer ? elapsedSeconds : undefined}
          icon="video"
          safeguards={{
            protected:
              phase === "recording" || phase === "joining" || phase === "waiting",
          }}
          data-testid="live-bot-session-indicator"
          actions={
            notesActive ? (
              phase === "recording" ? (
                <ControlCenterActionButton
                  variant="destructive"
                  disabled={leaveBusy}
                  onClick={() => void handleStop()}
                  data-testid="button-stop-live-bot"
                >
                  {stopping ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Stopping…
                    </>
                  ) : (
                    "Stop LegalNote"
                  )}
                </ControlCenterActionButton>
              ) : (
                <ControlCenterActionButton
                  variant="outline"
                  disabled={leaveBusy}
                  onClick={() => void handleCancel()}
                  data-testid="button-cancel-live-bot"
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Cancelling…
                    </>
                  ) : (
                    "Cancel LegalNote"
                  )}
                </ControlCenterActionButton>
              )
            ) : (
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
            )
          }
        >
          {notesActive && popoutOpen && (
            <div
              className="space-y-2.5 px-4 pb-4 pt-1"
              data-testid="meeting-notes-popout-dock"
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                Meeting notes are open in a separate window — keep it beside your video call.
                Drafts stay in sync and save when the call ends.
              </p>
              <div className="flex flex-col gap-2">
                <ControlCenterActionButton
                  variant="outline"
                  onClick={focusPopout}
                  data-testid="button-focus-meeting-notes-popout"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Focus notes window
                </ControlCenterActionButton>
                <ControlCenterActionButton
                  variant="outline"
                  onClick={closePopout}
                  data-testid="button-dock-meeting-notes-inline"
                >
                  Dock notes here
                </ControlCenterActionButton>
              </div>
            </div>
          )}
          {notesActive && !popoutOpen && (
            <div className="max-h-[min(48vh,400px)] overflow-hidden">
              <MeetingNotesCapture
                draftKey={draftKey}
                caseTitle={session.caseTitle}
                elapsedSeconds={elapsedSeconds}
                active
                variant="inline"
                defaultOpen={phase === "recording"}
                liveLabel={phase === "recording" ? "Recording" : phaseLabel(phase)}
                onPopOut={handlePopOut}
                className="min-h-[240px] h-[min(44vh,360px)] rounded-none border-0 shadow-none"
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
                    ? "Meeting not captured"
                    : "Call ended"}
            </DialogTitle>
            <DialogDescription>
              {session.caseTitle
                ? `Matter: ${session.caseTitle}`
                : phase === "error"
                  ? "LegalNote could not capture this meeting."
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
                {errorMessage ||
                  "Something went wrong while joining or processing this call. Check the matter page or try again."}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => clearSession()}
                data-testid="button-dismiss-live-bot-error"
              >
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
            <div className="space-y-2 pt-1">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setPanelOpen(false)}
                data-testid="button-live-bot-minimize-progress"
              >
                Continue in background
              </Button>
              <p className="text-center text-xs text-muted-foreground px-1">
                This usually takes a couple of minutes. The dialog closes automatically so you can keep working — watch the status pill bottom-right.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
