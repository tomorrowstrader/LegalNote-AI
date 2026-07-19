import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { MeetingSession, TimeEntry } from "@shared/schema";

interface TimeRecordingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
  matterReference?: string;
  durationSeconds?: number;
  sessionType?: string;
  entry?: TimeEntry | null;
}

const SIX_MINUTE_UNIT = 6;

function sessionLabel(session: MeetingSession): string {
  const type = session.recordingType.replace(/_/g, " ");
  const title = session.sessionTitle || type.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const date = new Date(session.startedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${title} — ${date}`;
}

export default function TimeRecordingModal({
  open,
  onOpenChange,
  caseId,
  caseTitle,
  matterReference,
  durationSeconds,
  sessionType = "Meeting",
  entry,
}: TimeRecordingModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: sessions = [] } = useQuery<MeetingSession[]>({
    queryKey: [`/api/cases/${caseId}/sessions`],
    enabled: open,
  });

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const suggestedMinutes = durationSeconds ? Math.ceil(durationSeconds / 60) : 30;
  const defaultRate = user?.hourlyRate || "250";
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(entry?.durationMinutes || suggestedMinutes);

  useEffect(() => {
    if (open) {
      const selectedSession =
        sortedSessions.find((session) => session.id === entry?.meetingSessionId) ||
        sortedSessions[0];
      setSelectedSessionId(entry?.meetingSessionId || selectedSession?.id || "");
      setDurationMinutes(
        entry?.durationMinutes ||
        (selectedSession?.durationSeconds
          ? Math.max(1, Math.ceil(selectedSession.durationSeconds / 60))
          : suggestedMinutes),
      );
    }
  }, [open, entry?.id, entry?.meetingSessionId, entry?.durationMinutes, sessions.length, suggestedMinutes]);

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const units = Math.ceil(durationMinutes / SIX_MINUTE_UNIT);
  const selectedSession = sortedSessions.find((session) => session.id === selectedSessionId);
  const description = selectedSession
    ? `${selectedSession.sessionTitle || sessionType}${matterReference ? ` - ${matterReference}` : ""} - ${caseTitle}`
    : `${sessionType}${matterReference ? ` - ${matterReference}` : ""} - ${caseTitle}`;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        meetingSessionId: selectedSessionId,
        durationMinutes,
        description,
        ...(entry ? {} : { hourlyRate: defaultRate, status: "confirmed" }),
      };
      return entry
        ? await apiRequest("PATCH", `/api/time-entries/${entry.id}`, payload)
        : await apiRequest("POST", `/api/cases/${caseId}/time-entries`, payload);
    },
    onSuccess: () => {
      toast({
        title: entry ? "Time updated" : "Time recorded",
        description: `${hours}h ${minutes}m (${units} units) linked to the session.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "time-entries"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/time-entries`] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit/case", caseId] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: entry ? "Failed to update time" : "Failed to record time",
        description: error?.message,
        variant: "destructive",
      });
    },
  });

  const updateHours = (nextHours: number) => {
    setDurationMinutes(Math.max(1, Math.max(0, nextHours) * 60 + minutes));
  };

  const updateMinutes = (nextMinutes: number) => {
    const normalisedMinutes = Math.min(59, Math.max(0, nextMinutes));
    setDurationMinutes(Math.max(1, hours * 60 + normalisedMinutes));
  };

  const updateUnits = (nextUnits: number) => {
    setDurationMinutes(Math.max(1, Math.max(1, nextUnits) * SIX_MINUTE_UNIT));
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    const session = sortedSessions.find((item) => item.id === sessionId);
    if (session?.durationSeconds) {
      setDurationMinutes(Math.max(1, Math.ceil(session.durationSeconds / 60)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {entry ? "Edit Recorded Time" : "Record Time"}
          </DialogTitle>
          <DialogDescription>
            Session audio sets the initial time. Hours, minutes and six-minute units remain editable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="time-session">Session</Label>
            <select
              id="time-session"
              value={selectedSessionId}
              onChange={(event) => handleSessionChange(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="select-time-session"
            >
              <option value="" disabled>Select a session</option>
              {sortedSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {sessionLabel(session)}
                </option>
              ))}
            </select>
            {sortedSessions.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Record or import a session before adding time.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="time-hours">Hours</Label>
              <Input
                id="time-hours"
                type="number"
                min={0}
                value={hours}
                onChange={(event) => updateHours(Number.parseInt(event.target.value, 10) || 0)}
                data-testid="input-time-hours"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time-minutes">Minutes</Label>
              <Input
                id="time-minutes"
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(event) => updateMinutes(Number.parseInt(event.target.value, 10) || 0)}
                data-testid="input-time-minutes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time-units">Units</Label>
              <Input
                id="time-units"
                type="number"
                min={1}
                value={units}
                onChange={(event) => updateUnits(Number.parseInt(event.target.value, 10) || 1)}
                data-testid="input-time-units"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            One unit is six minutes. Editing units updates the recorded duration.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-dismiss-time"
          >
            Dismiss
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || durationMinutes < 1 || !selectedSessionId}
            className="bg-accent hover:bg-accent"
            data-testid="button-confirm-time"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {entry ? "Save Changes" : "Record Time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
