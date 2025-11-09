import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    console.log('[OAuth Callback] Component mounted');
    console.log('[OAuth Callback] Current URL:', window.location.href);
    
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const calendarConnected = urlParams.get('calendar_connected');
    const calendarError = urlParams.get('calendar_error');
    const syncSuccess = urlParams.get('sync_success');
    const syncError = urlParams.get('sync_error');
    const caseId = urlParams.get('case_id');
    
    console.log('[OAuth Callback] Parsed params:', {
      calendarConnected,
      calendarError,
      syncSuccess,
      syncError,
      caseId,
      isPopup: !!(window.opener && !window.opener.closed)
    });

    // Check if this is a popup window
    if (window.opener && !window.opener.closed) {
      // POPUP FLOW (Desktop)
      if (calendarConnected) {
        // Send success message to parent window (includes sync status)
        window.opener.postMessage({
          source: 'calendar-oauth-callback',
          success: true,
          provider: calendarConnected,
          syncSuccess: syncSuccess === 'true',
          syncError,
          caseId,
        }, window.location.origin);
      } else if (calendarError) {
        // Send error message to parent window
        window.opener.postMessage({
          source: 'calendar-oauth-callback',
          success: false,
          error: calendarError,
        }, window.location.origin);
      }

      // Close popup after brief delay to ensure message is received
      setTimeout(() => {
        window.close();
      }, 100);
      
      return;
    }

    // FULL-PAGE REDIRECT FLOW (Mobile)
    console.log('[OAuth Callback] Full-page redirect flow');
    
    // Determine where to redirect
    let redirectPath = '/';
    
    // If auto-sync was attempted, redirect to the case page
    if (caseId && (syncSuccess || syncError)) {
      redirectPath = `/case/${caseId}`;
      console.log('[OAuth Callback] Redirecting to case page:', redirectPath);
    } else if (calendarConnected || calendarError) {
      // If just connecting calendar (no auto-sync), go to settings
      redirectPath = '/settings';
      console.log('[OAuth Callback] Redirecting to settings:', redirectPath);
    } else {
      // Fallback to dashboard
      redirectPath = '/';
      console.log('[OAuth Callback] Fallback redirect to dashboard');
    }
    
    // Show appropriate toast based on sync status
    if (syncSuccess === 'true' && calendarConnected) {
      console.log('[OAuth Callback] Showing success toast for auto-sync');
      toast({
        title: "Calendar Synced!",
        description: `Connected ${calendarConnected === 'google' ? 'Google Calendar' : 'Outlook'} and synced deadline automatically.`,
        duration: 6000,
      });
    } else if (syncError && calendarConnected) {
      // Connected but sync failed - user can retry manually
      console.log('[OAuth Callback] Showing partial success toast (connected but sync failed)');
      const errorMessages: Record<string, string> = {
        case_not_found: "Case not found. Please try syncing manually.",
        event_creation_failed: "Calendar event creation failed. Please try syncing manually.",
        unknown: "Auto-sync failed. Please try syncing manually.",
      };
      
      toast({
        title: "Calendar Connected",
        description: errorMessages[syncError] || "Connected successfully, but auto-sync failed. Please sync manually.",
        duration: 8000,
      });
    } else if (calendarConnected) {
      // Just connected, no sync attempt
      console.log('[OAuth Callback] Showing connection success toast');
      toast({
        title: "Calendar Connected",
        description: `Successfully connected ${calendarConnected === 'google' ? 'Google Calendar' : 'Outlook'}. You can now sync case deadlines.`,
        duration: 5000,
      });
    } else if (calendarError) {
      console.log('[OAuth Callback] Showing error toast:', calendarError);
      toast({
        title: "Connection Failed",
        description: calendarError,
        variant: "destructive",
      });
    }
    
    console.log('[OAuth Callback] Navigating to:', redirectPath);
    
    // Use wouter navigation to stay within SPA (eliminates 404 flash)
    setTimeout(() => {
      setLocation(redirectPath, { replace: true });
    }, 200);
  }, [setLocation, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Completing connection...</h2>
        <p className="text-muted-foreground">This window will close automatically</p>
      </div>
    </div>
  );
}
