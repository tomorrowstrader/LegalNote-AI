import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step, Styles } from "react-joyride";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import type { UserPreferences } from "@shared/schema";

interface OnboardingTourProps {
  restartTrigger?: number;
}

export default function OnboardingTour({ restartTrigger = 0 }: OnboardingTourProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [run, setRun] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Fetch user preferences to check onboarding completion
  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user-preferences"],
    enabled: !authLoading && !!user,
  });

  // Start the tour when preferences load and onboarding is not complete
  useEffect(() => {
    if (!isLoading && !authLoading && preferences && !hasStarted) {
      if (!preferences.completedOnboarding) {
        setRun(true);
        setHasStarted(true);
      }
    }
  }, [isLoading, authLoading, preferences, hasStarted]);

  // Restart tour when restartTrigger changes
  useEffect(() => {
    if (restartTrigger > 0 && !isLoading && !authLoading) {
      setRun(false);
      setHasStarted(false);
      setTimeout(() => {
        setRun(true);
        setHasStarted(true);
      }, 100);
    }
  }, [restartTrigger, isLoading, authLoading]);

  // Mutation to mark onboarding as complete
  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/user-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ completedOnboarding: true }),
      });
      if (!response.ok) throw new Error('Failed to update preferences');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
    },
  });

  const steps: Step[] = [
    {
      target: "body",
      content: (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold tracking-tight">Welcome to LegalNote AI</h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Let me show you the key features to help you get started. This quick tour will only take a minute.
          </p>
        </div>
      ),
      placement: "center",
      disableBeacon: true,
    },
    {
      target: '[data-testid="button-quick-record"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Quick Record</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Instantly start recording a client meeting with built-in consent capture. Perfect for urgent matters and spontaneous consultations.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-testid="link-new-note"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Create New Case</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Start a new case with audio recording or manual text entry. All cases are automatically organized and searchable.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
      spotlightClicks: true,
    },
    {
      target: '[data-testid="link-saved-cases"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Saved Cases</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            View and manage all your cases in one place. Filter by priority, status, or use search to find specific clients quickly.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
      spotlightClicks: true,
    },
    {
      target: '[data-testid="button-user-menu"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">User Menu & Settings</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Access your profile, firm settings, audit logs, and more from this menu. You can also restart this tour anytime from here.
          </p>
        </div>
      ),
      placement: "bottom-end",
      disableBeacon: true,
    },
    {
      target: "body",
      content: (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold tracking-tight">You're All Set!</h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Start by creating your first case or using Quick Record. Use the search feature and navigation menu to explore all features. Each feature has built-in guidance to help you along the way.
          </p>
        </div>
      ),
      placement: "center",
      disableBeacon: true,
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      if (!preferences?.completedOnboarding) {
        completeMutation.mutate();
      }
    }
  };

  if (isLoading || !preferences) {
    return null;
  }

  if (!run) {
    return null;
  }

  // Premium styling with dark/light mode support
  const styles: Partial<Styles> = {
    options: {
      arrowColor: "hsl(var(--popover))",
      backgroundColor: "hsl(var(--popover))",
      beaconSize: 36,
      overlayColor: "rgba(0, 0, 0, 0.6)",
      primaryColor: "hsl(var(--accent))",
      textColor: "hsl(var(--popover-foreground))",
      width: 400,
      zIndex: 10000,
    },
    tooltip: {
      borderRadius: 12,
      padding: 24,
      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)",
      opacity: 1,
    },
    tooltipContainer: {
      textAlign: "left",
      opacity: 1,
    },
    tooltipTitle: {
      fontSize: "1.25rem",
      fontWeight: 600,
      margin: 0,
      color: "hsl(var(--popover-foreground))",
    },
    tooltipContent: {
      fontSize: "0.875rem",
      padding: "12px 0 0 0",
      lineHeight: 1.6,
      color: "hsl(var(--muted-foreground))",
    },
    tooltipFooter: {
      marginTop: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    buttonNext: {
      backgroundColor: "hsl(var(--accent))",
      color: "hsl(var(--accent-foreground))",
      fontSize: "0.875rem",
      fontWeight: 500,
      padding: "10px 20px",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    buttonBack: {
      color: "hsl(var(--muted-foreground))",
      fontSize: "0.875rem",
      fontWeight: 500,
      padding: "10px 20px",
      borderRadius: 8,
      marginRight: 12,
      border: "1px solid hsl(var(--border))",
      backgroundColor: "transparent",
      cursor: "pointer",
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    buttonSkip: {
      color: "hsl(var(--muted-foreground))",
      fontSize: "0.875rem",
      fontWeight: 500,
      padding: "10px 16px",
      backgroundColor: "transparent",
      border: "none",
      cursor: "pointer",
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    buttonClose: {
      color: "hsl(var(--muted-foreground))",
      fontSize: "1.5rem",
      padding: 8,
      position: "absolute",
      right: 12,
      top: 12,
      width: 32,
      height: 32,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "none",
      backgroundColor: "transparent",
      cursor: "pointer",
      borderRadius: 6,
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    spotlight: {
      borderRadius: 8,
      transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    overlay: {
      transition: "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    beacon: {
      transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
    },
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={styles}
      floaterProps={{
        disableAnimation: false,
        styles: {
          floater: {
            filter: "drop-shadow(0 10px 15px rgb(0 0 0 / 0.2))",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          },
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish Tour",
        next: "Next",
        skip: "Skip Tour",
      }}
      disableScrolling={false}
      disableScrollParentFix
      spotlightClicks
      spotlightPadding={8}
    />
  );
}
