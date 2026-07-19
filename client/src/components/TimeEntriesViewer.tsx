import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Loader2, Pencil, Trash2 } from "lucide-react";
import type { MeetingSession, TimeEntry } from "@shared/schema";
import TimeRecordingModal from "./TimeRecordingModal";

interface TimeEntriesViewerProps {
  caseId: string;
  caseTitle: string;
  matterReference?: string;
  durationSeconds?: number;
}

export default function TimeEntriesViewer({
  caseId,
  caseTitle,
  matterReference,
  durationSeconds,
}: TimeEntriesViewerProps) {
  const { toast } = useToast();
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ["/api/cases", caseId, "time-entries"],
  });

  const { data: sessions = [] } = useQuery<MeetingSession[]>({
    queryKey: [`/api/cases/${caseId}/sessions`],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/time-entries/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Time entry deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "time-entries"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/time-entries`] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit/case", caseId] });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const totalUnits = entries.reduce((sum, entry) => sum + Math.ceil(entry.durationMinutes / 6), 0);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  const getSessionName = (entry: TimeEntry) => {
    const session = entry.meetingSessionId ? sessionById.get(entry.meetingSessionId) : undefined;
    if (!session) return "Unlinked legacy entry";
    return session.sessionTitle || session.recordingType.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {entries.length > 0 && (
            <span>
              {entries.length} {entries.length === 1 ? "entry" : "entries"} · {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m · {totalUnits} units
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRecordModal(true)}
          className="gap-2"
          data-testid="button-add-time-entry"
        >
          <Clock className="w-4 h-4" />
          Record Time
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4" data-testid="text-no-time-entries">
          No time entries recorded for this matter yet. Click "Record Time" to add one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground">Session</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Hours</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Minutes</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Units</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.id} data-testid={`time-entry-${entry.id}`}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-foreground" data-testid={`text-time-session-${entry.id}`}>
                      {getSessionName(entry)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right">{Math.floor(entry.durationMinutes / 60)}</td>
                  <td className="px-3 py-3 text-right">{entry.durationMinutes % 60}</td>
                  <td className="px-3 py-3 text-right">{Math.ceil(entry.durationMinutes / 6)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingEntry(entry)}
                        data-testid={`button-edit-entry-${entry.id}`}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      {entry.status === "draft" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(entry.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-entry-${entry.id}`}
                        >
                          {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TimeRecordingModal
        open={showRecordModal}
        onOpenChange={setShowRecordModal}
        caseId={caseId}
        caseTitle={caseTitle}
        matterReference={matterReference}
        durationSeconds={durationSeconds}
      />
      <TimeRecordingModal
        open={!!editingEntry}
        onOpenChange={(open) => {
          if (!open) setEditingEntry(null);
        }}
        caseId={caseId}
        caseTitle={caseTitle}
        matterReference={matterReference}
        durationSeconds={durationSeconds}
        entry={editingEntry}
      />
    </div>
  );
}
