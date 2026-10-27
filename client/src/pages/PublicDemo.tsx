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
  "button-capture": "Recording is available in your firm's live account, follow the walkthrough to continue.",
  "button-new-note": "Recording is available in your firm's live account, follow the walkthrough to continue.",
  "button-log-call-dashboard": "Call logging is available in your firm's live account.",
  "button-record-new-session": "Recording is available in your firm's live account.",
  "button-download-documents": "Document export is available in your firm's live account.",
  "link-capture": "Follow the walkthrough to see how recording works in this showroom.",
  "link-new-note": "Follow the walkthrough to see how recording works in this showroom.",
  "link-cases": "Explore the cases shown in this showroom, follow the walkthrough to continue.",
  "link-home": "You are exploring the LegalNote showroom. Follow the steps to see the full experience.",
  "more-link-capture": "Follow the walkthrough to see how recording works.",
  "more-link-new-note": "Follow the walkthrough to see how recording works.",
  "more-link-cases": "Case management is available in your firm's live account.",
  "mobile-link-capture": "Follow the walkthrough to see how recording works.",
  "mobile-link-new-note": "Follow the walkthrough to see how recording works.",
  "mobile-link-saved-cases": "Case management is available in your firm's live account.",
  "button-quick-record": "Follow the walkthrough, recording is demonstrated through Join Meeting.",
  "button-stop-quick-record": "Follow the walkthrough, recording is demonstrated through Join Meeting.",
  "button-download-word": "Document export to Word is available in your firm's live account.",
  "button-download-pdf": "Document export to PDF is available in your firm's live account.",
  "button-export": "Export is available in your firm's live account.",
  "button-play-pause": "Full playback isn't available in this showroom - in your account, this plays the complete recording synced to the transcript.",
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
  onNavTranscriptTab: () => void;
  onNavClientLetterTab: () => void;
  onGapIndicatorTap: () => void;
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
  onNavTranscriptTab,
  onNavClientLetterTab,
  onGapIndicatorTap,
}: DemoInteractionGuardProps) {
  const { toast } = useToast();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // ── Tab checks use closest() so taps on child <span> elements are caught ──
      if (target.closest('[data-testid="tab-attendance"]')) {
        if (currentTourTarget === "tab-attendance" || currentTourTarget === "tab-transcript" || currentTourTarget === "tab-summary") {
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
        if (currentTourTarget === "tab-transcript" || currentTourTarget === "tab-attendance" || currentTourTarget === "button-gap-indicator" || currentTourTarget === "tab-summary") {
          if (currentTourTarget === "tab-transcript") {
            setTimeout(() => {
              const badge = document.querySelector('[data-testid="badge-diarized"]');
              if (badge) badge.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
            }, 200);
            onNavTranscriptTab();
          }
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        toast({ title: SHOWROOM_TOAST_TITLE, description: "Follow the walkthrough to reach the transcript step.", duration: 3000 });
        return;
      }

      if (target.closest('[data-testid="tab-summary"]')) {
        if (currentTourTarget === "tab-summary" || currentTourTarget === "tab-transcript") {
          if (currentTourTarget === "tab-summary") {
            onNavClientLetterTab();
          }
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        toast({ title: SHOWROOM_TOAST_TITLE, description: "Follow the walkthrough to reach the client letter.", duration: 3000 });
        return;
      }

      // Walk the FULL ancestor chain checking every known testid first - a
      // tap usually lands on an inner span/icon, not the tagged element
      // itself, so this has to reach all the way up before giving up.
      // Deliberately a separate pass from the generic pass-through/block
      // logic below: that logic used to run per-ancestor too, and its own
      // "is this inside the current tour target" check (via closest, which
      // matches on an inner span just as well) would fire on the very first
      // iteration and return - before the loop ever walked up far enough to
      // reach the real nav-sessions/nav-obligations/etc. match. That left
      // real taps on the highlighted target silently doing nothing: the
      // underlying button still navigated (its own click handler doesn't go
      // through here), but the tour never heard about it and sat stuck on
      // "Tap the highlighted area" with nothing left to click.
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
          onNavSessions();
          return;
        }

        if (testId === "button-toggle-case-sidebar") {
          return;
        }

        if (testId === "button-gap-indicator" || testId.startsWith("button-gap-citation-")) {
          if (currentTourTarget === "button-gap-indicator") {
            onGapIndicatorTap();
          }
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

        if (testId === "action-share") {
          // Not part of the guided tour, but still a real, working feature -
          // always redirect to the demo's own share modal rather than the
          // live app's (which would hit real, non-mocked endpoints).
          e.preventDefault();
          e.stopImmediatePropagation();
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
            title: SHOWROOM_TOAST_TITLE,
            description: DEMO_CLICK_GUARDS[testId],
            duration: 3000,
          });
          return;
        }

        if (testId.startsWith("button-expand-session-") || testId.startsWith("button-open-session-docs-")) {
          return;
        }

        el = el.parentElement;
      }

      // Nothing specific matched anywhere in the chain - apply the generic
      // "stay on the guided path" gating against the original click target.
      if (tourActive && currentTourTarget) {
        const isOnTourCard = !!target.closest("[data-testid='tour-tooltip']");
        if (isOnTourCard) return;

        const isOnFinalImpact = !!target.closest("[data-testid='demo-final-impact']");
        if (isOnFinalImpact) return;

        const isOnTarget = !!target.closest(`[data-testid="${currentTourTarget}"]`);
        if (isOnTarget) return;

        const isInteractive = !!target.closest("button, a, input, select, textarea");
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
    };
    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [toast, currentTourTarget, tourActive, onJoinMeeting, onNavSessions, onNavDocuments, onActionShare, onNavUndertakings, onNavAudit, onNavObligations, onNavConsent, onNavAttendanceTab, onNavTranscriptTab, onNavClientLetterTab, onGapIndicatorTap]);

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

  /** Open the collapsed icon-only sidebar so the nav labels are readable, not just icons. */
  const expandSidebarIfCollapsed = useCallback(() => {
    const toggleBtn = document.querySelector('[data-testid="button-toggle-case-sidebar"]') as HTMLElement | null;
    if (toggleBtn?.getAttribute("title") === "Expand menu") {
      toggleBtn.click();
    }
  }, []);

  const DEMO_GAP_FILL_TEXT =
    "The solicitor advised the client to defer consenting to the Portugal holiday until proceedings are issued, so the automatic stay formalises the position and removes any risk of unilateral travel.";

  /** Show the reasoning gap actually getting closed: fade the flagged chip, drop in the real wording, pulse it. */
  const fillDemoReasoningGap = useCallback(() => {
    const chip = document.querySelector('[data-reasoning-gap-index="0"]') as HTMLElement | null;
    if (chip) {
      chip.style.transition = "opacity 300ms ease";
      chip.style.opacity = "0";
    }
    window.setTimeout(() => {
      const docs = qc.getQueryData<Array<Record<string, unknown>>>([`/api/cases/${DEMO_CASE_ID}/documents`]);
      if (!docs) return;
      let replaced = false;
      const updated = docs.map((d) => {
        const content = d.content;
        if (replaced || d.type !== "attendance_note" || typeof content !== "string" || !/<!--\s*REASONING_GAP:/.test(content)) {
          return d;
        }
        replaced = true;
        return {
          ...d,
          content: content.replace(/<!--\s*REASONING_GAP:[^>]*-->/, DEMO_GAP_FILL_TEXT),
          reasoningGapsFilled: (typeof d.reasoningGapsFilled === "number" ? d.reasoningGapsFilled : 0) + 1,
        };
      });
      if (!replaced) return;
      qc.setQueryData([`/api/cases/${DEMO_CASE_ID}/documents`], updated);
      window.setTimeout(() => {
        const filledEl = Array.from(document.querySelectorAll("main p")).find((p) =>
          p.textContent?.includes(DEMO_GAP_FILL_TEXT.slice(0, 50)),
        ) as HTMLElement | undefined;
        if (filledEl) {
          const pulseClasses = ["ring-2", "ring-emerald-500", "ring-offset-2", "dark:ring-offset-background", "bg-emerald-50", "dark:bg-emerald-950/30", "rounded-sm", "transition-shadow", "duration-300"];
          filledEl.classList.add(...pulseClasses);
          window.setTimeout(() => filledEl.classList.remove(...pulseClasses), 2200);
        }
      }, 200);
    }, 320);
  }, [qc]);

  const prevTourTargetRef = useRef<string | null>(null);
  const handleStepTargetChange = useCallback((target: string | null) => {
    if (prevTourTargetRef.current === "button-gap-indicator" && target !== "button-gap-indicator") {
      fillDemoReasoningGap();
    }
    if (target === "nav-sessions") {
      expandSidebarIfCollapsed();
    }
    prevTourTargetRef.current = target;
    setCurrentTourTarget(target);
    setTourActive(target !== null);
  }, [fillDemoReasoningGap, expandSidebarIfCollapsed]);

  const advanceTo = useCallback((stepIndex: number, completed?: boolean) => {
    tourRef.current?.advanceTourToStep(stepIndex, completed);
  }, []);

  const navAutoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Click a sidebar nav item -> show its step, then move on by itself after a beat - no extra tap needed. */
  const scheduleNavAutoAdvance = useCallback((nextStepIndex: number, delayMs: number) => {
    if (navAutoAdvanceTimerRef.current) clearTimeout(navAutoAdvanceTimerRef.current);
    navAutoAdvanceTimerRef.current = setTimeout(() => {
      advanceTo(nextStepIndex);
    }, delayMs);
  }, [advanceTo]);

  useEffect(() => {
    return () => {
      if (navAutoAdvanceTimerRef.current) clearTimeout(navAutoAdvanceTimerRef.current);
    };
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

  /** Sessions: real tap required, confirms this matter's whole session history before diving into one session's docs. */
  const handleNavSessions = useCallback(() => {
    advanceTo(7);
  }, [advanceTo]);

  const handleNavDocuments = useCallback(() => {
    advanceTo(7);
  }, [advanceTo]);

  /** Attendance tab: scroll into the note, then land on the flagged reasoning gap for the user to tap themselves. */
  const handleNavAttendanceTab = useCallback(() => {
    if (attendanceScrollFiredRef.current) return;
    attendanceScrollFiredRef.current = true;
    setTimeout(() => {
      // There are two <main> landmarks on the page (the app shell's and CaseDetail's own
      // content pane) - pick whichever one actually has room to scroll.
      const main = Array.from(document.querySelectorAll("main")).find((m) => m.scrollHeight > m.clientHeight + 2);
      if (main) main.scrollBy({ top: 420, behavior: "smooth" });
    }, 600);
    setTimeout(() => {
      advanceTo(8);
    }, 1800);
  }, [advanceTo]);

  useEffect(() => {
    if (currentTourTarget !== "tab-attendance") {
      attendanceScrollFiredRef.current = false;
    }
  }, [currentTourTarget]);

  /** Reasoning gap: real tap on the chip or the button (either fires scrollToReasoningGap) unlocks "Got it". */
  const handleGapIndicatorTap = useCallback(() => {
    tourRef.current?.markActionCompleted();
  }, []);

  const transcriptAdvanceFiredRef = useRef(false);
  /** Transcript tab: real tap required (no "Got it" shortcut), with a beat to actually see the transcript. */
  const handleNavTranscriptTab = useCallback(() => {
    if (transcriptAdvanceFiredRef.current) return;
    transcriptAdvanceFiredRef.current = true;
    setTimeout(() => {
      advanceTo(10);
    }, 2000);
  }, [advanceTo]);

  useEffect(() => {
    if (currentTourTarget !== "tab-transcript") {
      transcriptAdvanceFiredRef.current = false;
    }
  }, [currentTourTarget]);

  const clientLetterAdvanceFiredRef = useRef(false);
  /** Client Letter tab: real tap required, then expand the sidebar for the nav steps ahead. */
  const handleNavClientLetterTab = useCallback(() => {
    if (clientLetterAdvanceFiredRef.current) return;
    clientLetterAdvanceFiredRef.current = true;
    expandSidebarIfCollapsed();
    setTimeout(() => {
      advanceTo(11);
    }, 1500);
  }, [advanceTo, expandSidebarIfCollapsed]);

  useEffect(() => {
    if (currentTourTarget !== "tab-summary") {
      clientLetterAdvanceFiredRef.current = false;
    }
  }, [currentTourTarget]);

  const [shareModalOpen, setShareModalOpen] = useState(false);

  /** Not part of the guided tour, but Secure Share stays a real, usable feature. */
  const handleActionShare = useCallback(() => {
    setShareModalOpen(true);
  }, []);

  /**
   * Click the icon -> navigate, the real tap already satisfies this step's
   * action so show "Got it" immediately (don't make the user wait on a
   * blind timer with nothing to click) - then move on by itself after a
   * beat if they don't click it first.
   */
  const handleNavUndertakings = useCallback(() => {
    advanceTo(11, true);
    scheduleNavAutoAdvance(12, 4000);
  }, [advanceTo, scheduleNavAutoAdvance]);

  const handleNavObligations = useCallback(() => {
    advanceTo(11, true);
    scheduleNavAutoAdvance(12, 4000);
  }, [advanceTo, scheduleNavAutoAdvance]);

  const handleNavConsent = useCallback(() => {
    advanceTo(12, true);
    scheduleNavAutoAdvance(13, 4000);
  }, [advanceTo, scheduleNavAutoAdvance]);

  const handleNavAudit = useCallback(() => {
    advanceTo(13, true);
    scheduleNavAutoAdvance(14, 2500);
  }, [advanceTo, scheduleNavAutoAdvance]);

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
        onNavTranscriptTab={handleNavTranscriptTab}
        onNavClientLetterTab={handleNavClientLetterTab}
        onGapIndicatorTap={handleGapIndicatorTap}
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
