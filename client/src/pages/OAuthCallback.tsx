import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const calendarConnected = urlParams.get('calendar_connected');
    const calendarError = urlParams.get('calendar_error');

    // Check if this is a popup window
    if (window.opener && !window.opener.closed) {
      // POPUP FLOW (Desktop)
      if (calendarConnected) {
        // Send success message to parent window
        window.opener.postMessage({
          source: 'calendar-oauth-callback',
          success: true,
          provider: calendarConnected,
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
    // Clear any saved context
    sessionStorage.removeItem('calendar-oauth-context');
    sessionStorage.removeItem('calendar-auto-sync');
    
    // Show success/error toast and redirect to settings
    if (calendarConnected) {
      toast({
        title: "Calendar Connected",
        description: `Successfully connected ${calendarConnected === 'google' ? 'Google Calendar' : 'Outlook'}. You can now sync case deadlines.`,
        duration: 5000,
      });
    } else if (calendarError) {
      toast({
        title: "Connection Failed",
        description: calendarError,
        variant: "destructive",
      });
    }
    
    setLocation('/settings');
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
