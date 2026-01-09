import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, FileAudio, Loader2, Trash2, CheckCircle, AlertCircle, FolderOpen } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { indexedDBBackup, StoredSession } from "@/lib/indexedDBBackup";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

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

interface RecordingRecoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordingRecoveryModal({ open, onOpenChange }: RecordingRecoveryModalProps) {
  const [localSessions, setLocalSessions] = useState<StoredSession[]>([]);
  const [recovering, setRecovering] = useState<string | null>(null);
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
    mutationFn: async (sessionId: string) => {
      // First, try to upload any local chunks that weren't synced to cloud
      try {
        const localChunks = await indexedDBBackup.getChunks(sessionId);
        if (localChunks.length > 0) {
          console.log(`[Recovery] Uploading ${localChunks.length} local chunks for session ${sessionId}`);
          
          for (const chunk of localChunks) {
            try {
              const formData = new FormData();
              formData.append('chunk', chunk.data, `chunk_${chunk.chunkNumber}.webm`);
              formData.append('chunkNumber', chunk.chunkNumber.toString());
              
              // Use the recovery-chunk endpoint which bypasses in-memory session requirement
              const response = await fetch(`/api/audio/recovery-chunk/${sessionId}`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
              });
              
              if (response.ok) {
                console.log(`[Recovery] Uploaded local chunk ${chunk.chunkNumber}`);
              } else {
                console.warn(`[Recovery] Failed to upload chunk ${chunk.chunkNumber}:`, await response.text());
              }
            } catch (e) {
              console.warn(`[Recovery] Failed to upload local chunk ${chunk.chunkNumber}:`, e);
            }
          }
        }
      } catch (e) {
        console.warn('[Recovery] Failed to upload local chunks:', e);
      }

      // Now trigger server-side recovery - use fetch directly to handle 400 responses gracefully
      const response = await fetch(`/api/audio/recover-session/${sessionId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      const result: RecoveryResult = await response.json();
      return result;
    },
    onSuccess: async (result, sessionId) => {
      if (result.success && result.caseId) {
        // Clean up local storage only on successful recovery
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
        
        // Close modal and redirect to the recovered case
        onOpenChange(false);
        setLocation(`/case/${result.caseId}`);
      } else {
        // Recovery not complete yet - show informative message, don't clear session
        toast({
          title: "Recovery pending",
          description: result.message || "Some audio data is still syncing. Please try again in a moment.",
        });
        // Refresh the session list
        refetch();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Recovery failed",
        description: error.message || "Could not recover the recording. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRecover = async (sessionId: string) => {
    setRecovering(sessionId);
    try {
      await recoverMutation.mutateAsync(sessionId);
    } finally {
      setRecovering(null);
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Recording Interrupted
          </DialogTitle>
          <DialogDescription>
            We detected incomplete recording sessions that were interrupted unexpectedly. 
            Click "Recover" to create a case from the saved audio chunks.
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
                className="flex items-start justify-between p-4 rounded-lg border bg-card"
                data-testid={`recovery-session-${session.id}`}
              >
                <div className="flex items-start gap-3">
                  <FileAudio className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {session.caseName || session.clientName || 'Untitled Recording'}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
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
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDiscard(session.id)}
                    disabled={discardMutation.isPending || recovering === session.id}
                    data-testid={`discard-session-${session.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleRecover(session.id)}
                    disabled={recovering !== null}
                    data-testid={`recover-session-${session.id}`}
                  >
                    {recovering === session.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        Recovering...
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useRecordingRecovery() {
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (hasChecked) return;

    const checkForIncompleteSessions = async () => {
      try {
        const [localSessions, response] = await Promise.all([
          indexedDBBackup.getInterruptedSessions(),
          fetch('/api/audio/incomplete-sessions', { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .catch(() => []),
        ]);

        const hasIncomplete = localSessions.length > 0 || response.length > 0;
        
        if (hasIncomplete) {
          setShowRecoveryModal(true);
        }
        
        setHasChecked(true);
      } catch (error) {
        console.error('Failed to check for incomplete sessions:', error);
        setHasChecked(true);
      }
    };

    const timeout = setTimeout(checkForIncompleteSessions, 2000);
    return () => clearTimeout(timeout);
  }, [hasChecked]);

  return {
    showRecoveryModal,
    setShowRecoveryModal,
    hasChecked,
  };
}
