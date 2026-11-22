import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Bot, CheckCircle2, Clock, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getApiErrorMessage, queryClient } from "@/lib/queryClient";
import { askForMeetingAlerts } from "@/lib/meetingAlerts";
import { useLiveBotSessionOptional } from "@/contexts/LiveBotSessionContext";
import type { ScheduledMeeting } from "@shared/schema";

type ImportState = {
  id: string;
  botStatus: string | null;
  status: string;
  errorMessage?: string | null;
  holdForRejoinUntil?: string | null;
  consentConfirmed?: boolean;
};

type LiveState = "joining" | "waiting" | "in" | "left" | "processing" | "unknown";

function liveStateFor(imp: ImportState | null): LiveState {
  if (!imp) return "unknown";
  if (imp.status === "transcribing" || imp.status === "completed" || imp.status === "awaiting_assignment") {
    return "processing";
  }
  if (imp.status === "failed") return "left";
  switch (imp.botStatus) {
    case "joining":
    case "joining_call":
      return "joining";
    case "in_waiting_room":
      return "waiting";
    case "in_call_not_recording":
    case "in_call_recording":
      return "in";
    case "call_ended":
    case "done":
    case "recording_done":
    case "fatal":
    case "left_user_cancelled":
      return "left";
    default:
      return "unknown";
  }
}

/**
 * What LegalNote is doing in this meeting, shown on the dashboard card for the
 * whole meeting, with one button to send it back in if it has left.
 */
export function MeetingBotLiveStatus({ meeting }: { meeting: ScheduledMeeting }) {
  const { toast } = useToast();
  const liveBot = useLiveBotSessionOptional();
  const [imp, setImp] = useState<ImportState | null>(null);

  useEffect(() => {
    if (!meeting.meetingImportId) {
      setImp(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/recall/import/${meeting.meetingImportId}`, { credentials: "include" });
        if (!res.ok || cancelled) return;
        setImp((await res.json()) as ImportState);
      } catch {
        // Keep the last known state.
      }
    };
    void tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [meeting.meetingImportId]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/scheduled-meetings"] });

  const sendBackIn = useMutation({
    mutationFn: async () => {
      void askForMeetingAlerts();
      return apiRequest<{ importId?: string; botId?: string; rejoin?: boolean; message?: string }>(
        "POST",
        `/api/scheduled-meetings/${meeting.id}/deploy-bot`,
      );
    },
    onSuccess: (data) => {
      // The floating live indicator follows the new bot.
      if (liveBot && data.importId && data.botId) {
        liveBot.startSession({
          importId: data.importId,
          botId: data.botId,
          caseId: meeting.caseId,
          caseTitle: meeting.title,
          meetingUrl: meeting.meetingUrl,
          consentMode: "in_meeting",
        });
      }
      toast({
        title: data.rejoin ? "LegalNote is going back in" : "LegalNote is joining",
        description: data.rejoin
          ? "Admit it from the waiting room if asked. It will be added to the same note, and consent already given still counts."
          : "Admit it from the waiting room if asked.",
      });
      refresh();
    },
    onError: (error: unknown) => {
      toast({
        title: "LegalNote couldn't go back in",
        description: getApiErrorMessage(error, "Please try again in a moment."),
        variant: "destructive",
      });
      refresh();
    },
  });

  const makeNoteNow = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/scheduled-meetings/${meeting.id}/make-note-now`),
    onSuccess: () => {
      toast({ title: "Making the note", description: "The attendance note is being prepared from what was recorded." });
      refresh();
    },
    onError: (error: unknown) => {
      toast({
        title: "Couldn't start the note",
        description: getApiErrorMessage(error, "Please try again in a moment."),
        variant: "destructive",
      });
    },
  });

  if (!meeting.meetingImportId || !imp) return null;
  const state = liveStateFor(imp);
  const held = !!imp.holdForRejoinUntil && new Date(imp.holdForRejoinUntil).getTime() > Date.now();

  if (state === "processing") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`bot-live-status-${meeting.id}`}>
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
        LegalNote has finished. The attendance note is being prepared.
      </div>
    );
  }

  if (state === "left") {
    const declined = imp.botStatus === "left_consent_declined" || /declined consent/i.test(imp.errorMessage || "");
    return (
      <div
        className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3 space-y-2"
        data-testid={`bot-live-status-${meeting.id}`}
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">LegalNote has left the meeting</p>
            {imp.errorMessage && <p className="text-xs text-muted-foreground mt-0.5">{imp.errorMessage}</p>}
            {held && (
              <p className="text-xs text-muted-foreground mt-0.5">
                What it recorded is kept. If you send it back in, both parts go into one note.
              </p>
            )}
          </div>
        </div>
        {!declined && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => sendBackIn.mutate()}
              disabled={sendBackIn.isPending}
              data-testid={`button-send-back-in-${meeting.id}`}
            >
              {sendBackIn.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
              Send LegalNote back in
            </Button>
            {held && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => makeNoteNow.mutate()}
                disabled={makeNoteNow.isPending}
                data-testid={`button-make-note-now-${meeting.id}`}
              >
                Meeting has ended, make the note
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  const line =
    state === "in"
      ? { icon: <Bot className="w-4 h-4 text-blue-600 shrink-0" />, text: "LegalNote is in the meeting." }
      : state === "waiting"
        ? {
            icon: <Clock className="w-4 h-4 text-amber-600 shrink-0" />,
            text: "LegalNote is in the waiting room. Ask the host to admit it.",
          }
        : state === "joining"
          ? { icon: <Loader2 className="w-4 h-4 animate-spin shrink-0" />, text: "LegalNote is joining…" }
          : null;
  if (!line) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`bot-live-status-${meeting.id}`}>
      {line.icon}
      {line.text}
    </div>
  );
}
