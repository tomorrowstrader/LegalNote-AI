import { useEffect, useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Session Timeout Warning Component
 * 
 * Monitors user session and displays a warning 5 minutes before timeout.
 * Session timeout is 4 hours (configured in server session settings).
 * 
 * Features:
 * - Detects user activity (clicks, keyboard, mouse movement)
 * - Warns 5 minutes before session expires
 * - Allows user to extend session
 * - Auto-refreshes session on activity
 */

const SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes before timeout
const ACTIVITY_THROTTLE_MS = 30 * 1000; // Throttle activity checks to every 30s
const RECORDING_EXTENSION_INTERVAL_MS = 60 * 1000; // Extend session every 60s during recording

export function SessionTimeoutWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isRecording, setIsRecording] = useState(false);

  // Update last activity timestamp (throttled)
  const updateActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(prev => {
      // Only update if it's been more than ACTIVITY_THROTTLE_MS since last update
      if (now - prev > ACTIVITY_THROTTLE_MS) {
        // Refresh session by making a lightweight API call
        fetch('/api/ping', { method: 'POST' })
          .then(() => {
            // Session successfully refreshed - update timestamp to reset countdown
            setLastActivity(Date.now());
          })
          .catch(() => {
            // Silently fail - user might be offline
          });
        return now;
      }
      return prev;
    });
  }, []);

  // Set up activity listeners
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  // Listen for recording state changes via custom event
  useEffect(() => {
    const handleRecordingStart = () => {
      setIsRecording(true);
      updateActivity(); // Immediately extend session when recording starts
    };
    
    const handleRecordingStop = () => {
      setIsRecording(false);
    };

    window.addEventListener('recording-started', handleRecordingStart);
    window.addEventListener('recording-stopped', handleRecordingStop);

    return () => {
      window.removeEventListener('recording-started', handleRecordingStart);
      window.removeEventListener('recording-stopped', handleRecordingStop);
    };
  }, [updateActivity]);

  // Auto-extend session during recording
  useEffect(() => {
    if (!isRecording) return;

    const intervalId = setInterval(() => {
      fetch('/api/ping', { method: 'POST' })
        .then(() => {
          setLastActivity(Date.now());
        })
        .catch(() => {
          // Silently fail - user might be offline
        });
    }, RECORDING_EXTENSION_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isRecording]);

  // Check session timeout status
  useEffect(() => {
    const checkTimeout = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      const timeUntilTimeout = SESSION_DURATION_MS - timeSinceActivity;

      setTimeRemaining(timeUntilTimeout);

      // Show warning if within WARNING_BEFORE_MS of timeout (skip during recording)
      if (timeUntilTimeout <= WARNING_BEFORE_MS && timeUntilTimeout > 0 && !isRecording) {
        setShowWarning(true);
      }

      // Session expired (skip redirect during recording to avoid data loss)
      if (timeUntilTimeout <= 0 && !isRecording) {
        window.location.href = '/login?timeout=true';
      }
    }, 1000); // Check every second

    return () => clearInterval(checkTimeout);
  }, [lastActivity, isRecording]);

  // Handle extend session
  const handleExtendSession = () => {
    updateActivity();
    setShowWarning(false);
  };

  // Format time remaining
  const formatTimeRemaining = () => {
    if (!timeRemaining) return '0:00';
    const minutes = Math.floor(timeRemaining / (60 * 1000));
    const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent data-testid="dialog-session-timeout-warning">
        <AlertDialogHeader>
          <AlertDialogTitle>Session Timeout Warning</AlertDialogTitle>
          <AlertDialogDescription>
            Your session will expire in <strong>{formatTimeRemaining()}</strong> due to inactivity.
            You'll be automatically logged out to protect your data.
            <br /><br />
            Click below to stay logged in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={handleExtendSession}
            data-testid="button-extend-session"
          >
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
