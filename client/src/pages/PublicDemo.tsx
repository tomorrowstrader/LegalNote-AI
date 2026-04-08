import { useMemo, useState, useCallback, useEffect, createContext, useContext } from "react";
import { useParams, useSearch, Router, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { FocusModeProvider } from "@/contexts/FocusModeContext";
import {
  createDemoQueryClient,
  DEMO_CASE_ID,
  installDemoFetchInterceptor,
  uninstallDemoFetchInterceptor,
} from "@/demo/createDemoQueryClient";
import { DemoBadge } from "@/demo/DemoBadge";
import { DemoTour } from "@/components/demo/DemoTour";
import { LOCKED_CASE_IDS, DemoLockedOverlayManager } from "@/demo/DemoLockedOverlay";
import TopNavigation from "@/components/TopNavigation";
import Dashboard from "@/pages/Dashboard";
import CaseDetail from "@/pages/CaseDetail";

export const DemoModeContext = createContext<{
  isDemoMode: boolean;
  demoCaseId: string;
  lockedCaseIds: string[];
}>({
  isDemoMode: false,
  demoCaseId: "",
  lockedCaseIds: [],
});

export function useDemoMode() {
  return useContext(DemoModeContext);
}

const DEMO_CLICK_GUARDS: Record<string, { title: string; description: string }> = {
  "button-new-note": {
    title: "Demo mode",
    description: "Start by recording a meeting in your live account.",
  },
  "button-join-meeting-dashboard": {
    title: "Demo mode",
    description: "Meeting joining is not available in the demo environment.",
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

function DemoInteractionGuard() {
  const { toast } = useToast();
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      let el = e.target as HTMLElement | null;
      while (el) {
        const testId = el.getAttribute("data-testid") || "";
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
  }, [toast]);
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

export default function PublicDemo() {
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

  const demoQueryClient = useMemo(() => {
    return createDemoQueryClient({
      name: firstName || "Rachel",
      lastName: resolvedLastName,
      firm: firmName,
      practiceArea,
      sraNumber,
      rate,
    });
  }, []);

  const [tourRestartTrigger, setTourRestartTrigger] = useState(0);
  const handleRestartTour = useCallback(() => setTourRestartTrigger((v) => v + 1), []);

  const demoContextValue = useMemo(
    () => ({ isDemoMode: true, demoCaseId: DEMO_CASE_ID, lockedCaseIds: LOCKED_CASE_IDS }),
    []
  );

  return (
    <DemoModeContext.Provider value={demoContextValue}>
      <QueryClientProvider client={demoQueryClient}>
        <TooltipProvider>
          <FocusModeProvider>
            <DemoFetchInterceptor />
            <DemoInteractionGuard />
            <div className="min-h-screen bg-background pb-16">
              <TopNavigation onRestartTour={handleRestartTour} />
              <DemoBadge />
              <DemoTour
                restartTrigger={tourRestartTrigger}
                practiceArea={practiceArea}
              />
              <DemoLockedOverlayManager />
              <div className="pt-16">
                <Router base={`/demo/${practiceArea}`}>
                  <Route path="/" component={Dashboard} />
                  <Route path="/case/:id" component={CaseDetail} />
                </Router>
              </div>
            </div>
            <Toaster />
          </FocusModeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </DemoModeContext.Provider>
  );
}
