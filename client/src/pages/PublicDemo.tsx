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
import ShareLinkModal from "@/components/ShareLinkModal";

const CALENDLY_URL = "https://calendly.com/legalnote/demo";

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

const DEMO_CLICK_GUARDS: Record<string, string> = {
  "button-new-note": "Recording is available in your firm's live account, follow the walkthrough to continue.",
  "button-log-call-dashboard": "Call logging is available in your firm's live account.",
  "button-record-new-session": "Recording is available in your firm's live account.",
  "button-download-documents": "Document export is available in your firm's live account.",
  "link-new-note": "Follow the walkthrough to see how recording works in this showroom.",
  "link-cases": "Explore the cases shown in this showroom, follow the walkthrough to continue.",
  "link-home": "You are exploring the LegalNote showroom. Follow the steps to see the full experience.",
  "more-link-new-note": "Follow the walkthrough to see how recording works.",
  "more-link-cases": "Case management is available in your firm's live account.",
  "mobile-link-new-note": "Follow the walkthrough to see how recording works.",
  "mobile-link-saved-cases": "Case management is available in your firm's live account.",
  "button-quick-record": "Follow the walkthrough, recording is demonstrated through Join Meeting.",
  "button-stop-quick-record": "Follow the walkthrough, recording is demonstrated through Join Meeting.",
  "button-download-word": "Document export to Word is available in your firm's live account.",
  "button-download-pdf": "Document export to PDF is available in your firm's live account.",
  "button-export": "Export is available in your firm's live account.",
};

const SHOWROOM_TOAST_TITLE = "Showroom access";

interface DemoInteractionGuardProps {
  currentTourTarget: string | null;
  tourActive: boolean;
  onJoinMeeting: () => void;
  onNavSessions: () => void;
  onNavDocuments: () => void;
  onActionShare: () => void;
  onNavUndertakings: () => void;
  onNavAudit: () => void;
  onNavObligations: () => void;
  onNavConsent: () => void;
  onNavAttendanceTab: () => void;
}

function DemoInteractionGuard({
  currentTourTarget,
  tourActive,
  onJoinMeeting,
  onNavSessions,
  onNavDocuments,
  onActionShare,
  onNavUndertakings,
  onNavAudit,
  onNavObligations,
  onNavConsent,
  onNavAttendanceTab,
}: DemoInteractionGuardProps) {
  const { toast } = useToast();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // ── Tab checks use closest() so taps on child <span> elements are caught ──
      if (target.closest('[data-testid="tab-attendance"]')) {
        if (currentTourTarget === "tab-attendance" || currentTourTarget === "tab-transcript") {
          if (currentTourTarget === "tab-attendance") {
            onNavAttendanceTab();
          }
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        toast({ title: SHOWROOM_TOAST_TITLE, description: "Follow the walkthrough to reach the attendance note.", duration: 3000 });
        return;
      }

      if (target.closest('[data-testid="tab-transcript"]')) {
        if (currentTourTarget === "tab-transcript" || currentTourTarget === "tab-attendance") {
          if (currentTourTarget === "tab-transcript") {
            setTimeout(() => {
              const badge = document.querySelector('[data-testid="badge-diarized"]');
              if (badge) badge.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
            }, 200);
          }
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        toast({ title: SHOWROOM_TOAST_TITLE, description: "Follow the walkthrough to reach the transcript step.", duration: 3000 });
        return;
      }

      let el: HTMLElement | null = target;

      while (el) {
        const testId = el.getAttribute("data-testid") || "";

        if (testId === "button-join-meeting-dashboard") {
          e.preventDefault();
          e.stopImmediatePropagation();
          onJoinMeeting();
          return;
        }

        if (testId === "nav-sessions") {
          return;
        }

        if (testId === "nav-documents") {
          onNavDocuments();
          return;
        }

        if (testId === "nav-obligations") {
          onNavObligations();
          return;
        }

        if (testId === "nav-consent") {
          onNavConsent();
          return;
        }

        if (testId === "button-case-actions") {
          if (
            currentTourTarget === "button-case-actions" ||
            currentTourTarget === "action-share" ||
            currentTourTarget === "action-sra-report"
          ) {
            return;
          }
          e.preventDefault();
          e.stopImmediatePropagation();
          toast({
            title: SHOWROOM_TOAST_TITLE,
            description: "Follow the walkthrough to reach the secure share step.",
            duration: 3000,
          });
          return;
        }

        if (testId === "action-share") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (currentTourTarget === "action-share" || currentTourTarget === "button-case-actions") {
            onActionShare();
          } else {
            toast({
              title: SHOWROOM_TOAST_TITLE,
              description: "Follow the walkthrough to reach the secure share step.",
              duration: 3000,
            });
          }
          return;
        }

        if (testId === "action-sra-report") {
          if (currentTourTarget === "action-sra-report" || currentTourTarget === "button-case-actions") {
            return;
          }
          e.preventDefault();
          e.stopImmediatePropagation();
          toast({
            title: SHOWROOM_TOAST_TITLE,
            description: "Follow the walkthrough to reach the SRA report step.",
            duration: 3000,
          });
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
            title: SHOWROOM_TOAST_TITLE,
            description: DEMO_CLICK_GUARDS[testId],
            duration: 3000,
          });
          return;
        }

        if (testId.startsWith("button-expand-session-") || testId.startsWith("button-open-session-docs-")) {
          return;
        }

        if (tourActive && currentTourTarget) {
          const isOnTourCard = !!el.closest("[data-testid='tour-tooltip']");
          if (isOnTourCard) return;

          const isOnFinalImpact = !!el.closest("[data-testid='demo-final-impact']");
          if (isOnFinalImpact) return;

          const isOnTarget = !!el.closest(`[data-testid="${currentTourTarget}"]`);
          if (isOnTarget) return;

          const isInteractive = el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA";
          if (isInteractive) {
            e.preventDefault();
            e.stopImmediatePropagation();
            toast({
              title: SHOWROOM_TOAST_TITLE,
              description: "Follow the highlighted step to continue your walkthrough.",
              duration: 2500,
            });
            return;
          }
        }

        el = el.parentElement;
      }
    };
    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [toast, currentTourTarget, tourActive, onJoinMeeting, onNavSessions, onNavDocuments, onActionShare, onNavUndertakings, onNavAudit, onNavObligations, onNavConsent, onNavAttendanceTab]);

  return null;
}

function DemoFetchInterceptor() {
  useEffect(() => {
    installDemoFetchInterceptor(() => {});
    return () => {
      uninstallDemoFetchInterceptor();
    };
  }, []);
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
  const { toast } = useToast();
  const { flowState, advanceFlow, markCaseVisible } = useDemoFlow();
  const [tourRestartTrigger, setTourRestartTrigger] = useState(0);
  const [tourResumeTrigger, setTourResumeTrigger] = useState(0);
  const [demoScreen, setDemoScreen] = useState<"dashboard" | "case">("dashboard");
  const [currentTourTarget, setCurrentTourTarget] = useState<string | null>(null);
  const [tourActive, setTourActive] = useState(true);
  const tourRef = useRef<DemoTourHandle>(null);
  const attendanceScrollFiredRef = useRef(false);

  const handleRestartTour = useCallback(() => setTourRestartTrigger((v) => v + 1), []);

  const handleStepTargetChange = useCallback((target: string | null) => {
    setCurrentTourTarget(target);
    setTourActive(target !== null);
    if (target === "button-send-link") {
      const emailInput = document.querySelector('[data-testid="input-recipient-email"]') as HTMLInputElement | null;
      const nameInput = document.querySelector('[data-testid="input-recipient-name"]') as HTMLInputElement | null;
      const capturedEmail = emailInput?.value || null;
      const capturedName = nameInput?.value || null;
      const smsInput = document.querySelector('[data-testid="input-sms-phone"]') as HTMLInputElement | null;
      const capturedMobile = smsInput?.value || null;
      fetch("/api/demo/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceArea,
          practiceAreaLabel: practiceArea,
          name: capturedName || name || null,
          email: capturedEmail,
          mobile: capturedMobile,
        }),
      }).catch(() => {});
    }
    if (target === "nav-obligations") {
      setShareModalOpen(false);
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
    }
  }, [qc, practiceArea, name]);

  const advanceTo = useCallback((stepIndex: number) => {
    tourRef.current?.advanceTourToStep(stepIndex);
  }, []);

  const handleStepAutoAction = useCallback((stepId: number) => {
    if (stepId === 6) {
      setTimeout(() => {
        const firstExpandBtn = document.querySelector('[data-testid^="button-expand-session-"]') as HTMLElement | null;
        if (firstExpandBtn) {
          firstExpandBtn.click();
        }
      }, 600);
      advanceTo(6);
    } else if (stepId === 11) {
      const mainContent = document.querySelector('[data-testid="case-detail-main"]') || document.querySelector('main');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo(0, 0);
      advanceTo(11);
    } else if (stepId === 12) {
      setShareModalOpen(true);
      advanceTo(12);
    } else if (stepId === 20) {
      advanceTo(20);
    } else if (stepId === 21) {
      setTimeout(() => {
        advanceTo(21);
      }, 1500);
    }
  }, [qc, advanceTo, practiceArea, name]);

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

  const handleNavSessions = useCallback(() => {
  }, []);

  const handleNavDocuments = useCallback(() => {
    advanceTo(8);
  }, [advanceTo]);

  const handleNavAttendanceTab = useCallback(() => {
    if (attendanceScrollFiredRef.current) return;
    attendanceScrollFiredRef.current = true;
    tourRef.current?.markActionCompleted();
    setTimeout(() => {
      const exportBtn = document.querySelector('[data-testid="button-export"]');
      if (exportBtn) exportBtn.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 600);
    setTimeout(() => {
      const main = document.querySelector("main");
      if (main) main.scrollBy({ top: 520, behavior: "smooth" });
    }, 1400);
  }, []);

  useEffect(() => {
    if (currentTourTarget !== "tab-attendance") {
      attendanceScrollFiredRef.current = false;
    }
  }, [currentTourTarget]);

  const [shareModalOpen, setShareModalOpen] = useState(false);

  const handleActionShare = useCallback(() => {
    setShareModalOpen(true);
    advanceTo(11);
  }, [advanceTo]);

  const handleNavUndertakings = useCallback(() => {
    advanceTo(14);
  }, [advanceTo]);

  const handleNavObligations = useCallback(() => {
    advanceTo(14);
  }, [advanceTo]);

  const handleNavConsent = useCallback(() => {
    advanceTo(15);
  }, [advanceTo]);

  const handleNavAudit = useCallback(() => {
    advanceTo(16);
  }, [advanceTo]);

  const handleTourComplete = useCallback(() => {
    window.open(CALENDLY_URL, "_blank");
  }, []);

  const isProcessing = flowState === "processing";

  return (
    <>
      <DemoFetchInterceptor />
      <DemoInteractionGuard
        currentTourTarget={currentTourTarget}
        tourActive={tourActive}
        onJoinMeeting={handleJoinMeeting}
        onNavSessions={handleNavSessions}
        onNavDocuments={handleNavDocuments}
        onActionShare={handleActionShare}
        onNavUndertakings={handleNavUndertakings}
        onNavAudit={handleNavAudit}
        onNavObligations={handleNavObligations}
        onNavConsent={handleNavConsent}
        onNavAttendanceTab={handleNavAttendanceTab}
      />
      <div className="min-h-screen bg-background pb-16 overflow-x-hidden">
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
          onStepTargetChange={handleStepTargetChange}
          onStepAutoAction={handleStepAutoAction}
          onComplete={handleTourComplete}
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

      <ShareLinkModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        caseId={DEMO_CASE_ID}
        caseTitle={caseTitle}
        userRole="Partner"
      />
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
      caseTitle: `Child Arrangements Order \u2014 ${clientName}`,
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
