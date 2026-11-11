import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Loader2, Mic, Trash2 } from "lucide-react";
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
import { apiRequest, getApiErrorMessage, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ParkedRecording {
  id: string;
  startedAt: string;
  durationSeconds: number;
  hasConsent: boolean;
  expiresAt: string;
}

interface FileResult {
  caseId: string;
  sessionId: string;
  consentSealed: boolean;
  consentError: string | null;
}

const PARKED_KEY = ["/api/audio/parked-recordings"];

function lengthLabel(seconds: number): string {
  if (!seconds) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

function FileParkedDialog({ recording, onClose }: { recording: ParkedRecording; onClose: () => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const form = useMatterFilingForm({ enabled: true, initialConsent: recording.hasConsent ? "yes" : "" });

  const fileMutation = useMutation({
    mutationFn: () => apiRequest<FileResult>("POST", `/api/audio/parked-recordings/${recording.id}/file`, form.payload()),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: PARKED_KEY });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/cases") });
      onClose();
      if (result.consentSealed) {
        // Same as filing straight away: processing starts once consent is sealed.
        apiRequest("POST", `/api/cases/${result.caseId}/process`, { sessionId: result.sessionId })
          .then(() => queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/cases") }))
          .catch((error) => {
            toast({
              title: "Processing did not start",
              description: `${getApiErrorMessage(error, "Unknown error")}. You can start it from the matter.`,
              variant: "destructive",
              duration: 10000,
            });
          });
      }
      toast({
        title: "Recording filed",
        description: result.consentError
          ?? (result.consentSealed
            ? "It sits among the matter's sessions by the date it was recorded. Documents are being prepared."
            : "It sits among the matter's sessions by the date it was recorded. Record consent on the matter before processing."),
        variant: result.consentError ? "destructive" : undefined,
        duration: 8000,
      });
      setLocation(`/case/${result.caseId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Could not file the recording",
        description: error?.message || "Nothing was filed. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open onOpenChange={(next) => !next && !fileMutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-file-parked">
        <DialogHeader>
          <DialogTitle>File this recording</DialogTitle>
          <DialogDescription>
            Recorded {format(new Date(recording.startedAt), "d MMM yyyy 'at' HH:mm")}
            {recording.durationSeconds ? ` · ${lengthLabel(recording.durationSeconds)}` : ""}. It keeps this date on the matter, so it takes its place among the sessions in the order the meetings happened.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <MatterFilingFields
            form={form}
            idPrefix="parked"
            consentNote="This seals the Quick Record consent wording you confirmed when recording started against this recording on the matter. It cannot be changed afterwards."
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={fileMutation.isPending}>Cancel</Button>
          <Button
            onClick={() => fileMutation.mutate()}
            disabled={!form.ready || fileMutation.isPending}
            data-testid="button-confirm-file-parked"
          >
            {fileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "File & process"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Quick Records set aside with "File later", waiting on the dashboard to be filed on a matter. */
export function ParkedRecordingsCard() {
  const { toast } = useToast();
  const [filing, setFiling] = useState<ParkedRecording | null>(null);
  const [deleting, setDeleting] = useState<ParkedRecording | null>(null);

  const { data } = useQuery<ParkedRecording[] | null>({ queryKey: PARKED_KEY });
  // The public demo answers unknown requests with null.
  const parked = Array.isArray(data) ? data : [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/audio/parked-recordings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARKED_KEY });
      setDeleting(null);
      toast({ title: "Recording deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not delete the recording",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (parked.length === 0) return null;

  return (
    <div className="mb-6 border border-amber-500/30 bg-amber-500/5 rounded-lg overflow-hidden" data-testid="card-parked-recordings">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-500/20">
        <Mic className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          {parked.length} recording{parked.length !== 1 ? "s" : ""} to file
        </p>
      </div>
      <div className="divide-y divide-amber-500/10">
        {parked.map((recording) => (
          <div key={recording.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-testid={`row-parked-${recording.id}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Quick Record</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Recorded {format(new Date(recording.startedAt), "d MMM yyyy, HH:mm")}
                {recording.durationSeconds ? ` · ${lengthLabel(recording.durationSeconds)}` : ""}
                {` · deleted ${format(new Date(recording.expiresAt), "d MMM")} if not filed`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" variant="outline" onClick={() => setFiling(recording)} data-testid={`button-file-parked-${recording.id}`}>
                File to matter
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Delete recording"
                onClick={() => setDeleting(recording)}
                data-testid={`button-delete-parked-${recording.id}`}
              >
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filing && <FileParkedDialog key={filing.id} recording={filing} onClose={() => setFiling(null)} />}

      <Dialog open={!!deleting} onOpenChange={(next) => !next && !deleteMutation.isPending && setDeleting(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-delete-parked">
          <DialogHeader>
            <DialogTitle>Delete this recording?</DialogTitle>
            <DialogDescription>
              The audio is deleted and cannot be recovered. Nothing has been filed on a matter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>Keep it</Button>
            <Button
              variant="destructive"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-parked"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete recording"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
