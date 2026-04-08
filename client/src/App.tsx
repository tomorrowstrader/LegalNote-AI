import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { FocusModeProvider, useFocusMode } from "@/contexts/FocusModeContext";
import { useNewNoteShortcut } from "@/hooks/useNewNoteShortcut";
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
import Clients from "@/pages/Clients";
import ClientProfile from "@/pages/ClientProfile";
import Login from "@/pages/Login";
import TimeSummary from "@/pages/TimeSummary";
import UndertakingsDashboard from "@/pages/UndertakingsDashboard";
import TeamManagement from "@/pages/TeamManagement";
import FirmCompliance from "@/pages/FirmCompliance";
import AcknowledgePage from "@/pages/AcknowledgePage";
import ComplianceBadge from "@/pages/ComplianceBadge";
import InviteAccept from "@/pages/InviteAccept";
import PendingApproval from "@/pages/PendingApproval";
import ScrollToTop from "@/components/ScrollToTop";
import PublicDemo from "@/pages/PublicDemo";
import DemoGenerator from "@/pages/DemoGenerator";

function Router() {
  const { user, isAuthenticated, isLoading, isAdmin, isWaitlisted, isFirmAdmin, canAccessFirmCompliance } = useAuth();
  const isPendingApproval = user?.inviteStatus === "pending_approval";

  return (
    <Switch>
      {/* Public routes (accessible without authentication) */}
      <Route path="/demo/:practiceArea{/:rest*}" component={PublicDemo} />
      <Route path="/demo-generator" component={DemoGenerator} />
      <Route path="/share/:linkId" component={ShareLinkView} />
      <Route path="/acknowledge/:token" component={AcknowledgePage} />
      <Route path="/badge/:slug" component={ComplianceBadge} />
      <Route path="/invite/accept/:token" component={InviteAccept} />
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
      ) : isPendingApproval && !isAdmin ? (
        <>
          <Route path="/pending-approval" component={PendingApproval} />
          <Route component={PendingApproval} />
        </>
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
          <Route path="/clients" component={Clients} />
          <Route path="/clients/:id" component={ClientProfile} />
          <Route path="/time-summary" component={TimeSummary} />
          <Route path="/undertakings" component={UndertakingsDashboard} />
          {isFirmAdmin && <Route path="/team" component={TeamManagement} />}
          {canAccessFirmCompliance && <Route path="/compliance" component={FirmCompliance} />}
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
  const [location] = useLocation();

  useNewNoteShortcut();

  const handleRestartTour = () => {
    setRestartTourTrigger(prev => prev + 1);
  };

  const isPublicDemoRoute = location.startsWith("/demo/");

  return (
    <div className={`min-h-screen bg-background ${!isLoading && isAuthenticated && !isFocusMode && !isPublicDemoRoute ? 'pt-16' : ''}`}>
      {!isLoading && isAuthenticated && !isFocusMode && !isPublicDemoRoute && <TopNavigation onRestartTour={handleRestartTour} />}
      {!isLoading && isAuthenticated && !isFocusMode && !isPublicDemoRoute && <FirmSetupPrompt />}
      {!isLoading && isAuthenticated && !isFocusMode && !isPublicDemoRoute && <OnboardingTour restartTrigger={restartTourTrigger} />}
      {!isLoading && isAuthenticated && !isPublicDemoRoute && (
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
