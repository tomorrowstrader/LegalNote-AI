import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { FocusModeProvider, useFocusMode } from "@/contexts/FocusModeContext";
import { LiveBotSessionProvider } from "@/contexts/LiveBotSessionContext";
import { LiveBotSessionIndicator } from "@/components/LiveBotSessionIndicator";
import { useNewNoteShortcut } from "@/hooks/useNewNoteShortcut";
import { useQuickRecordShortcut } from "@/hooks/useQuickRecordShortcut";
import TopNavigation from "@/components/TopNavigation";
import FirmSetupPrompt from "@/components/FirmSetupPrompt";
import DisplayNameOnboarding from "@/components/DisplayNameOnboarding";
import IntegrationsOnboarding from "@/components/IntegrationsOnboarding";
import OnboardingTour from "@/components/OnboardingTour";
import { UpcomingMeetingPrompt } from "@/components/UpcomingMeetingPrompt";
import { RecordingRecoveryModal, useRecordingRecovery } from "@/components/RecordingRecoveryModal";
import { VideoBotRecoveryModal, useVideoBotRecovery } from "@/components/VideoBotRecoveryModal";
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
import AccessPending from "@/pages/AccessPending";
import ScrollToTop from "@/components/ScrollToTop";
import PublicDemo from "@/pages/PublicDemo";
import DemoGenerator from "@/pages/DemoGenerator";
import { isFeatureVisible } from "@/lib/features";

const firmComplianceDashboardVisible = isFeatureVisible("firmComplianceDashboard");
const publicComplianceBadgeVisible = isFeatureVisible("publicComplianceBadge");

function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, []);
  return null;
}

function Router() {
  const { user, isAuthenticated, isLoading, isAdmin, isWaitlisted, isFirmAdmin, canAccessFirmCompliance } = useAuth();
  const isPendingApproval = user?.inviteStatus === "pending_approval";
  const isAccessPending = user?.accessAllowed === false && !isAdmin;

  return (
    <Switch>
      {/* Public routes (accessible without authentication) */}
      <Route path="/demo/:practiceArea" component={PublicDemo} />
      <Route path="/demo-generator" component={DemoGenerator} />
      <Route path="/demo-generation" component={() => <RedirectTo to="/demo-generator" />} />
      <Route path="/share/:linkId" component={ShareLinkView} />
      <Route path="/acknowledge/:token" component={AcknowledgePage} />
      {publicComplianceBadgeVisible && <Route path="/badge/:slug" component={ComplianceBadge} />}
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
      ) : isAccessPending ? (
        <>
          <Route path="/access-pending" component={AccessPending} />
          <Route component={AccessPending} />
        </>
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
          {canAccessFirmCompliance && firmComplianceDashboardVisible && <Route path="/compliance" component={FirmCompliance} />}
          <Route path="/waitlist" component={WaitlistPage} />
        </>
      )}
      {/* Only show 404 after auth is resolved to prevent flash during OAuth callback */}
      {!isLoading && <Route component={NotFound} />}
    </Switch>
  );
}

function AuthenticatedAppContent() {
  const { user, isAuthenticated, isLoading, isAdmin } = useAuth();
  const hasAppAccess = isAuthenticated && (isAdmin || user?.accessAllowed !== false);
  const { isFocusMode } = useFocusMode();
  const [restartTourTrigger, setRestartTourTrigger] = useState(0);
  const [location] = useLocation();
  const { showRecoveryModal, setShowRecoveryModal } = useRecordingRecovery(
    !isLoading && hasAppAccess,
  );
  const { showVideoBotRecovery, setShowVideoBotRecovery } = useVideoBotRecovery(
    !isLoading && hasAppAccess && !showRecoveryModal,
  );

  useNewNoteShortcut();
  useQuickRecordShortcut();

  useEffect(() => {
    if (!isLoading && hasAppAccess) {
      document.body.classList.add('app-body');
    } else {
      document.body.classList.remove('app-body');
    }
    return () => document.body.classList.remove('app-body');
  }, [isLoading, hasAppAccess]);

  const handleRestartTour = () => {
    setRestartTourTrigger(prev => prev + 1);
  };

  const isPublicDemoRoute = location.startsWith("/demo/");
  const recoveryBlocking = showRecoveryModal || showVideoBotRecovery;

  return (
    <div className={`min-h-screen bg-background ${!isLoading && hasAppAccess && !isFocusMode && !isPublicDemoRoute ? 'pt-16' : ''}`}>
      {!isLoading && hasAppAccess && !isFocusMode && !isPublicDemoRoute && <TopNavigation onRestartTour={handleRestartTour} />}
      {!isLoading && hasAppAccess && !isFocusMode && !isPublicDemoRoute && <FirmSetupPrompt />}
      {!isLoading && hasAppAccess && !isFocusMode && !isPublicDemoRoute && <DisplayNameOnboarding />}
      {!isLoading && hasAppAccess && !isFocusMode && !isPublicDemoRoute && <IntegrationsOnboarding />}
      {!isLoading && hasAppAccess && !isFocusMode && !isPublicDemoRoute && <OnboardingTour restartTrigger={restartTourTrigger} />}
      {!isLoading && hasAppAccess && !isFocusMode && !isPublicDemoRoute && (
        <UpcomingMeetingPrompt blocked={recoveryBlocking} />
      )}
      {!isLoading && hasAppAccess && !isPublicDemoRoute && (
        <RecordingRecoveryModal
          open={showRecoveryModal}
          onOpenChange={setShowRecoveryModal}
        />
      )}
      {!isLoading && hasAppAccess && !isPublicDemoRoute && (
        <VideoBotRecoveryModal
          open={showVideoBotRecovery}
          onOpenChange={setShowVideoBotRecovery}
        />
      )}
      {!isLoading && hasAppAccess && !isPublicDemoRoute && <LiveBotSessionIndicator />}
      <ScrollToTop />
      <Router />
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <FocusModeProvider>
      <LiveBotSessionProvider>
        <AuthenticatedAppContent />
      </LiveBotSessionProvider>
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
