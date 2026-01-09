import { useEffect, useCallback, useRef } from "react";
import { indexedDBBackup } from "@/lib/indexedDBBackup";

interface UseBeforeUnloadWarningOptions {
  enabled: boolean;
  sessionId: string | null;
  message?: string;
  onEmergencyFlush?: () => Promise<void>;
}

export function useBeforeUnloadWarning({
  enabled,
  sessionId,
  message = "You have an active recording. Are you sure you want to leave? Your recording progress is saved, but you may lose recent audio.",
  onEmergencyFlush,
}: UseBeforeUnloadWarningOptions) {
  const isFlushingRef = useRef(false);

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (!enabled) return;

    event.preventDefault();
    event.returnValue = message;

    if (sessionId && !isFlushingRef.current) {
      isFlushingRef.current = true;

      indexedDBBackup.markSessionInterrupted(sessionId)
        .catch(console.error)
        .finally(() => {
          isFlushingRef.current = false;
        });

      if (onEmergencyFlush) {
        onEmergencyFlush().catch(console.error);
      }
    }

    return message;
  }, [enabled, sessionId, message, onEmergencyFlush]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden' && enabled && sessionId) {
      indexedDBBackup.markSessionInterrupted(sessionId).catch(console.error);
    }
  }, [enabled, sessionId]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, handleBeforeUnload, handleVisibilityChange]);
}
