import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Clock, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TimeEntry } from "@shared/schema";

const SIX_MINUTE_UNIT = 6;

type DraftTimeEntryBannerProps = {
  caseId: string;
  entries: TimeEntry[];
};

export function DraftTimeEntryBanner({ caseId, entries }: DraftTimeEntryBannerProps) {
  const { toast } = useToast();
  const drafts = entries.filter((e) => e.status === "draft");
  if (drafts.length === 0) return null;

  const confirmMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest("PATCH", `/api/time-entries/${entryId}`, { status: "confirmed" });
    },
    onSuccess: (_data, entryId) => {
      const entry = drafts.find((d) => d.id === entryId);
      const units = entry ? Math.ceil(entry.durationMinutes / SIX_MINUTE_UNIT) : 0;
      toast({
        title: "Time confirmed",
        description: entry
          ? `${Math.floor(entry.durationMinutes / 60)}h ${entry.durationMinutes % 60}m (${units} units) logged.`
          : "Time entry confirmed.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/time-entries`] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
    },
    onError: (error: Error) => {
      toast({ title: "Could not confirm time", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div
      className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3"
      data-testid="banner-draft-time"
    >
      <div className="flex items-start gap-2">
        <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Time ready to confirm</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Draft time from your last session — confirm to add it to the matter ledger.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {drafts.map((entry) => {
          const units = Math.ceil(entry.durationMinutes / SIX_MINUTE_UNIT);
          const h = Math.floor(entry.durationMinutes / 60);
          const m = entry.durationMinutes % 60;
          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm bg-background/80 rounded-md px-3 py-2 border border-border/60"
            >
              <span className="text-muted-foreground truncate max-w-[60%]">
                {entry.description || "Meeting time"}
              </span>
              <span className="font-medium tabular-nums">
                {h > 0 ? `${h}h ` : ""}
                {m}m · {units} units
              </span>
              <Button
                size="sm"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate(entry.id)}
                data-testid={`button-confirm-draft-time-${entry.id}`}
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Confirm"
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
