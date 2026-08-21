import { CheckCircle2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearch } from "wouter";
import {
  closeCalendarOAuthPopup,
  isCalendarOAuthPopupWindow,
} from "@/lib/calendarOAuthBridge";

export default function CalendarSyncConfirmation() {
  const searchParams = new URLSearchParams(useSearch());
  const provider = searchParams.get("provider") || "calendar";
  const success = searchParams.get("success") === "true";
  const isPopup = isCalendarOAuthPopupWindow() || !!(window.opener && !window.opener.closed);

  const providerName = provider === "google" ? "Google Calendar" : "Outlook Calendar";

  const handleClose = () => {
    if (isPopup) {
      closeCalendarOAuthPopup();
    } else {
      window.location.href = "/";
    }
  };

  if (!success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 sm:p-8 bg-background">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center space-y-2 px-6 sm:px-8 pt-8">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <Calendar className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Calendar Sync Failed</CardTitle>
            <CardDescription>
              There was a problem syncing your deadline to {providerName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6 sm:px-8 pb-8">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              Please try again. If the problem persists, check your calendar connection settings.
            </p>
            <Button
              onClick={handleClose}
              className="w-full"
              data-testid="button-close-sync-confirmation"
            >
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-8 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-2 px-6 sm:px-8 pt-8">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle>Calendar Synced Successfully</CardTitle>
          <CardDescription>
            Your deadline has been added to {providerName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 sm:px-8 pb-8">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">What happens next?</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
              <li>You'll receive reminders based on your priority level</li>
              <li>The event includes all case details and notes</li>
              <li>You can manage the event directly in your calendar</li>
            </ul>
          </div>

          <div className="space-y-2 px-1">
            <p className="text-sm text-center text-muted-foreground">
              {isPopup
                ? "You can now close this window"
                : "Return to your dashboard to continue"}
            </p>
            <Button
              onClick={handleClose}
              className="w-full"
              data-testid="button-close-sync-confirmation"
            >
              {isPopup ? "Close Window" : "Return to Dashboard"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
