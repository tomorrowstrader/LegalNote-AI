import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import {
  closeCalendarOAuthPopup,
  isCalendarOAuthPopupWindow,
  publishCalendarOAuthResult,
} from "@/lib/calendarOAuthBridge";

function resolveCalendarConnected(urlParams: URLSearchParams): string | null {
  const calendarConnected = urlParams.get("calendar_connected");
  if (calendarConnected) return calendarConnected;
  // Legacy Outlook redirect param (pre-fix)
  if (urlParams.get("outlook_connected") === "true") return "outlook";
  return null;
}

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPopupConfirmation, setShowPopupConfirmation] = useState(false);
  const [popupCloseFailed, setPopupCloseFailed] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const calendarConnected = resolveCalendarConnected(urlParams);
    const calendarError = urlParams.get("calendar_error");
    const syncSuccess = urlParams.get("sync_success");
    const syncError = urlParams.get("sync_error");
    const caseId = urlParams.get("case_id");
    // Prefer explicit return-url flag; fall back to window.name / session mark
    // (opener is often null after Microsoft COOP).
    const isPopup =
      urlParams.get("popup") === "1" ||
      isCalendarOAuthPopupWindow() ||
      !!(window.opener && !window.opener.closed);

    if (calendarConnected || calendarError) {
      queryClient.invalidateQueries({ queryKey: ["/api/oauth/connections"] });
    }

    if (isPopup) {
      if (calendarConnected) {
        publishCalendarOAuthResult({
          success: true,
          provider: calendarConnected,
          syncSuccess: syncSuccess === "true",
          syncError,
          caseId,
        });
      } else if (calendarError) {
        publishCalendarOAuthResult({
          success: false,
          error: calendarError,
        });
      }

      // Give the parent a moment to receive BroadcastChannel / postMessage, then close.
      const closeTimer = window.setTimeout(() => {
        closeCalendarOAuthPopup();
        // If the browser blocked window.close(), show a minimal confirmation.
        window.setTimeout(() => {
          if (!window.closed) {
            setPopupCloseFailed(true);
            setShowPopupConfirmation(true);
          }
        }, 150);
      }, 250);

      return () => window.clearTimeout(closeTimer);
    }

    // FULL-PAGE REDIRECT FLOW (Mobile / Settings)
    let redirectPath = "/";

    if (caseId && (syncSuccess || syncError)) {
      redirectPath = `/calendar-sync-confirmation?provider=${calendarConnected}&success=${syncSuccess === "true"}`;
    } else if (calendarConnected || calendarError) {
      redirectPath = "/settings?tab=integrations";
    } else {
      redirectPath = "/";
    }

    if (calendarConnected && !syncSuccess && !syncError) {
      toast({
        title: "Calendar Connected",
        description: `Successfully connected ${
          calendarConnected === "google" ? "Google Calendar" : "Outlook Calendar"
        }. You can now sync case deadlines and launch upcoming video conference meetings from your dashboard.`,
        duration: 5000,
      });
    } else if (calendarError) {
      toast({
        title: "Connection Failed",
        description: calendarError,
        variant: "destructive",
      });
    }

    const navTimer = window.setTimeout(() => {
      setLocation(redirectPath, { replace: true });
    }, 200);

    return () => window.clearTimeout(navTimer);
  }, [setLocation, toast]);

  if (showPopupConfirmation) {
    const urlParams = new URLSearchParams(window.location.search);
    const syncSuccess = urlParams.get("sync_success") === "true";
    const calendarConnected = resolveCalendarConnected(urlParams);
    const calendarError = urlParams.get("calendar_error");

    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="mx-auto w-full max-w-md space-y-5 text-center px-2">
          <div className="flex justify-center">
            <CheckCircle2
              className={`h-16 w-16 ${calendarError ? "text-destructive" : "text-green-600"}`}
            />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight px-1">
            {calendarError
              ? "Connection Failed"
              : syncSuccess
                ? "Deadline Added to Calendar!"
                : "Calendar Connected!"}
          </h2>
          <p className="text-muted-foreground px-1 leading-relaxed">
            {calendarError
              ? String(calendarError)
              : syncSuccess
                ? `Your deadline has been successfully added to your ${
                    calendarConnected === "google" ? "Google Calendar" : "Outlook calendar"
                  }.`
                : `Successfully connected ${
                    calendarConnected === "google" ? "Google Calendar" : "Outlook Calendar"
                  }. You can return to LegalNote and continue setup.`}
          </p>
          {popupCloseFailed && (
            <p className="text-sm text-muted-foreground px-1">
              This window could not close automatically. You can close it now.
            </p>
          )}
          <Button
            onClick={() => closeCalendarOAuthPopup()}
            className="mt-2"
            data-testid="button-close-popup"
          >
            Close Window
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="mx-auto max-w-md space-y-2 px-2 text-center">
        <h2 className="text-lg font-semibold">Completing connection...</h2>
        <p className="text-muted-foreground">Please wait...</p>
      </div>
    </div>
  );
}
