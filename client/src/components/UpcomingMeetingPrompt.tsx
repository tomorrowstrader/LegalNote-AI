import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Calendar, Clock, FileText, Video, X } from "lucide-react";
import type { Case, ScheduledMeeting } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LiveBotModal } from "@/components/LiveBotModal";
import { getSafeHttpsMeetingUrl } from "@/lib/meetingUrl";
import { queryClient } from "@/lib/queryClient";

type PromptOffset = 30 | 1;

const DISMISS_PREFIX = "ln-meeting-prompt-dismissed:";
/** Match server T-30 cron window (~25–35 min). Do not treat "anytime under 30 min" as T-30. */
const T30_MAX_MS = 35 * 60 * 1000;
const T30_MIN_MS = 25 * 60 * 1000;
/** Join-now prompt: from 5 minutes before start through the 15-minute late-join grace. */
const JOIN_EARLY_MS = 5 * 60 * 1000;
const JOIN_LATE_MS = 15 * 60 * 1000;

function dismissKey(meetingId: string, offset: PromptOffset): string {
  return `${DISMISS_PREFIX}${meetingId}:${offset}`;
}

function isDismissed(meetingId: string, offset: PromptOffset): boolean {
  try {
    return localStorage.getItem(dismissKey(meetingId, offset)) === "1";
  } catch {
    return false;
  }
}

function markDismissed(meetingId: string, offset: PromptOffset): void {
  try {
    localStorage.setItem(dismissKey(meetingId, offset), "1");
  } catch {
    // ignore quota / private mode
  }
}

interface ActivePrompt {
  meeting: ScheduledMeeting;
  offset: PromptOffset;
}

/** Exported for unit tests. */
export function pickActivePrompt(
  meetings: ScheduledMeeting[] | undefined,
  now: number,
): ActivePrompt | null {
  if (!meetings?.length) return null;

  const scheduled = meetings.filter((m) => m.status === "scheduled");

  for (const meeting of scheduled) {
    const msUntil = new Date(meeting.startTime).getTime() - now;
    // Join window: T-5 through T+15 (includes after scheduled start).
    if (msUntil <= JOIN_EARLY_MS && msUntil > -JOIN_LATE_MS && !isDismissed(meeting.id, 1)) {
      return { meeting, offset: 1 };
    }
  }

  for (const meeting of scheduled) {
    const msUntil = new Date(meeting.startTime).getTime() - now;
    // Only the ~30-minute prepare window — late-synced meetings (e.g. 7 min out) skip T-30.
    if (msUntil >= T30_MIN_MS && msUntil <= T30_MAX_MS && !isDismissed(meeting.id, 30)) {
      return { meeting, offset: 30 };
    }
  }

  return null;
}

/**
 * App-wide T-30 / join-now meeting prompts (one component, offset selects content).
 * Join-now fires from 5 minutes before start through the 15-minute late-join grace.
 * Mount in the authenticated shell so it fires on any page.
 */
export function UpcomingMeetingPrompt({ blocked = false }: { blocked?: boolean }) {
  const [, setLocation] = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [suppressed, setSuppressed] = useState(false);
  const [liveBotOpen, setLiveBotOpen] = useState(false);
  const [joinTarget, setJoinTarget] = useState<{
    meetingUrl: string;
    caseId?: string;
    caseTitle?: string;
    suggestedClientName?: string;
  } | null>(null);

  const { data: meetings } = useQuery<ScheduledMeeting[]>({
    queryKey: ["/api/scheduled-meetings"],
    refetchInterval: 15000,
    enabled: !blocked,
  });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const evtSource = new EventSource("/api/notifications/stream", { withCredentials: true });
    evtSource.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setNow(Date.now());
    };
    evtSource.onerror = () => evtSource.close();
    return () => evtSource.close();
  }, []);

  const active = useMemo(() => pickActivePrompt(meetings, now), [meetings, now]);

  useEffect(() => {
    setSuppressed(false);
  }, [active?.meeting.id, active?.offset]);

  const open = !!active && !suppressed && !blocked && !liveBotOpen;
  const caseId = active?.meeting.caseId ?? undefined;

  const { data: linkedCase } = useQuery<Case>({
    queryKey: [`/api/cases/${caseId}`],
    enabled: !!caseId && (open || liveBotOpen),
  });

  const { data: existingBrief } = useQuery<{ id: string } | null>({
    queryKey: [`/api/cases/${caseId}/pre-meeting-briefing`],
    enabled: !!caseId && open && active?.offset === 30,
  });

  const briefReady = !!existingBrief;

  const handleDismiss = useCallback(() => {
    if (!active) return;
    markDismissed(active.meeting.id, active.offset);
    setSuppressed(true);
  }, [active]);

  const handlePrepareBriefing = useCallback(() => {
    if (!active?.meeting.caseId) return;
    const preparing = briefReady ? "" : "&preparing=1";
    markDismissed(active.meeting.id, active.offset);
    setSuppressed(true);
    setLocation(`/case/${active.meeting.caseId}?section=briefing${preparing}`);
  }, [active, briefReady, setLocation]);

  /** Opens LiveBotModal so the solicitor must still press Send LegalNote to Call. */
  const handleJoinWithLegalNote = useCallback(() => {
    if (!active) return;
    const url = getSafeHttpsMeetingUrl(active.meeting.meetingUrl);
    setJoinTarget({
      meetingUrl: url || "",
      caseId: active.meeting.caseId || undefined,
      caseTitle: linkedCase?.title || active.meeting.title || undefined,
      suggestedClientName: active.meeting.clientName || linkedCase?.clientName || undefined,
    });
    markDismissed(active.meeting.id, active.offset);
    setSuppressed(true);
    setLiveBotOpen(true);
  }, [active, linkedCase?.title, linkedCase?.clientName]);

  if (!active && !liveBotOpen) return null;

  const meeting = active?.meeting;
  const startTime = meeting ? new Date(meeting.startTime) : null;
  const clientLabel = meeting?.clientName || linkedCase?.clientName || null;
  const caseLabel = linkedCase?.title || null;
  const msUntilStart = startTime ? startTime.getTime() - now : 0;
  const meetingHasStarted = msUntilStart <= 0;

  return (
    <>
      {meeting && startTime && (
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (!next) handleDismiss();
          }}
        >
          <AlertDialogContent data-testid={`dialog-meeting-prompt-${active!.offset}`}>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {active!.offset === 1
                  ? meetingHasStarted
                    ? "Meeting in progress"
                    : "Meeting starting"
                  : "Meeting in 30 minutes"}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    {active!.offset === 1
                      ? meetingHasStarted
                        ? "Your meeting has started — you can still join now."
                        : "Your meeting is about to begin."
                      : "You have an upcoming meeting. Review the matter before you join."}
                  </p>
                  <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 text-foreground">
                    <p className="font-medium">{meeting.title}</p>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {format(startTime, "EEE d MMM · HH:mm")}
                    </p>
                    {clientLabel && (
                      <p data-testid="meeting-prompt-client">Client: {clientLabel}</p>
                    )}
                    {caseLabel && (
                      <p data-testid="meeting-prompt-case">Matter: {caseLabel}</p>
                    )}
                  </div>
                  {active!.offset === 1 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      LegalNote is not in the call until you send it. Continue to send LegalNote and join the meeting.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:justify-end">
              <AlertDialogCancel
                onClick={handleDismiss}
                data-testid="button-meeting-prompt-dismiss"
              >
                <X className="w-4 h-4 mr-1" />
                Dismiss
              </AlertDialogCancel>

              {active!.offset === 30 && caseId && (
                <Button
                  onClick={handlePrepareBriefing}
                  data-testid="button-meeting-prompt-briefing"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  {briefReady ? "View briefing" : "Prepare briefing"}
                </Button>
              )}

              {active!.offset === 1 && (
                <Button onClick={handleJoinWithLegalNote} data-testid="button-meeting-prompt-join">
                  <Video className="w-4 h-4 mr-1" />
                  Join now with LegalNote
                </Button>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <LiveBotModal
        open={liveBotOpen}
        onOpenChange={(next) => {
          setLiveBotOpen(next);
          if (!next) setJoinTarget(null);
        }}
        caseId={joinTarget?.caseId}
        caseTitle={joinTarget?.caseTitle}
        initialMeetingUrl={joinTarget?.meetingUrl}
        suggestedClientName={joinTarget?.suggestedClientName}
      />
    </>
  );
}
