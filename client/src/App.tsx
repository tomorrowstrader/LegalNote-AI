import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { FocusModeProvider, useFocusMode } from "@/contexts/FocusModeContext";
import { useDoubleTapL } from "@/hooks/useDoubleTapL";
import TopNavigation from "@/components/TopNavigation";
import FirmSetupPrompt from "@/components/FirmSetupPrompt";
import OnboardingTour from "@/components/OnboardingTour";
import Dashboard from "@/pages/Dashboard";
import NewNote from "@/pages/NewNote";
import CaseDetail from "@/pages/CaseDetail";
import SavedCases from "@/pages/SavedCases";
import Settings from "@/pages/Settings";
import MyProfile from "@/pages/MyProfile";
import AuditLogs from "@/pages/AuditLogs";
import AdminDashboard from "@/pages/AdminDashboard";
import SecurityFeatures from "@/pages/SecurityFeatures";
import Landing from "@/pages/Landing";
import ShareLinkView from "@/pages/ShareLinkView";
import OAuthCallback from "@/pages/OAuthCallback";
import CalendarSyncConfirmation from "@/pages/CalendarSyncConfirmation";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes (accessible without authentication) */}
      <Route path="/share/:linkId" component={ShareLinkView} />
      <Route path="/oauth/callback" component={OAuthCallback} />
      <Route path="/calendar-sync-confirmation" component={CalendarSyncConfirmation} />
      
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/new-note" component={NewNote} />
          <Route path="/case/:id" component={CaseDetail} />
          <Route path="/cases" component={SavedCases} />
          <Route path="/settings" component={Settings} />
          <Route path="/profile" component={MyProfile} />
          <Route path="/audit-logs" component={AuditLogs} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/security" component={SecurityFeatures} />
        </>
      )}
      {/* Only show 404 after auth is resolved to prevent flash during OAuth callback */}
      {!isLoading && <Route component={NotFound} />}
    </Switch>
  );
}

function AuthenticatedAppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isFocusMode } = useFocusMode();
  const [restartTourTrigger, setRestartTourTrigger] = useState(0);

  useDoubleTapL();

  const handleRestartTour = () => {
    setRestartTourTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {!isLoading && isAuthenticated && !isFocusMode && <TopNavigation onRestartTour={handleRestartTour} />}
      {!isLoading && isAuthenticated && !isFocusMode && <FirmSetupPrompt />}
      {!isLoading && isAuthenticated && !isFocusMode && <OnboardingTour restartTrigger={restartTourTrigger} />}
      <Router />
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <FocusModeProvider>
      <AuthenticatedAppContent />
    </FocusModeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthenticatedApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
