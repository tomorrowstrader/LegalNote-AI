import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { FocusModeProvider, useFocusMode } from "@/contexts/FocusModeContext";
import { LiveBotSessionProvider } from "@/contexts/LiveBotSessionContext";
import { NewNoteRecordingProvider } from "@/contexts/NewNoteRecordingContext";
import { LiveBotSessionIndicator } from "@/components/LiveBotSessionIndicator";
import { VoiceCommandTrigger } from "@/components/VoiceCommandTrigger";
import { useCaptureShortcut } from "@/hooks/useCaptureShortcut";
import { useQuickRecordShortcut } from "@/hooks/useQuickRecordShortcut";
import TopNavigation from "@/components/TopNavigation";
import MobileBottomNav from "@/components/MobileBottomNav";
import FirmSetupPrompt from "@/components/FirmSetupPrompt";
import EvaluationPeriodBanner, { useEvaluationBannerOffset } from "@/components/EvaluationPeriodBanner";
import DisplayNameOnboarding from "@/components/DisplayNameOnboarding";
import IntegrationsOnboarding from "@/components/IntegrationsOnboarding";
import OnboardingTour from "@/components/OnboardingTour";
import { UpcomingMeetingPrompt } from "@/components/UpcomingMeetingPrompt";
import { RecordingRecoveryModal, useRecordingRecovery } from "@/components/RecordingRecoveryModal";
import { VideoBotRecoveryModal, useVideoBotRecovery } from "@/components/VideoBotRecoveryModal";
import Dashboard from "@/pages/Dashboard";
import Capture from "@/pages/Capture";
import CaseDetail from "@/pages/CaseDetail";
import SavedCases from "@/pages/SavedCases";
import Settings from "@/pages/Settings";
import MyProfile from "@/pages/MyProfile";
import AuditLogs from "@/pages/AuditLogs";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminDpaMintPage from "@/pages/AdminDpaMintPage";
import AdminDpaAcceptancesPage from "@/pages/AdminDpaAcceptancesPage";
import AdminProvisionFirmPage from "@/pages/AdminProvisionFirmPage";
import AdminSupportTicketsPage from "@/pages/AdminSupportTicketsPage";
import SupportPage from "@/pages/SupportPage";
import FirmOverview from "@/pages/FirmOverview";
import SecurityFeatures from "@/pages/SecurityFeatures";
import Landing from "@/pages/Landing";
import CampaignFunnel from "@/pages/CampaignFunnel";
import Pricing from "@/pages/Pricing";
import ShareLinkView from "@/pages/ShareLinkView";
import BookMeetingPage from "@/pages/BookMeetingPage";
import OAuthCallback from "@/pages/OAuthCallback";
import CalendarSyncConfirmation from "@/pages/CalendarSyncConfirmation";
import WaitlistPage from "@/pages/WaitlistPage";
import NotFound from "@/pages/not-found";
import SecurityPage from "@/pages/SecurityPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";
import CookiePage from "@/pages/CookiePage";
import SubProcessorsPage from "@/pages/SubProcessorsPage";
import DpaPage from "@/pages/DpaPage";
import DpaCompletePage from "@/pages/DpaCompletePage";
import DpaPreviewPage from "@/pages/DpaPreviewPage";
import DpaConfirmPage from "@/pages/DpaConfirmPage";
import AcceptanceCertificatePage from "@/pages/AcceptanceCertificatePage";
import EvaluationSetupPage from "@/pages/EvaluationSetupPage";
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
import MeetingNotesPopout from "@/pages/MeetingNotesPopout";
import { isFeatureVisible } from "@/lib/features";
import { useFeatureVisibility } from "@/hooks/useFeatureVisibility";
import { isMeetingNotesPopoutRoute } from "@/lib/meetingNotesPopout";
import { isCalendarOAuthPopupWindow } from "@/lib/calendarOAuthBridge";

const publicComplianceBadgeVisible = isFeatureVisible("publicComplianceBadge");

function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [setLocation, to]);
  return null;
}

/** Deep link from emails — sign in first, then land on Help & Support. */
function SupportRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation(`/login?returnTo=${encodeURIComponent("/support")}`);
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <SupportPage />;
}

function Router() {
  const { user, isAuthenticated, isLoading, isAdmin, isWaitlisted, isFirmAdmin, canAccessFirmCompliance } = useAuth();
  const firmComplianceDashboardVisible = useFeatureVisibility("firmComplianceDashboard");
  const isPendingApproval = user?.inviteStatus === "pending_approval";
  const isAccessPending = user?.accessAllowed === false && !isAdmin;

  return (
    <Switch>
      {/* Public routes (accessible without authentication) */}
      <Route path="/demo/:practiceArea" component={PublicDemo} />
      <Route path="/demo-generator" component={DemoGenerator} />
      <Route path="/demo-generation" component={() => <RedirectTo to="/demo-generator" />} />
      <Route path="/share/:linkId" component={ShareLinkView} />
      <Route path="/book/:token" component={BookMeetingPage} />
      <Route path="/acknowledge/:token" component={AcknowledgePage} />
      {publicComplianceBadgeVisible && <Route path="/badge/:slug" component={ComplianceBadge} />}
      <Route path="/invite/accept/:token" component={InviteAccept} />
      <Route path="/oauth/callback" component={OAuthCallback} />
      <Route path="/calendar-sync-confirmation" component={CalendarSyncConfirmation} />
      <Route path="/landing-preview" component={Landing} />
      <Route path="/start" component={CampaignFunnel} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/cookies" component={CookiePage} />
      <Route path="/sub-processors" component={SubProcessorsPage} />
      <Route path="/dpa/complete" component={DpaCompletePage} />
      <Route path="/dpa/preview" component={DpaPreviewPage} />
      <Route path="/dpa/confirm/:token" component={DpaConfirmPage} />
      <Route path="/dpa" component={DpaPage} />
      <Route path="/legal/acceptance/:id" component={AcceptanceCertificatePage} />
      <Route path="/evaluation/setup/:token" component={EvaluationSetupPage} />
      <Route path="/features" component={Features} />
      <Route path="/calculator" component={Calculator} />
      <Route path="/login" component={Login} />
      <Route path="/support" component={SupportRoute} />

      {/* Admin tools — always registered so deep links don't blank before/without auth.
          API still enforces isAuthenticated + isAdmin. */}
      <Route path="/admin/dpa-mint" component={AdminDpaMintPage} />
      <Route path="/admin/dpa-acceptances" component={AdminDpaAcceptancesPage} />
      <Route path="/admin/provision-firm" component={AdminProvisionFirmPage} />
      <Route path="/admin/support-tickets" component={AdminSupportTicketsPage} />
      <Route path="/admin" component={AdminDashboard} />
      
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
          <Route path="/meeting-notes-popout" component={MeetingNotesPopout} />
          <Route path="/" component={Dashboard} />
          <Route path="/capture" component={Capture} />
          <Route path="/new-note" component={() => <RedirectTo to="/capture" />} />
          <Route path="/case/:id" component={CaseDetail} />
          <Route path="/cases" component={SavedCases} />
          <Route path="/settings" component={Settings} />
          <Route path="/profile" component={MyProfile} />
          <Route path="/audit-logs" component={AuditLogs} />
          <Route path="/app/security" component={SecurityFeatures} />
          <Route path="/my-actions" component={MyActions} />
          <Route path="/clients" component={Clients} />
          <Route path="/clients/:id" component={ClientProfile} />
          <Route path="/time-summary" component={TimeSummary} />
          <Route path="/undertakings" component={UndertakingsDashboard} />
          {isFirmAdmin && <Route path="/team" component={TeamManagement} />}
          {isFirmAdmin && <Route path="/firm" component={FirmOverview} />}
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
  const hasEvaluationBanner = useEvaluationBannerOffset();

  useCaptureShortcut();
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
  const isNotesPopout = isMeetingNotesPopoutRoute(location);
  const isOAuthPopup = isCalendarOAuthPopupWindow();
  const hideAppChrome = isPublicDemoRoute || isNotesPopout || isFocusMode || isOAuthPopup;
  const recoveryBlocking = showRecoveryModal || showVideoBotRecovery;

  // Stray OAuth popup that landed on a full app route (e.g. Settings after
  // opener was severed) — close it so onboarding cannot run in the wrong window.
  useEffect(() => {
    if (!isOAuthPopup) return;
    if (location.startsWith("/oauth/callback")) return;
    try {
      window.close();
    } catch {
      /* ignore */
    }
  }, [isOAuthPopup, location]);

  // If the browser blocked window.close(), show a minimal shell instead of the full app.
  if (isOAuthPopup && !location.startsWith("/oauth/callback")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="mx-auto max-w-sm space-y-4 px-2 text-center">
          <h1 className="text-xl font-semibold tracking-tight">You can close this window</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Calendar connection finished in the background. Return to your original LegalNote tab to continue setup.
          </p>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
            onClick={() => {
              try {
                window.close();
              } catch {
                /* ignore */
              }
            }}
          >
            Close window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-background ${
        !isLoading && hasAppAccess && !hideAppChrome
          ? hasEvaluationBanner
            ? "pt-[calc(7rem+env(safe-area-inset-top,0px))] pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pt-[calc(7rem+env(safe-area-inset-top,0px))] lg:pb-0"
            : "pt-[env(safe-area-inset-top,0px)] pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pt-[calc(4rem+env(safe-area-inset-top,0px))] lg:pb-0"
          : ""
      }`}
    >
      {!isLoading && hasAppAccess && !hideAppChrome && <TopNavigation onRestartTour={handleRestartTour} />}
      {!isLoading && hasAppAccess && !hideAppChrome && <EvaluationPeriodBanner />}
      {!isLoading && hasAppAccess && !hideAppChrome && (
        <MobileBottomNav onRestartTour={handleRestartTour} />
      )}
      {!isLoading && hasAppAccess && !hideAppChrome && <FirmSetupPrompt />}
      {!isLoading && hasAppAccess && !hideAppChrome && <DisplayNameOnboarding />}
      {!isLoading && hasAppAccess && !hideAppChrome && <IntegrationsOnboarding />}
      {!isLoading && hasAppAccess && !hideAppChrome && <OnboardingTour restartTrigger={restartTourTrigger} />}
      {!isLoading && hasAppAccess && !hideAppChrome && (
        <UpcomingMeetingPrompt blocked={recoveryBlocking} />
      )}
      {!isLoading && hasAppAccess && !isPublicDemoRoute && !isNotesPopout && (
        <RecordingRecoveryModal
          open={showRecoveryModal}
          onOpenChange={setShowRecoveryModal}
        />
      )}
      {!isLoading && hasAppAccess && !isPublicDemoRoute && !isNotesPopout && (
        <VideoBotRecoveryModal
          open={showVideoBotRecovery}
          onOpenChange={setShowVideoBotRecovery}
        />
      )}
      {!isLoading && hasAppAccess && !isPublicDemoRoute && !isNotesPopout && <LiveBotSessionIndicator />}
      {!isLoading && hasAppAccess && !hideAppChrome && <VoiceCommandTrigger />}
      {!isNotesPopout && <ScrollToTop />}
      <Router />
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <FocusModeProvider>
      <LiveBotSessionProvider>
        <NewNoteRecordingProvider>
          <AuthenticatedAppContent />
        </NewNoteRecordingProvider>
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
