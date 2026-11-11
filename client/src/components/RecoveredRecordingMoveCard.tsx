import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MatterFilingFields, useMatterFilingForm } from "@/components/MatterFilingFields";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RecoveredMoveStatus {
  recovered: boolean;
  block: string | null;
  message: string | null;
  durationSeconds: number | null;
  expiresAt: string | null;
  hasConsentClip: boolean;
  litigationHold: boolean;
}

interface MoveResult {
  targetCaseId: string;
  holdCarried: boolean;
  consentSealed: boolean;
  consentError: string | null;
}

function recordingLength(seconds: number | null): string {
  if (!seconds) return "";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

/** Offers to move a recording that was recovered into its own case onto the matter it belongs to. */
export function RecoveredRecordingMoveCard({ caseId }: { caseId: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const { data: status } = useQuery<RecoveredMoveStatus>({
    queryKey: [`/api/cases/${caseId}/recovered-recording`],
  });
  const form = useMatterFilingForm({ enabled: !!status?.recovered, excludeCaseId: caseId });
  const target = form.target;

  const moveMutation = useMutation({
    mutationFn: () =>
      apiRequest<MoveResult>("POST", `/api/cases/${caseId}/move-recovered-recording`, form.payload()),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/") });
      setOpen(false);
      toast({
        title: "Recording moved",
        description: [
          result.consentSealed ? "Consent is sealed against this recording." : "Record consent on the matter before processing.",
          result.holdCarried ? "The litigation hold now applies to this matter too." : "",
        ].filter(Boolean).join(" "),
        variant: result.consentError ? "destructive" : undefined,
        duration: 8000,
      });
      setLocation(`/case/${result.targetCaseId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Could not move the recording",
        description: error?.message || "Nothing was moved. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!status?.recovered) return null;

  const expires = status.expiresAt ? new Date(status.expiresAt) : null;
  const canMove = form.ready;

  return (
    <div className="p-5 bg-card rounded-md border border-accent/50" data-testid="recovered-recording-card">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-semibold text-sm">This recording was recovered into its own case</p>
          <p className="text-sm text-muted-foreground">
            It did not finish saving, so LegalNote kept it here instead of on its matter. Move it to the matter it belongs to before consent is recorded or anything is produced.
            {expires && !status.litigationHold ? ` The audio is deleted on ${format(expires, "d MMM yyyy 'at' HH:mm")} unless it is under a litigation hold.` : ""}
          </p>
          {status.block && status.block !== "not_recovered" && (
            <p className="text-sm text-destructive" data-testid="recovered-recording-block">{status.message}</p>
          )}
        </div>
        {!status.block && (
          <Button size="sm" className="gap-2 shrink-0" onClick={() => setOpen(true)} data-testid="button-move-recovered">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Move to matter
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={(next) => !moveMutation.isPending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-move-recovered">
          <DialogHeader>
            <DialogTitle>Move this recording</DialogTitle>
            <DialogDescription>
              The session and audio{status.hasConsentClip ? ", including the consent clip," : ""} move together{status.durationSeconds ? ` (${recordingLength(status.durationSeconds)})` : ""}. The move is recorded on both cases, and this case is then archived.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <MatterFilingFields form={form} idPrefix="move" />

            {status.litigationHold && target && !target.litigationHold && (
              <p className="text-xs text-muted-foreground">
                This recording is under a litigation hold. The hold will also apply to {target.title}, so its records are kept and its share links and meeting type are locked until it is released.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={moveMutation.isPending}>Cancel</Button>
            <Button onClick={() => moveMutation.mutate()} disabled={!canMove || moveMutation.isPending} data-testid="button-confirm-move-recovered">
              {moveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Move recording"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
