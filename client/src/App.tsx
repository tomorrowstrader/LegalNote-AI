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
import { RecordingRecoveryModal, useRecordingRecovery } from "@/components/RecordingRecoveryModal";
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
import Pricing from "@/pages/Pricing";
import ShareLinkView from "@/pages/ShareLinkView";
import OAuthCallback from "@/pages/OAuthCallback";
import CalendarSyncConfirmation from "@/pages/CalendarSyncConfirmation";
import WaitlistPage from "@/pages/WaitlistPage";
import NotFound from "@/pages/not-found";
import SecurityPage from "@/pages/SecurityPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";
import Features from "@/pages/Features";
import Calculator from "@/pages/Calculator";
import MyActions from "@/pages/MyActions";
import Login from "@/pages/Login";
import ScrollToTop from "@/components/ScrollToTop";

function Router() {
  const { isAuthenticated, isLoading, isAdmin, isWaitlisted } = useAuth();

  return (
    <Switch>
      {/* Public routes (accessible without authentication) */}
      <Route path="/share/:linkId" component={ShareLinkView} />
      <Route path="/oauth/callback" component={OAuthCallback} />
      <Route path="/calendar-sync-confirmation" component={CalendarSyncConfirmation} />
      <Route path="/landing-preview" component={Landing} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/features" component={Features} />
      <Route path="/calculator" component={Calculator} />
      <Route path="/login" component={Login} />
      
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : isWaitlisted && !isAdmin ? (
        <>
          <Route path="/waitlist" component={WaitlistPage} />
          <Route component={WaitlistPage} />
        </>
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
          <Route path="/app/security" component={SecurityFeatures} />
          <Route path="/my-actions" component={MyActions} />
          <Route path="/waitlist" component={WaitlistPage} />
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
  const { showRecoveryModal, setShowRecoveryModal } = useRecordingRecovery();

  useDoubleTapL();

  const handleRestartTour = () => {
    setRestartTourTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {!isLoading && isAuthenticated && !isFocusMode && <TopNavigation onRestartTour={handleRestartTour} />}
      {!isLoading && isAuthenticated && !isFocusMode && <FirmSetupPrompt />}
      {!isLoading && isAuthenticated && !isFocusMode && <OnboardingTour restartTrigger={restartTourTrigger} />}
      {!isLoading && isAuthenticated && (
        <RecordingRecoveryModal
          open={showRecoveryModal}
          onOpenChange={setShowRecoveryModal}
        />
      )}
      <ScrollToTop />
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
