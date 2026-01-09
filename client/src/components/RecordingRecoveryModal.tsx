import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, FileAudio, Loader2, Trash2, CheckCircle } from "lucide-react";
import { indexedDBBackup, StoredSession } from "@/lib/indexedDBBackup";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

interface RecordingRecoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecover?: (sessionId: string) => void;
}

export function RecordingRecoveryModal({ open, onOpenChange, onRecover }: RecordingRecoveryModalProps) {
  const [localSessions, setLocalSessions] = useState<StoredSession[]>([]);
  const [recovering, setRecovering] = useState<string | null>(null);

  const { data: serverSessions = [], isLoading } = useQuery<IncompleteSession[]>({
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
      await fetch(`/api/audio/chunk-session/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => {});
    },
    onSuccess: (_, sessionId) => {
      setLocalSessions(prev => prev.filter(s => s.id !== sessionId));
      queryClient.invalidateQueries({ queryKey: ["/api/audio/incomplete-sessions"] });
    },
  });

  const handleRecover = async (session: IncompleteSession | StoredSession) => {
    setRecovering(session.id);
    
    try {
      if (onRecover) {
        onRecover(session.id);
      }
      
      await indexedDBBackup.markSessionRecovered(session.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Recovery failed:', error);
    } finally {
      setRecovering(null);
    }
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
            You can recover these recordings or discard them.
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
                      <span>{session.chunksReceived} chunks</span>
                      {session.totalBytes > 0 && (
                        <span>{formatBytes(session.totalBytes)}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last activity: {formatDistanceToNow(new Date(session.lastActivityAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => discardMutation.mutate(session.id)}
                    disabled={discardMutation.isPending || recovering === session.id}
                    data-testid={`discard-session-${session.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleRecover(session)}
                    disabled={recovering !== null}
                    data-testid={`recover-session-${session.id}`}
                  >
                    {recovering === session.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : null}
                    Recover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

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
