import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserPreferences } from "@shared/schema";
import {
  Calendar,
  CheckCircle2,
  Loader2,
  Video,
  RefreshCw,
  Sparkles,
} from "lucide-react";

type StepId = "welcome" | "calendar" | "video" | "sync" | "done";

const STEPS: StepId[] = ["welcome", "calendar", "video", "sync", "done"];
const STEP_STORAGE_KEY = "legalnote_integrations_onboarding_step";

function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
}

interface CalendarConnections {
  google: { connected: boolean; email?: string; connectedAt?: string };
  outlook?: { connected: boolean; email?: string; connectedAt?: string };
}

interface RecallStatus {
  configured: boolean;
  connected: boolean;
  connection: {
    status: string;
    connectedAt: string;
    lastSyncAt: string;
  } | null;
}

export default function IntegrationsOnboarding() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasOpened, setHasOpened] = useState(false);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const preferredCalendar = user?.preferredCalendarProvider ?? "google";
  const step = STEPS[stepIndex] ?? "welcome";

  const { data: preferences, isLoading: prefsLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user-preferences"],
    enabled: !authLoading && !!user,
  });

  const { data: connections, refetch: refetchConnections } = useQuery<CalendarConnections>({
    queryKey: ["/api/oauth/connections"],
    enabled: open,
    refetchOnMount: "always",
  });

  const { data: recallStatus } = useQuery<RecallStatus>({
    queryKey: ["/api/recall/status"],
    enabled: open,
  });

  const calendarConnected =
    preferredCalendar === "outlook"
      ? !!connections?.outlook?.connected
      : !!connections?.google.connected;

  const otherCalendarConnected =
    preferredCalendar === "outlook"
      ? !!connections?.google.connected
      : !!connections?.outlook?.connected;

  const anyCalendarConnected = calendarConnected || otherCalendarConnected;
  const videoConnected = !!recallStatus?.connected;

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/user-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ completedIntegrationsOnboarding: true }),
      });
      if (!response.ok) throw new Error("Failed to update preferences");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      sessionStorage.removeItem(STEP_STORAGE_KEY);
      setOpen(false);
    },
  });

  const connectVideoMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/recall/connect") as Promise<{ valid: boolean; message: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recall/status"] });
      if (data.valid) {
        toast({
          title: "Video conferencing connected",
          description: "You can import recordings from Zoom, Teams, and Google Meet.",
        });
        setStepIndex(STEPS.indexOf("sync"));
      } else {
        toast({
          title: "Connection issue",
          description: data.message || "Unable to connect video integration",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect video integration",
        variant: "destructive",
      });
    },
  });

  const syncMeetingsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/scheduled-meetings/sync") as Promise<{
        success: boolean;
        meetings: unknown[];
      }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-meetings"] });
      const count = Array.isArray(data.meetings) ? data.meetings.length : 0;
      toast({
        title: "Calendar synced",
        description:
          count > 0
            ? `Found ${count} upcoming meeting${count === 1 ? "" : "s"} on your calendar.`
            : "No upcoming video meetings found. New ones will appear after you sync again.",
      });
      setStepIndex(STEPS.indexOf("done"));
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message || "Could not sync your calendar meetings",
        variant: "destructive",
      });
    },
  });

  // Open wizard when prefs say it is incomplete — after display name is confirmed
  useEffect(() => {
    if (prefsLoading || authLoading || !preferences || hasOpened) return;
    if (preferences.completedIntegrationsOnboarding === true) return;
    if (!user?.displayNameConfirmedAt) return;

    const saved = sessionStorage.getItem(STEP_STORAGE_KEY);
    if (saved) {
      const idx = STEPS.indexOf(saved as StepId);
      if (idx >= 0) setStepIndex(idx);
    }

    setOpen(true);
    setHasOpened(true);
  }, [prefsLoading, authLoading, preferences, hasOpened, user?.displayNameConfirmedAt]);

  // Persist step so mobile OAuth redirects can resume
  useEffect(() => {
    if (open) {
      sessionStorage.setItem(STEP_STORAGE_KEY, STEPS[stepIndex]);
    }
  }, [open, stepIndex]);

  // Listen for calendar OAuth popup completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "calendar-oauth-callback") return;

      setIsConnectingCalendar(false);
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      refetchConnections();
      queryClient.invalidateQueries({ queryKey: ["/api/oauth/connections"] });

      if (event.data.success) {
        toast({
          title: "Calendar connected",
          description: `Successfully connected ${
            event.data.provider === "google" ? "Google Calendar" : "Outlook Calendar"
          }.`,
        });
        setStepIndex(STEPS.indexOf("video"));
      } else if (event.data.error) {
        toast({
          title: "Calendar connection failed",
          description: String(event.data.error),
          variant: "destructive",
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refetchConnections, toast]);

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const handleRemindLater = () => {
    // Do not mark complete — wizard returns on next login / app load
    sessionStorage.removeItem(STEP_STORAGE_KEY);
    setOpen(false);
  };

  const handleFinish = () => {
    completeMutation.mutate();
  };

  const connectCalendar = async (provider: "google" | "outlook") => {
    setIsConnectingCalendar(true);
    // Resume after calendar on the video step (especially for mobile full-page redirect)
    sessionStorage.setItem(STEP_STORAGE_KEY, "video");

    if (isMobileDevice()) {
      try {
        const response = await fetch(`/api/calendar/auth/${provider}`, {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || "Failed to get authorization URL");
        }
        const { authUrl } = await response.json();
        window.location.href = authUrl;
      } catch (error) {
        setIsConnectingCalendar(false);
        toast({
          title: "Connection error",
          description: error instanceof Error ? error.message : "Failed to start calendar connection",
          variant: "destructive",
        });
      }
      return;
    }

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      "",
      `${provider}-oauth`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    );

    if (!popup) {
      setIsConnectingCalendar(false);
      toast({
        title: "Popup blocked",
        description: "Please allow popups for this site to connect your calendar",
        variant: "destructive",
      });
      return;
    }

    popupRef.current = popup;

    try {
      const response = await fetch(`/api/calendar/auth/${provider}?popup=true`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to get authorization URL");
      }
      const { authUrl } = await response.json();
      popup.location.href = authUrl;

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsConnectingCalendar(false);
          refetchConnections();
        }
      }, 500);
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      setIsConnectingCalendar(false);
      toast({
        title: "Connection error",
        description: error instanceof Error ? error.message : "Failed to start calendar connection",
        variant: "destructive",
      });
    }
  };

  if (prefsLoading || authLoading || !preferences || preferences.completedIntegrationsOnboarding === true) {
    return null;
  }

  if (!user?.displayNameConfirmedAt) {
    return null;
  }

  if (!open) {
    return null;
  }

  const progressValue = ((stepIndex + 1) / STEPS.length) * 100;
  const calendarLabel = preferredCalendar === "outlook" ? "Outlook Calendar" : "Google Calendar";
  const otherProvider = preferredCalendar === "outlook" ? "google" : "outlook";
  const otherLabel = otherProvider === "outlook" ? "Outlook Calendar" : "Google Calendar";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleRemindLater();
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        data-testid="dialog-integrations-onboarding"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            {step === "welcome" && "Welcome to LegalNote"}
            {step === "calendar" && `Connect ${calendarLabel}`}
            {step === "video" && "Connect video conferencing"}
            {step === "sync" && "Sync upcoming meetings"}
            {step === "done" && "You're all set"}
          </DialogTitle>
          <DialogDescription>
            {step === "welcome" &&
              "Connect a few tools so LegalNote can sync deadlines, pull in video meetings, and prepare attendance notes."}
            {step === "calendar" &&
              `You signed in with ${
                preferredCalendar === "outlook" ? "Microsoft" : "Google"
              }. Connect your calendar to sync deadlines and discover upcoming video calls.`}
            {step === "video" &&
              "Enable meeting recording import for Zoom, Microsoft Teams, and Google Meet."}
            {step === "sync" &&
              "Pull upcoming video conferences from your calendar so you can launch recordings from your dashboard."}
            {step === "done" && "Your integrations are ready. You can change them anytime in Settings."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Step {stepIndex + 1} of {STEPS.length}
            </span>
          </div>
          <Progress value={progressValue} className="h-1.5" />
        </div>

        <div className="py-2 min-h-[160px]">
          {step === "welcome" && (
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <Calendar className="h-5 w-5 shrink-0 text-foreground" />
                <span>
                  Connect <strong className="text-foreground">{calendarLabel}</strong> to sync case
                  deadlines and find upcoming meetings.
                </span>
              </li>
              <li className="flex gap-3">
                <Video className="h-5 w-5 shrink-0 text-foreground" />
                <span>
                  Connect your <strong className="text-foreground">video conferencing</strong> so
                  recordings from Zoom, Teams, and Meet can become attendance notes.
                </span>
              </li>
              <li className="flex gap-3">
                <RefreshCw className="h-5 w-5 shrink-0 text-foreground" />
                <span>
                  <strong className="text-foreground">Sync upcoming meetings</strong> from your
                  calendar onto your dashboard.
                </span>
              </li>
            </ul>
          )}

          {step === "calendar" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{calendarLabel}</p>
                    <p className="text-sm text-muted-foreground">
                      {calendarConnected
                        ? connections?.[preferredCalendar]?.email || "Connected"
                        : "Recommended for your account"}
                    </p>
                  </div>
                </div>
                {calendarConnected ? (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => connectCalendar(preferredCalendar)}
                    disabled={isConnectingCalendar}
                    data-testid="button-onboarding-connect-calendar"
                  >
                    {isConnectingCalendar ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                )}
              </div>

              {!calendarConnected && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => connectCalendar(otherProvider)}
                  disabled={isConnectingCalendar}
                  data-testid="button-onboarding-connect-other-calendar"
                >
                  Prefer {otherLabel} instead?
                </button>
              )}

              {otherCalendarConnected && !calendarConnected && (
                <Alert>
                  <AlertDescription>
                    {otherLabel} is already connected. You can continue, or connect {calendarLabel}{" "}
                    as well.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === "video" && (
            <div className="space-y-4">
              {!recallStatus?.configured ? (
                <Alert>
                  <AlertDescription>
                    Video conferencing is not configured for this environment. You can skip this
                    step and ask your administrator to set up the integration.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Video className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Meeting recording import</p>
                      <p className="text-sm text-muted-foreground">Zoom, Teams, and Google Meet</p>
                    </div>
                  </div>
                  {videoConnected ? (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => connectVideoMutation.mutate()}
                      disabled={connectVideoMutation.isPending}
                      data-testid="button-onboarding-connect-video"
                    >
                      {connectVideoMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Zoom</Badge>
                <Badge variant="secondary">Microsoft Teams</Badge>
                <Badge variant="secondary">Google Meet</Badge>
              </div>
            </div>
          )}

          {step === "sync" && (
            <div className="space-y-4">
              {!anyCalendarConnected ? (
                <Alert>
                  <AlertDescription>
                    Connect a calendar first to sync upcoming meetings. You can go back or skip
                    for now.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    LegalNote will look for Zoom, Teams, and Meet links on your calendar and list
                    them on your dashboard.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => syncMeetingsMutation.mutate()}
                    disabled={syncMeetingsMutation.isPending}
                    data-testid="button-onboarding-sync-meetings"
                  >
                    {syncMeetingsMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : syncMeetingsMutation.isSuccess ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Synced — sync again
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync upcoming meetings
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                {anyCalendarConnected ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />
                )}
                <span>Calendar {anyCalendarConnected ? "connected" : "skipped"}</span>
              </div>
              <div className="flex items-center gap-2">
                {videoConnected ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />
                )}
                <span>Video conferencing {videoConnected ? "connected" : "skipped"}</span>
              </div>
              <div className="flex items-center gap-2">
                {syncMeetingsMutation.isSuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />
                )}
                <span>
                  Meeting sync {syncMeetingsMutation.isSuccess ? "completed" : "available anytime"}
                </span>
              </div>
              <p className="pt-2 text-muted-foreground">
                Manage integrations later under Settings → Integrations.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleRemindLater}
            data-testid="button-onboarding-remind-later"
          >
            Remind me later
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 && step !== "done" && (
              <Button variant="outline" onClick={goBack} data-testid="button-onboarding-back">
                Back
              </Button>
            )}
            {step !== "done" ? (
              <Button onClick={goNext} data-testid="button-onboarding-next">
                {step === "welcome" ? "Get started" : "Continue"}
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={completeMutation.isPending}
                data-testid="button-onboarding-finish"
              >
                {completeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Finish setup"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
