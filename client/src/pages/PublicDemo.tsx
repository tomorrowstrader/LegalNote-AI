import { useMemo, useState, useCallback, useEffect, createContext, useContext, useRef } from "react";
import { useParams, useSearch, Router, Route } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { FocusModeProvider } from "@/contexts/FocusModeContext";
import {
  createDemoQueryClient,
  DEMO_CASE_ID,
  DEMO_USER_ID,
  installDemoFetchInterceptor,
  uninstallDemoFetchInterceptor,
} from "@/demo/createDemoQueryClient";
import { DemoBadge } from "@/demo/DemoBadge";
import { DemoTour, DemoTourHandle } from "@/components/demo/DemoTour";
import { LOCKED_CASE_IDS, DemoLockedOverlayManager } from "@/demo/DemoLockedOverlay";
import TopNavigation from "@/components/TopNavigation";
import Dashboard from "@/pages/Dashboard";
import CaseDetail from "@/pages/CaseDetail";
import { DemoMeetingSetupModal } from "@/demo/DemoMeetingSetupModal";
import { DemoCinematicProcessing } from "@/demo/DemoCinematicProcessing";
import { useDemoFlow } from "@/demo/useDemoFlow";
import { DemoProblemIntro } from "@/demo/DemoProblemIntro";

export const DemoModeContext = createContext<{
  isDemoMode: boolean;
  demoCaseId: string;
  lockedCaseIds: string[];
  isJustRevealed: boolean;
}>({
  isDemoMode: false,
  demoCaseId: "",
  lockedCaseIds: [],
  isJustRevealed: false,
});

export function useDemoMode() {
  return useContext(DemoModeContext);
}

const DEMO_CLICK_GUARDS: Record<string, { title: string; description: string }> = {
  "button-new-note": {
    title: "Demo mode",
    description: "Start by recording a meeting in your live account.",
  },
  "button-log-call-dashboard": {
    title: "Demo mode",
    description: "Start by recording a meeting in your live account.",
  },
  "button-record-new-session": {
    title: "Demo mode",
    description: "Recording is not available in the demo environment.",
  },
  "button-download-documents": {
    title: "Demo mode",
    description: "Document export is available in your live account.",
  },
  "link-new-note": {
    title: "Demo mode",
    description: "Start by recording a meeting in your live account.",
  },
  "link-cases": {
    title: "Demo mode",
    description: "Case management is available in your live account. Explore the cases in the demo dashboard.",
  },
  "link-home": {
    title: "Demo mode",
    description: "You are viewing an interactive demo. Sign up to access the full platform.",
  },
  "more-link-new-note": {
    title: "Demo mode",
    description: "Start by recording a meeting in your live account.",
  },
  "more-link-cases": {
    title: "Demo mode",
    description: "Case management is available in your live account.",
  },
  "mobile-link-new-note": {
    title: "Demo mode",
    description: "Start by recording a meeting in your live account.",
  },
  "mobile-link-saved-cases": {
    title: "Demo mode",
    description: "Case management is available in your live account.",
  },
  "button-quick-record": {
    title: "Demo mode",
    description: "Recording is not available in the demo — try it in your live account.",
  },
  "button-stop-quick-record": {
    title: "Demo mode",
    description: "Recording is not available in the demo — try it in your live account.",
  },
  "button-download-word": {
    title: "Demo mode",
    description: "Document export to Word is available in your live account.",
  },
  "button-download-pdf": {
    title: "Demo mode",
    description: "Document export to PDF is available in your live account.",
  },
  "button-export": {
    title: "Demo mode",
    description: "Export is available in your live account.",
  },
};

interface DemoInteractionGuardProps {
  onJoinMeeting: () => void;
  onTabReview: () => void;
  onCaseRow: () => void;
  onNavDocuments: () => void;
  onActionShare: () => void;
  onNavUndertakings: () => void;
  onNavAudit: () => void;
}

function DemoInteractionGuard({
  onJoinMeeting,
  onTabReview,
  onCaseRow,
  onNavDocuments,
  onActionShare,
  onNavUndertakings,
  onNavAudit,
}: DemoInteractionGuardProps) {
  const { toast } = useToast();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      let el = e.target as HTMLElement | null;
      while (el) {
        const testId = el.getAttribute("data-testid") || "";

        if (testId === "button-join-meeting-dashboard") {
          e.preventDefault();
          e.stopImmediatePropagation();
          onJoinMeeting();
          return;
        }

        if (testId === "tab-review") {
          onTabReview();
          return;
        }

        if (testId === "row-case-demo-case-family-001") {
          onCaseRow();
          return;
        }

        if (testId === "nav-documents") {
          onNavDocuments();
          return;
        }

        if (testId === "action-share") {
          e.preventDefault();
          e.stopImmediatePropagation();
          toast({
            title: "Secure share sent",
            description: "A secure link was sent to the client. They will verify by SMS before accessing the document. Access logged to the audit trail.",
            duration: 4000,
          });
          onActionShare();
          return;
        }

        if (testId === "nav-undertakings") {
          onNavUndertakings();
          return;
        }

        if (testId === "nav-audit") {
          onNavAudit();
          return;
        }

        if (DEMO_CLICK_GUARDS[testId]) {
          e.preventDefault();
          e.stopImmediatePropagation();
          toast({
            title: DEMO_CLICK_GUARDS[testId].title,
            description: DEMO_CLICK_GUARDS[testId].description,
            duration: 3500,
          });
          return;
        }

        el = el.parentElement;
      }
    };
    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [toast, onJoinMeeting, onTabReview, onCaseRow, onNavDocuments, onActionShare, onNavUndertakings, onNavAudit]);

  return null;
}

function DemoFetchInterceptor() {
  const { toast } = useToast();
  useEffect(() => {
    installDemoFetchInterceptor((msg) => {
      toast({ title: "Demo mode", description: msg, duration: 3000 });
    });
    return () => {
      uninstallDemoFetchInterceptor();
    };
  }, [toast]);
  return null;
}

const POST_CINEMATIC_TOUR_STEP_INDEX = 5;

function useDemoCaseDetailLocation(): [string, (to: string) => void] {
  return [`/case/${DEMO_CASE_ID}`, () => {}];
}

interface DemoInnerProps {
  practiceArea: string;
  caseTitle: string;
  revealCaseInCache: () => void;
  name?: string;
  firmName?: string;
}

function DemoInner({ practiceArea, caseTitle, revealCaseInCache, name, firmName }: DemoInnerProps) {
  const qc = useQueryClient();
  const { flowState, advanceFlow, markCaseVisible } = useDemoFlow();
  const [tourRestartTrigger, setTourRestartTrigger] = useState(0);
  const [tourResumeTrigger, setTourResumeTrigger] = useState(0);
  const [demoScreen, setDemoScreen] = useState<"dashboard" | "case">("dashboard");
  const tourRef = useRef<DemoTourHandle>(null);

  const handleRestartTour = useCallback(() => setTourRestartTrigger((v) => v + 1), []);

  const advanceTo = useCallback((stepIndex: number) => {
    tourRef.current?.advanceTourToStep(stepIndex);
  }, []);

  const handleJoinMeeting = useCallback(() => {
    advanceFlow("meeting_setup");
    advanceTo(2);
  }, [advanceFlow, advanceTo]);

  const handleConnectClick = useCallback(() => {
    advanceTo(3);
  }, [advanceTo]);

  const handleEndRecording = useCallback(() => {
    advanceFlow("processing");
  }, [advanceFlow]);

  const handleConsentConfirmed = useCallback(() => {
    const now = new Date().toISOString();
    const existingLogs: unknown[] = (qc.getQueryData(["/api/audit/logs"]) as unknown[]) ?? [];
    const existingCaseLogs: unknown[] = (qc.getQueryData(["/api/audit/case", DEMO_CASE_ID]) as unknown[]) ?? [];
    const newEntry = {
      id: `audit-consent-demo-${Date.now()}`,
      eventType: "consent_given",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: null,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: now,
      ipAddress: "192.168.1.1",
      userAgent: "LegalNote/2.0 (Demo)",
      metadata: { consentModality: "verbal_recorded", confirmedVia: "in_call_confirmation", gdprArticle: "7", disclaimerVersion: "v3.1" },
      severity: "info",
      hmacFingerprint: "c5a2d8f1e9b34710",
    };
    qc.setQueryData(["/api/audit/logs"], [newEntry, ...existingLogs]);
    qc.setQueryData(["/api/audit/logs", DEMO_CASE_ID], [newEntry, ...existingCaseLogs]);
    qc.setQueryData(["/api/audit/case", DEMO_CASE_ID], [newEntry, ...existingCaseLogs]);
    advanceTo(4);
  }, [qc, advanceTo]);

  const handleProcessingComplete = useCallback(() => {
    revealCaseInCache();
    markCaseVisible();
    localStorage.setItem("legalnote_demo_case_just_revealed", "1");
    setDemoScreen("case");
    setTimeout(() => {
      setTourResumeTrigger((v) => v + 1);
    }, 800);
  }, [revealCaseInCache, markCaseVisible]);

  const handleTabReview = useCallback(() => {
    advanceTo(6);
  }, [advanceTo]);

  const handleCaseRow = useCallback(() => {
    advanceTo(7);
  }, [advanceTo]);

  const handleNavDocuments = useCallback(() => {
    advanceTo(8);
  }, [advanceTo]);

  const handleActionShare = useCallback(() => {
    const now = new Date().toISOString();
    const existingCaseLogs: unknown[] = (qc.getQueryData(["/api/audit/case", DEMO_CASE_ID]) as unknown[]) ?? [];
    const shareEntry = {
      id: `audit-share-demo-${Date.now()}`,
      eventType: "document_shared",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: "fd1",
      transcriptId: null,
      audioRecordingId: null,
      timestamp: now,
      ipAddress: "192.168.1.1",
      userAgent: "LegalNote/2.0 (Demo)",
      metadata: { shareMethod: "secure_link", smsVerification: true, recipientNotified: true },
      severity: "info",
      hmacFingerprint: `share${Date.now().toString(16)}`,
    };
    qc.setQueryData(["/api/audit/case", DEMO_CASE_ID], [shareEntry, ...existingCaseLogs]);
    advanceTo(9);
  }, [qc, advanceTo]);

  const handleNavUndertakings = useCallback(() => {
    advanceTo(10);
  }, [advanceTo]);

  const handleNavAudit = useCallback(() => {
    advanceTo(11);
  }, [advanceTo]);

  const isProcessing = flowState === "processing";

  return (
    <>
      <DemoFetchInterceptor />
      <DemoInteractionGuard
        onJoinMeeting={handleJoinMeeting}
        onTabReview={handleTabReview}
        onCaseRow={handleCaseRow}
        onNavDocuments={handleNavDocuments}
        onActionShare={handleActionShare}
        onNavUndertakings={handleNavUndertakings}
        onNavAudit={handleNavAudit}
      />
      <div className="min-h-screen bg-background pb-16">
        <TopNavigation onRestartTour={handleRestartTour} />
        <DemoBadge />
        <DemoTour
          ref={tourRef}
          restartTrigger={tourRestartTrigger}
          practiceArea={practiceArea}
          resumeTrigger={tourResumeTrigger}
          startAtStep={POST_CINEMATIC_TOUR_STEP_INDEX}
          name={name}
          firmName={firmName}
          hidden={isProcessing}
        />
        <DemoLockedOverlayManager />
        <div className="pt-16">
          {demoScreen === "dashboard" ? (
            <Dashboard />
          ) : (
            <Router hook={useDemoCaseDetailLocation}>
              <Route path="/case/:id" component={CaseDetail} />
            </Router>
          )}
        </div>
      </div>

      <DemoMeetingSetupModal
        open={flowState === "meeting_setup"}
        caseTitle={caseTitle}
        onEndRecording={handleEndRecording}
        onClose={() => advanceFlow("dashboard")}
        onConsentConfirmed={handleConsentConfirmed}
        onConnectClick={handleConnectClick}
      />

      {flowState === "processing" && (
        <DemoCinematicProcessing onComplete={handleProcessingComplete} />
      )}
    </>
  );
}

const INTRO_SEEN_KEY = "legalnote_demo_intro_seen_v1";

export default function PublicDemo() {
  const [introSeen, setIntroSeen] = useState(
    () => !!localStorage.getItem(INTRO_SEEN_KEY)
  );

  const handleIntroComplete = () => {
    localStorage.setItem(INTRO_SEEN_KEY, "1");
    setIntroSeen(true);
  };

  if (!introSeen) {
    return <DemoProblemIntro onComplete={handleIntroComplete} />;
  }

  return <DemoApp />;
}

function DemoApp() {
  const params = useParams<{ practiceArea: string }>();
  const searchStr = useSearch();

  const searchParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const firstName = searchParams.get("name") || "";
  const lastName = searchParams.get("lastName") || "";
  const firmName = searchParams.get("firm") || "Demo Law Firm";
  const sraNumber = searchParams.get("sraNumber") || undefined;
  const rateStr = searchParams.get("rate");
  const rate = rateStr ? parseInt(rateStr, 10) : 220;

  const practiceArea = params.practiceArea || "family";

  const resolvedLastName = useMemo(() => {
    if (lastName) return lastName;
    if (!firstName) return "";
    const parts = firstName.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : "";
  }, [lastName, firstName]);

  const { demoQueryClient, revealCaseInCache, caseTitle } = useMemo(() => {
    const clientName = resolvedLastName
      ? `S. ${resolvedLastName}`
      : firstName
        ? `${firstName.trim().split(/\s+/).slice(-1)[0]}, Client`
        : "Demo Client";
    const { qc, revealCase } = createDemoQueryClient({
      name: firstName || "Rachel",
      lastName: resolvedLastName,
      firm: firmName,
      practiceArea,
      sraNumber,
      rate,
    });
    return {
      demoQueryClient: qc,
      revealCaseInCache: revealCase,
      caseTitle: `Child Arrangements Order — ${clientName}`,
    };
  }, []);

  const demoContextValue = useMemo(
    () => ({ isDemoMode: true, demoCaseId: DEMO_CASE_ID, lockedCaseIds: LOCKED_CASE_IDS, isJustRevealed: false }),
    []
  );

  return (
    <DemoModeContext.Provider value={demoContextValue}>
      <QueryClientProvider client={demoQueryClient}>
        <TooltipProvider>
          <FocusModeProvider>
            <DemoInner
              practiceArea={practiceArea}
              revealCaseInCache={revealCaseInCache}
              caseTitle={caseTitle}
              name={firstName || undefined}
              firmName={firmName || undefined}
            />
            <Toaster />
          </FocusModeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </DemoModeContext.Provider>
  );
}
