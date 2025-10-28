import { useState } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserPreferences } from "@shared/schema";

export default function OnboardingTour() {
  const { user, isLoading: authLoading } = useAuth();
  const [run, setRun] = useState(false);

  // Fetch user preferences to check onboarding completion
  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user-preferences"],
    enabled: !authLoading && !!user,
  });

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

  // Start tour when user logs in for first time (preferences loaded and not completed)
  useState(() => {
    if (!isLoading && preferences && !preferences.completedOnboarding && !run) {
      // Small delay to ensure all elements are rendered
      setTimeout(() => setRun(true), 500);
    }
  });

  const steps: Step[] = [
    {
      target: "body",
      content: (
        <div>
          <h2 className="text-lg font-semibold mb-2">Welcome to LegalNote AI!</h2>
          <p>Let me show you around so you can get started quickly. This will only take a moment.</p>
        </div>
      ),
      placement: "center",
      disableBeacon: true,
    },
    {
      target: '[data-testid="button-quick-record"]',
      content: "Use Quick Record to instantly start recording a client meeting with consent capture. Perfect for urgent matters.",
      placement: "bottom",
    },
    {
      target: '[data-testid="link-new-note"]',
      content: "Create a new case here. You can record audio or enter text notes manually.",
      placement: "bottom",
    },
    {
      target: '[data-testid="button-search"]',
      content: "Search across all your cases, clients, and documents to find what you need quickly.",
      placement: "bottom",
    },
    {
      target: '[data-testid="link-saved-cases"]',
      content: "View all your saved cases here. Filter by priority, status, or search for specific clients.",
      placement: "bottom",
    },
    {
      target: '[data-testid="link-firm-settings"]',
      content: "Manage firm settings here, including team members and firm details that appear on exported documents.",
      placement: "bottom",
    },
    {
      target: "body",
      content: (
        <div>
          <h2 className="text-lg font-semibold mb-2">You're all set!</h2>
          <p>Start by creating your first case or using Quick Record. If you need help, all features have tooltips and guidance.</p>
        </div>
      ),
      placement: "center",
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      completeMutation.mutate();
    }
  };

  // Don't render if still loading or already completed
  if (isLoading || !preferences || preferences.completedOnboarding) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "hsl(var(--accent))",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
        },
        buttonNext: {
          backgroundColor: "hsl(var(--accent))",
          color: "hsl(var(--accent-foreground))",
        },
        buttonBack: {
          color: "hsl(var(--muted-foreground))",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip Tour",
      }}
    />
  );
}
