import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPopupConfirmation, setShowPopupConfirmation] = useState(false);

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

      // Redirect to confirmation page for calendar sync
      if (syncSuccess || syncError) {
        const confirmationUrl = `/calendar-sync-confirmation?provider=${calendarConnected}&success=${syncSuccess === 'true'}`;
        setLocation(confirmationUrl, { replace: true });
      } else {
        // Just calendar connection, show old confirmation
        setShowPopupConfirmation(true);
      }
      
      return;
    }

    // FULL-PAGE REDIRECT FLOW (Mobile)
    console.log('[OAuth Callback] Full-page redirect flow');
    
    // Determine where to redirect
    let redirectPath = '/';
    
    // If auto-sync was attempted, redirect to confirmation page
    if (caseId && (syncSuccess || syncError)) {
      redirectPath = `/calendar-sync-confirmation?provider=${calendarConnected}&success=${syncSuccess === 'true'}`;
      console.log('[OAuth Callback] Redirecting to confirmation page:', redirectPath);
    } else if (calendarConnected || calendarError) {
      // If just connecting calendar (no auto-sync), go to settings
      redirectPath = '/settings';
      console.log('[OAuth Callback] Redirecting to settings:', redirectPath);
    } else {
      // Fallback to dashboard
      redirectPath = '/';
      console.log('[OAuth Callback] Fallback redirect to dashboard');
    }
    
    // Show appropriate toast based on sync status (only for non-sync flows)
    if (calendarConnected && !syncSuccess && !syncError) {
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

  // Popup confirmation page (desktop flow)
  if (showPopupConfirmation) {
    const urlParams = new URLSearchParams(window.location.search);
    const syncSuccess = urlParams.get('sync_success') === 'true';
    const calendarConnected = urlParams.get('calendar_connected');
    
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-center max-w-md space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="w-16 h-16 text-green-600" />
          </div>
          <h2 className="text-2xl font-semibold">
            {syncSuccess ? "Deadline Added to Calendar!" : "Calendar Connected!"}
          </h2>
          <p className="text-muted-foreground">
            {syncSuccess 
              ? `Your deadline has been successfully added to your ${calendarConnected === 'google' ? 'Google Calendar' : 'Outlook calendar'}.`
              : `Successfully connected ${calendarConnected === 'google' ? 'Google Calendar' : 'Outlook'}. You can now sync case deadlines.`
            }
          </p>
          <Button 
            onClick={() => window.close()}
            className="mt-4"
            data-testid="button-close-popup"
          >
            Close Window
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Completing connection...</h2>
        <p className="text-muted-foreground">Please wait...</p>
      </div>
    </div>
  );
}
