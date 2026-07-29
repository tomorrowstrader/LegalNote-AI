import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Clock, Loader2, Video, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLiveBotSessionOptional } from "@/contexts/LiveBotSessionContext";

export interface IncompleteVideoImport {
  importId: string;
  botId: string;
  caseId: string | null;
  caseTitle: string | null;
  status: string;
  botStatus: string | null;
  meetingTitle: string | null;
  meetingPlatform: string | null;
  meetingUrl: string | null;
  createdAt: string;
  consentMode: string;
  consentConfirmed: boolean;
  errorMessage: string | null;
}

/** Persist dismissals so the recovery prompt does not reappear every login for the same import+status. */
const DISMISS_PREFIX = "ln-video-bot-recovery-dismissed:";

function dismissKey(importId: string, status: string): string {
  return `${DISMISS_PREFIX}${importId}:${status}`;
}

/** Exported for unit tests. */
export function isVideoBotRecoveryDismissed(importId: string, status: string): boolean {
  try {
    return localStorage.getItem(dismissKey(importId, status)) === "1";
  } catch {
    return false;
  }
}

/** Exported for unit tests. Permanent ack — will not show again for this import+status. */
export function markVideoBotRecoveryDismissed(importId: string, status: string): void {
  try {
    localStorage.setItem(dismissKey(importId, status), "1");
  } catch {
    // ignore quota / private mode
  }
}

function markImportsDismissed(imports: Pick<IncompleteVideoImport, "importId" | "status">[]): void {
  for (const imp of imports) {
    markVideoBotRecoveryDismissed(imp.importId, imp.status);
  }
}

function filterUndismissed(imports: IncompleteVideoImport[]): IncompleteVideoImport[] {
  return imports.filter((i) => !isVideoBotRecoveryDismissed(i.importId, i.status));
}

interface VideoBotRecoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function statusLabel(imp: IncompleteVideoImport): string {
  if (imp.status === "awaiting_assignment") return "Needs matter assignment";
  if (imp.status === "failed") return "Processing failed";
  if (imp.status === "transcribing" || imp.status === "downloading") return "Producing attendance note";
  if (imp.status === "pending") return "Ready to process";
  if (imp.status === "live") {
    const done = ["done", "recording_done", "call_ended"].includes(imp.botStatus || "");
    return done ? "Call ended — ready to process" : "Bot still in meeting";
  }
  return imp.status;
}

function platformLabel(platform: string | null): string {
  if (!platform) return "Video call";
  if (platform === "zoom") return "Zoom";
  if (platform === "teams") return "Teams";
  if (platform === "meet") return "Google Meet";
  return platform;
}

export function VideoBotRecoveryModal({ open, onOpenChange }: VideoBotRecoveryModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const liveBotSession = useLiveBotSessionOptional();
  const [actingId, setActingId] = useState<string | null>(null);

  const { data: imports = [], isLoading, refetch } = useQuery<IncompleteVideoImport[]>({
    queryKey: ["/api/recall/imports/incomplete"],
    enabled: open,
  });

  const activeSessionImportId = liveBotSession?.session?.importId;

  const visibleImports = useMemo(
    () =>
      filterUndismissed(imports.filter((i) => i.importId !== activeSessionImportId)),
    [imports, activeSessionImportId],
  );

  const acknowledgeAndClose = useCallback(
    (importsToDismiss: Pick<IncompleteVideoImport, "importId" | "status">[] = visibleImports) => {
      markImportsDismissed(importsToDismiss);
      onOpenChange(false);
    },
    [onOpenChange, visibleImports],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        // X / escape / overlay — treat as acknowledged so it does not return next login
        markImportsDismissed(visibleImports);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, visibleImports],
  );

  useEffect(() => {
    if (open && !isLoading && visibleImports.length === 0) {
      onOpenChange(false);
    }
  }, [open, isLoading, visibleImports.length, onOpenChange]);

  const processMutation = useMutation({
    mutationFn: async (importId: string) =>
      apiRequest("POST", `/api/recall/import/${importId}/process`, {}),
  });

  const resumeImport = async (imp: IncompleteVideoImport) => {
    setActingId(imp.importId);
    try {
      const botStillLive =
        imp.status === "live" &&
        !!imp.botStatus &&
        !["done", "recording_done", "call_ended", "fatal"].includes(imp.botStatus);

      if (imp.status === "awaiting_assignment") {
        acknowledgeAndClose([imp]);
        setLocation("/");
        toast({
          title: "Recording awaiting assignment",
          description: "Assign this video recording to a matter on the dashboard to produce the attendance note.",
          duration: 6000,
        });
        return;
      }

      // Hydrate global live-bot session so the pill / Meeting-to-Matter UI takes over
      if (imp.botId && liveBotSession) {
        liveBotSession.startSession({
          importId: imp.importId,
          botId: imp.botId,
          caseId: imp.caseId,
          caseTitle: imp.caseTitle,
          meetingUrl: imp.meetingUrl,
          consentMode: (imp.consentMode === "in_meeting" ? "in_meeting" : "pre_confirmed"),
          startedAt: new Date(imp.createdAt).getTime(),
        });
      }

      const needsManualProcess =
        (imp.status === "pending" ||
          imp.status === "failed" ||
          (imp.status === "live" && !botStillLive)) &&
        !!imp.botId;

      if (needsManualProcess) {
        try {
          await processMutation.mutateAsync(imp.importId);
        } catch (err: any) {
          const msg = String(err?.message || "");
          // Still in meeting — resume tracking only
          if (!msg.includes("still in the meeting")) {
            throw err;
          }
        }
      }

      liveBotSession?.setPanelOpen(!botStillLive);
      queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/incomplete"] });
      if (imp.caseId) {
        queryClient.invalidateQueries({ queryKey: [`/api/cases/${imp.caseId}/live-import`] });
      }

      acknowledgeAndClose([imp]);
      toast({
        title: botStillLive ? "Resumed live meeting" : "Continuing video recording",
        description: botStillLive
          ? "Watch the status pill in the bottom-right. Meeting-to-Matter will open when the call ends."
          : "LegalNote is producing (or resuming) your attendance note.",
        duration: 6000,
      });
    } catch (err: any) {
      toast({
        title: "Could not continue",
        description: err?.message || "Please try again from the matter page or dashboard.",
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-video-bot-recovery">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Unprocessed video recording
            {visibleImports.length > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            LegalNote found video call recording
            {visibleImports.length > 1 ? "s" : ""} that still need attention — similar to recovered Quick Record audio.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {visibleImports.map((imp) => (
              <div
                key={imp.importId}
                className="rounded-md border p-3 space-y-3"
                data-testid={`video-bot-recovery-item-${imp.importId}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {imp.caseTitle || imp.meetingTitle || "Video meeting"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(imp.createdAt), { addSuffix: true })}
                      {" · "}
                      {platformLabel(imp.meetingPlatform)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                    {statusLabel(imp)}
                  </Badge>
                </div>

                {imp.status === "failed" && imp.errorMessage && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{imp.errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={actingId === imp.importId}
                    onClick={() => resumeImport(imp)}
                    data-testid={`button-continue-video-import-${imp.importId}`}
                  >
                    {actingId === imp.importId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Continue"
                    )}
                  </Button>
                  {imp.caseId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        acknowledgeAndClose([imp]);
                        setLocation(`/case/${imp.caseId}`);
                      }}
                      data-testid={`button-view-matter-video-import-${imp.importId}`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      View matter
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              acknowledgeAndClose();
              refetch();
            }}
            data-testid="button-video-bot-recovery-later"
          >
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * On app load, check for incomplete video-bot imports and open recovery prompt.
 * Skips while Quick Record recovery is showing, and while a live session is already tracked.
 * Skips imports the user already acknowledged (Continue / View matter / dismiss) for that status.
 */
export function useVideoBotRecovery(enabled: boolean = true) {
  const [showVideoBotRecovery, setShowVideoBotRecovery] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const liveBotSession = useLiveBotSessionOptional();

  useEffect(() => {
    if (!enabled || hasChecked) return;

    const check = async () => {
      try {
        const response = await fetch("/api/recall/imports/incomplete", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []);

        const list = Array.isArray(response) ? (response as IncompleteVideoImport[]) : [];
        const activeId = liveBotSession?.session?.importId;
        const pending = filterUndismissed(list.filter((i) => i.importId !== activeId));

        if (pending.length > 0) {
          setShowVideoBotRecovery(true);
        }
        setHasChecked(true);
      } catch {
        setHasChecked(true);
      }
    };

    // After Quick Record recovery check (~2s) so the two modals don't fight
    const timeout = setTimeout(check, 3500);
    return () => clearTimeout(timeout);
  }, [enabled, hasChecked, liveBotSession?.session?.importId]);

  return {
    showVideoBotRecovery,
    setShowVideoBotRecovery,
    hasChecked,
  };
}
