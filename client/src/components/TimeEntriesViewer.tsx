import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Check, Loader2, ExternalLink, Trash2 } from "lucide-react";
import type { TimeEntry } from "@shared/schema";
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

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ["/api/cases", caseId, "time-entries"],
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/time-entries/${id}`, { status: "confirmed" });
    },
    onSuccess: () => {
      toast({ title: "Time entry confirmed" });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "time-entries"] });
    },
    onError: () => {
      toast({ title: "Failed to confirm", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/time-entries/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Time entry deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "time-entries"] });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const pushToClioMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/time-entries/${id}/push-to-clio`, {});
    },
    onSuccess: () => {
      toast({ title: "Pushed to Clio" });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "time-entries"] });
    },
    onError: (error: any) => {
      toast({ title: "Clio push failed", description: error.message || "Could not push to Clio", variant: "destructive" });
    },
  });

  const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const totalValue = entries.reduce((sum, e) => sum + (e.durationMinutes / 60) * (parseFloat(e.hourlyRate) || 0), 0);

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
              {entries.length} {entries.length === 1 ? "entry" : "entries"} · {totalMinutes} mins · £{totalValue.toFixed(2)}
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
        <div className="divide-y divide-border">
          {entries.map((entry) => {
            const entryTotal = ((entry.durationMinutes / 60) * parseFloat(entry.hourlyRate)).toFixed(2);
            return (
              <div key={entry.id} className="py-3 flex items-start justify-between gap-3" data-testid={`time-entry-${entry.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate" data-testid={`text-time-desc-${entry.id}`}>
                    {entry.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span>{entry.durationMinutes} mins</span>
                    <span>£{entry.hourlyRate}/hr</span>
                    <span className="font-medium text-foreground">£{entryTotal}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={entry.status === "confirmed" ? "default" : "outline"}
                    className={entry.status === "confirmed" ? "bg-accent" : ""}
                    data-testid={`badge-status-${entry.id}`}
                  >
                    {entry.status === "confirmed" ? "Confirmed" : "Draft"}
                  </Badge>
                  {entry.status === "draft" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirmMutation.mutate(entry.id)}
                        disabled={confirmMutation.isPending}
                        data-testid={`button-confirm-entry-${entry.id}`}
                      >
                        {confirmMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-entry-${entry.id}`}
                      >
                        {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </Button>
                    </>
                  )}
                  {entry.status === "confirmed" && !entry.clioTimeEntryId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pushToClioMutation.mutate(entry.id)}
                      disabled={pushToClioMutation.isPending}
                      data-testid={`button-push-clio-${entry.id}`}
                    >
                      {pushToClioMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Push to Clio
                        </>
                      )}
                    </Button>
                  )}
                  {entry.clioTimeEntryId && (
                    <Badge variant="secondary" data-testid={`badge-clio-${entry.id}`}>
                      In Clio
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
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
    </div>
  );
}
