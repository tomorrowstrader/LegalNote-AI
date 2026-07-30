import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Clock, FileAudio, Loader2, Trash2, CheckCircle, AlertCircle, FolderOpen } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { indexedDBBackup, StoredSession } from "@/lib/indexedDBBackup";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

function friendlyRecoveryError(message: string | undefined): string {
  if (!message) return "Could not recover the recording. Please try again.";
  if (/insert into|values \(|returning "/i.test(message)) {
    return "Could not create the recovered case. Please try again.";
  }
  return message.length > 180 ? `${message.slice(0, 180)}…` : message;
}

interface IncompleteSession {
  id: string;
  caseId: string | null;
  caseName: string | null;
  clientName: string | null;
  status: string;
  chunksReceived: number;
  totalBytes: number;
  startedAt: string;
  lastActivityAt: string;
  durationSeconds: number;
}

interface RecoveryResult {
  success: boolean;
  caseId?: string;
  audioRecordingId?: string;
  durationSeconds?: number;
  hasConsent?: boolean;
  message: string;
}

interface Recoverability {
  recoverable: boolean;
  chunkCount: number;
  missingIndices: number[];
  totalBytes: number;
  status: string | null;
}

interface RecordingRecoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function backfillLocalChunks(
  sessionId: string,
  serverChunksReceived: number,
  onProgress?: (uploaded: number, total: number) => void,
): Promise<void> {
  // Prefer pending (not yet marked uploaded). If server has nothing, send all local chunks.
  const localChunks =
    serverChunksReceived <= 0
      ? await indexedDBBackup.getSessionChunks(sessionId)
      : await indexedDBBackup.getPendingChunks(sessionId);

  if (localChunks.length === 0) return;

  console.log(
    `[Recovery] Uploading ${localChunks.length} local chunks for session ${sessionId} (server had ${serverChunksReceived})`,
  );

  let uploaded = 0;
  for (const chunk of localChunks) {
    uploaded += 1;
    onProgress?.(uploaded, localChunks.length);
    try {
      const formData = new FormData();
      formData.append("chunk", chunk.data, `chunk_${chunk.chunkNumber}.webm`);
      formData.append("chunkNumber", chunk.chunkNumber.toString());

      const response = await fetch(`/api/audio/recovery-chunk/${sessionId}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        console.warn(`[Recovery] Failed to upload chunk ${chunk.chunkNumber}:`, await response.text());
      } else {
        await indexedDBBackup.markChunkUploaded(sessionId, chunk.chunkNumber).catch(() => {});
      }
    } catch (e) {
      console.warn(`[Recovery] Failed to upload local chunk ${chunk.chunkNumber}:`, e);
    }
  }
}

async function recoverSessionRequest(sessionId: string): Promise<RecoveryResult> {
  const response = await fetch(`/api/audio/recover-session/${sessionId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const text = await response.text();
  let result: RecoveryResult;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 160) || `Recovery failed (${response.status})`);
  }
  if (!response.ok && !result.message) {
    throw new Error(`Recovery failed (${response.status})`);
  }
  if (!result.success) {
    throw new Error(friendlyRecoveryError(result.message));
  }
  return result;
}

export function RecordingRecoveryModal({ open, onOpenChange }: RecordingRecoveryModalProps) {
  const [localSessions, setLocalSessions] = useState<StoredSession[]>([]);
  const [recovering, setRecovering] = useState<string | null>(null);
  const [recoverStatus, setRecoverStatus] = useState<string | null>(null);
  const [recoverProgress, setRecoverProgress] = useState(0);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: serverSessions = [], isLoading, refetch } = useQuery<IncompleteSession[]>({
    queryKey: ["/api/audio/incomplete-sessions"],
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      indexedDBBackup.getInterruptedSessions().then(sessions => {
        setLocalSessions(sessions);
      });
    }
  }, [open]);

  const discardMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await indexedDBBackup.clearSession(sessionId);
      await fetch(`/api/audio/recover-session/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => {});
    },
    onSuccess: (_, sessionId) => {
      setLocalSessions(prev => prev.filter(s => s.id !== sessionId));
      queryClient.invalidateQueries({ queryKey: ["/api/audio/incomplete-sessions"] });
      toast({
        title: "Session discarded",
        description: "The interrupted recording has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to discard",
        description: "Could not remove the session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const recoverMutation = useMutation({
    mutationFn: async ({
      sessionId,
      serverChunksReceived,
    }: {
      sessionId: string;
      serverChunksReceived: number;
    }) => {
      if (serverChunksReceived <= 0) {
        try {
          await backfillLocalChunks(sessionId, 0, (uploaded, total) => {
            const pct = Math.min(70, Math.round((uploaded / total) * 70));
            setRecoverProgress(pct);
            setRecoverStatus(`Uploading chunk ${uploaded} of ${total}…`);
          });
        } catch (e) {
          console.warn('[Recovery] Failed to upload local chunks:', e);
        }
      } else {
        // Server has some chunks — still push any IndexedDB-only pending gaps
        try {
          await backfillLocalChunks(sessionId, serverChunksReceived, (uploaded, total) => {
            const pct = Math.min(70, Math.round((uploaded / total) * 70));
            setRecoverProgress(pct);
            setRecoverStatus(`Uploading pending chunk ${uploaded} of ${total}…`);
          });
        } catch (e) {
          console.warn('[Recovery] Failed to backfill pending chunks:', e);
        }
      }

      setRecoverStatus("Assembling recording…");
      setRecoverProgress((prev) => Math.max(prev, 72));

      const result = await recoverSessionRequest(sessionId);
      setRecoverProgress(100);
      setRecoverStatus("Recovery complete");
      return result;
    },
    onSuccess: async (result, { sessionId }) => {
      if (result.success && result.caseId) {
        await indexedDBBackup.clearSession(sessionId);
        setLocalSessions(prev => prev.filter(s => s.id !== sessionId));
        queryClient.invalidateQueries({ queryKey: ["/api/audio/incomplete-sessions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/cases"] });

        toast({
          title: "Recording recovered",
          description: result.hasConsent 
            ? `Your ${Math.floor((result.durationSeconds || 0) / 60)} minute recording has been saved.`
            : "Recording saved. Note: Consent was not confirmed during this recording.",
          action: (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setLocation(`/case/${result.caseId}`)}
              className="gap-1"
            >
              <FolderOpen className="w-4 h-4" />
              View Case
            </Button>
          ),
        });
        
        onOpenChange(false);
        setLocation(`/case/${result.caseId}`);
      } else {
        toast({
          title: "Recovery pending",
          description: friendlyRecoveryError(result.message) || "Some audio data is still syncing. Please try again in a moment.",
        });
        refetch();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Recovery failed",
        description: friendlyRecoveryError(error.message),
        variant: "destructive",
      });
    },
  });

  const handleRecover = async (
    sessionId: string,
    serverChunksReceived: number,
    totalBytes: number,
  ) => {
    if (recovering) return;
    setRecovering(sessionId);
    setRecoverProgress(5);
    setRecoverStatus(
      serverChunksReceived > 0
        ? "Downloading & assembling audio…"
        : "Preparing local audio…",
    );

    const estimateMs = Math.max(
      5000,
      Math.min(60000, serverChunksReceived * 120 + Math.ceil(totalBytes / 2500)),
    );
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(1, elapsed / estimateMs);
      const eased = 8 + Math.round(82 * (1 - Math.pow(1 - ratio, 1.6)));
      setRecoverProgress((prev) => Math.max(prev, Math.min(90, eased)));
      if (ratio < 0.45) {
        setRecoverStatus("Downloading & assembling audio…");
      } else if (ratio < 0.8) {
        setRecoverStatus("Creating matter file…");
      } else {
        setRecoverStatus("Almost done…");
      }
    }, 250);

    try {
      await recoverMutation.mutateAsync({ sessionId, serverChunksReceived });
    } finally {
      window.clearInterval(tick);
      setRecovering(null);
      setRecoverStatus(null);
      setRecoverProgress(0);
    }
  };

  const handleDiscard = async (sessionId: string) => {
    discardMutation.mutate(sessionId);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const allSessions = [
    ...serverSessions.map(s => ({ ...s, source: 'server' as const })),
    ...localSessions
      .filter(ls => !serverSessions.some(ss => ss.id === ls.id))
      .map(s => ({
        id: s.id,
        caseId: s.caseId || null,
        caseName: s.caseName || null,
        clientName: s.clientName || null,
        status: s.status,
        chunksReceived: s.chunksStored,
        totalBytes: 0,
        startedAt: s.startedAt.toISOString(),
        lastActivityAt: s.lastActivityAt.toISOString(),
        durationSeconds: s.chunksStored * 10,
        source: 'local' as const,
      })),
  ];

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Recording Interrupted
          </DialogTitle>
          <DialogDescription>
            We detected incomplete recording sessions that were interrupted unexpectedly. 
            Tap Recover to create a case from the saved audio chunks.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : allSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="w-8 h-8 mb-2" />
            <p>No incomplete recordings found</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {allSessions.map(session => (
              <div
                key={session.id}
                className="flex flex-col gap-3 p-4 rounded-lg border bg-card"
                data-testid={`recovery-session-${session.id}`}
              >
                <div className="flex items-start gap-3">
                  <FileAudio className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {session.caseName || session.clientName || 'Untitled Recording'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(session.durationSeconds)}
                      </span>
                      <span>{session.chunksReceived} chunks saved</span>
                      {session.totalBytes > 0 && (
                        <span>{formatBytes(session.totalBytes)}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last activity: {formatDistanceToNow(new Date(session.lastActivityAt), { addSuffix: true })}
                    </p>
                    {session.source === 'local' && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Saved locally on this device
                      </p>
                    )}
                    {recovering === session.id && (
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-primary flex items-center gap-1.5 min-w-0">
                            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                            <span className="truncate">{recoverStatus || "Working…"}</span>
                          </span>
                          <span className="tabular-nums text-muted-foreground shrink-0">
                            {recoverProgress}%
                          </span>
                        </div>
                        <Progress value={recoverProgress} className="h-2" data-testid="recovery-progress" />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDiscard(session.id);
                    }}
                    disabled={discardMutation.isPending || recovering === session.id}
                    data-testid={`discard-session-${session.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 min-h-10"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRecover(
                        session.id,
                        session.source === 'server' ? session.chunksReceived : 0,
                        session.totalBytes || session.chunksReceived * 250_000,
                      );
                    }}
                    disabled={recovering !== null}
                    data-testid={`recover-session-${session.id}`}
                  >
                    {recovering === session.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        Recovering…
                      </>
                    ) : (
                      'Recover'
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Alert className="bg-muted/50">
          <AlertDescription className="text-xs text-muted-foreground">
            Recovered recordings are saved as draft cases. You can add client details and process them normally.
            Audio is protected by our 7-day retention policy after recovery.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={recovering !== null}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewCaseToastAction({ caseId }: { caseId: string }) {
  const [, setLocation] = useLocation();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLocation(`/case/${caseId}`)}
      className="gap-1"
    >
      <FolderOpen className="w-4 h-4" />
      View Case
    </Button>
  );
}

export function useRecordingRecovery(enabled: boolean = true) {
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const autoRecoveringRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!enabled || hasChecked) return;

    const checkForIncompleteSessions = async () => {
      try {
        const [localSessions, serverSessions] = await Promise.all([
          indexedDBBackup.getInterruptedSessions(),
          fetch('/api/audio/incomplete-sessions', { credentials: 'include' })
            .then(r => (r.ok ? r.json() : []) as Promise<IncompleteSession[]>)
            .catch(() => [] as IncompleteSession[]),
        ]);

        const needsManualIds = new Set<string>();
        let autoRecovered = 0;

        // Option A: auto-recover server sessions with contiguous durable chunks
        if (!autoRecoveringRef.current) {
          autoRecoveringRef.current = true;
          for (const session of serverSessions) {
            if (session.chunksReceived <= 0) {
              needsManualIds.add(session.id);
              continue;
            }

            try {
              // Push any IndexedDB-only pending chunks before deciding auto-recover
              const pendingLocal = await indexedDBBackup.getPendingChunks(session.id);
              if (pendingLocal.length > 0) {
                await backfillLocalChunks(session.id, session.chunksReceived);
              }

              const recoverability = await fetch(
                `/api/audio/incomplete-sessions/${session.id}/recoverability`,
                { credentials: 'include' },
              ).then(r => (r.ok ? r.json() : null) as Promise<Recoverability | null>);

              if (!recoverability?.recoverable) {
                needsManualIds.add(session.id);
                continue;
              }

              const result = await recoverSessionRequest(session.id);
              if (result.success && result.caseId) {
                await indexedDBBackup.clearSession(session.id).catch(() => {});
                autoRecovered += 1;
                toast({
                  title: "Recording recovered",
                  description: result.hasConsent
                    ? `Your interrupted recording (~${Math.floor((result.durationSeconds || 0) / 60)} min) was restored automatically.`
                    : "Interrupted recording restored. Note: Consent was not confirmed during this recording.",
                  action: <ViewCaseToastAction caseId={result.caseId} />,
                });
              } else {
                needsManualIds.add(session.id);
              }
            } catch (err) {
              console.warn(`[Recovery] Auto-recover failed for ${session.id}:`, err);
              needsManualIds.add(session.id);
            }
          }
          autoRecoveringRef.current = false;
        }

        // Local-only sessions, or server sessions that need backfill / have gaps
        const unresolvedServer = serverSessions.filter((s) => needsManualIds.has(s.id));
        const unresolvedLocal = localSessions.filter((ls) => {
          const matchedServer = serverSessions.find((ss) => ss.id === ls.id);
          if (!matchedServer) return true; // local-only
          return needsManualIds.has(ls.id); // server still needs manual help
        });

        if (unresolvedServer.length > 0 || unresolvedLocal.length > 0) {
          setShowRecoveryModal(true);
        }

        if (autoRecovered > 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/audio/incomplete-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
        }

        setHasChecked(true);
      } catch (error) {
        console.error('Failed to check for incomplete sessions:', error);
        setHasChecked(true);
      }
    };

    const timeout = setTimeout(checkForIncompleteSessions, 2000);
    return () => clearTimeout(timeout);
  }, [enabled, hasChecked, toast]);

  return {
    showRecoveryModal,
    setShowRecoveryModal,
    hasChecked,
  };
}
