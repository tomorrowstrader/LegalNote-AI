import { useEffect } from "react";
import { useLocation } from "wouter";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if this is a popup window
    if (!window.opener || window.opener.closed) {
      // Not a popup, redirect to settings
      setLocation('/settings');
      return;
    }

    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const calendarConnected = urlParams.get('calendar_connected');
    const calendarError = urlParams.get('calendar_error');

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
  }, [setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Completing connection...</h2>
        <p className="text-muted-foreground">This window will close automatically</p>
      </div>
    </div>
  );
}
