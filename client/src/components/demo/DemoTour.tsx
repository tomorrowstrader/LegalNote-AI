import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { DemoScreen } from "./DemoShell";

export interface TourStep {
  id: number;
  target: string;
  screen: DemoScreen;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    target: "card-compliance-score",
    screen: "dashboard",
    title: "Your compliance score, at a glance",
    description: "LegalNote calculates your firm's compliance readiness in real time — from active obligations, overdue items, and matter risk levels. No manual checking required.",
    placement: "right",
  },
  {
    id: 2,
    target: "card-obligations",
    screen: "dashboard",
    title: "Overdue obligations — flagged automatically",
    description: "Every obligation is tracked against its deadline. When something is overdue, LegalNote surfaces it here so nothing slips through.",
    placement: "left",
  },
  {
    id: 3,
    target: "case-session-card-first",
    screen: "case-detail",
    title: "Every meeting, captured and linked",
    description: "Each session card shows the date, duration, attendees, and a summary produced automatically from the recording. The lead session for this matter has a full diarized transcript.",
    placement: "bottom",
  },
  {
    id: 4,
    target: "case-transcript-preview",
    screen: "case-detail",
    title: "AI produces the full transcript — instantly",
    description: "Click 'Transcript' to see LegalNote's AI transcription in action: 2,000+ words, diarized by speaker, HMAC-signed for tamper-evidence. No manual transcription. Solicitor reviews, not types.",
    placement: "bottom",
  },
  {
    id: 5,
    target: "attendance-note-body",
    screen: "document",
    title: "This attendance note was produced automatically",
    description: "From a recording, LegalNote generated this structured attendance note — no manual typing. Your solicitor reviewed and approved it in two clicks.",
    placement: "top",
  },
  {
    id: 6,
    target: "document-toolbar",
    screen: "document",
    title: "Export in any format — one click",
    description: "Export to PDF or Word, print, or share via a secure read-only link — directly from the attendance note. In your live environment these are fully functional.",
    placement: "bottom",
  },
  {
    id: 7,
    target: "audit-trail-list",
    screen: "audit",
    title: "Tamper-evident audit trail",
    description: "Every event — recording, transcript, approval, share — is logged with an HMAC-SHA256 fingerprint. If anything is disputed, you have cryptographic proof.",
    placement: "top",
  },
  {
    id: 8,
    target: "demo-cta-bar",
    screen: "audit",
    title: "Ready to see this in your firm?",
    description: "Book a personalised 20-minute walkthrough with a LegalNote solicitor. We'll show you exactly how it works for your practice area — no obligation.",
    placement: "top",
  },
];

const TOUR_KEY = "legalnote_demo_tour_complete_v4";

interface TooltipPosition {
  top?: number;
  left?: number;
}

interface DemoTourProps {
  currentScreen: DemoScreen;
  onNavigate: (screen: DemoScreen) => void;
  restartTrigger: number;
  practiceArea?: string;
}

export function DemoTour({ currentScreen, onNavigate, restartTrigger, practiceArea }: DemoTourProps) {
  const tourKey = practiceArea ? `${TOUR_KEY}_${practiceArea}` : TOUR_KEY;
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 100, left: 20 });
  const [visible, setVisible] = useState(false);
  const positionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  const positionTooltip = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(`[data-demo-target="${currentStep.target}"]`);
    if (!el) {
      setTooltipPos({ top: 80, left: 20 });
      setVisible(true);
      return;
    }
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const margin = 14;
    const placement = currentStep.placement || "bottom";
    let top = 0;
    let left = 0;

    if (placement === "bottom") {
      top = rect.bottom + margin + window.scrollY;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    } else if (placement === "top") {
      top = rect.top - tooltipHeight - margin + window.scrollY;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    } else if (placement === "right") {
      top = rect.top + window.scrollY;
      left = rect.right + margin;
    } else if (placement === "left") {
      top = rect.top + window.scrollY;
      left = rect.left - tooltipWidth - margin;
    }

    left = Math.min(left, window.innerWidth - tooltipWidth - 8);
    left = Math.max(8, left);
    top = Math.max(70, top);

    setTooltipPos({ top, left });
    setVisible(true);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentStep]);

  useEffect(() => {
    const done = localStorage.getItem(tourKey);
    if (!done) {
      setActive(true);
      setStepIndex(0);
    }
  }, [tourKey]);

  useEffect(() => {
    if (restartTrigger > 0) {
      localStorage.removeItem(tourKey);
      setActive(true);
      setStepIndex(0);
    }
  }, [restartTrigger, tourKey]);

  useEffect(() => {
    if (!active || !currentStep) return;
    if (currentStep.screen !== currentScreen) {
      onNavigate(currentStep.screen);
      setVisible(false);
      return;
    }
    setVisible(false);
    if (positionTimerRef.current) clearTimeout(positionTimerRef.current);
    positionTimerRef.current = setTimeout(() => {
      positionTooltip();
    }, 500);
    return () => {
      if (positionTimerRef.current) clearTimeout(positionTimerRef.current);
    };
  }, [active, currentStep, currentScreen, positionTooltip, onNavigate]);

  const handleNext = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setActive(false);
    setVisible(false);
    localStorage.setItem(tourKey, "1");
  };

  if (!active || !currentStep || !visible) return null;

  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{ background: "rgba(0,0,0,0.10)" }}
      />
      {/* Tooltip */}
      <div
        className="fixed z-[70] w-80 bg-background border border-border rounded-md shadow-lg p-4"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        data-testid="tour-tooltip"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
              {currentStep.id}
            </span>
            <p className="text-sm font-semibold leading-tight">{currentStep.title}</p>
          </div>
          <button
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
            data-testid="button-tour-skip"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          {currentStep.description}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              data-testid="button-tour-close"
            >
              Skip tour
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              data-testid="button-tour-next"
            >
              {isLast ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1 justify-center mt-3">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === stepIndex ? "w-4 bg-primary" : "w-1 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
