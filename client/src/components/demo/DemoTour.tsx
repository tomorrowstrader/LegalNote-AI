import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowRight } from "lucide-react";

export interface TourStep {
  id: number;
  target: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
  requiresNavigation?: boolean;
  navigationHint?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    target: "button-join-meeting-dashboard",
    title: "Your next client meeting is in 10 minutes",
    description: "Click Join Meeting to connect LegalNote to the call — it will record, transcribe, and document the session automatically.",
    placement: "bottom",
  },
  {
    id: 2,
    target: "tab-review",
    title: "Cases ready for review",
    description: "When a recording is processed and documents are generated, the case moves here for your approval. One click to review — no chasing.",
    placement: "bottom",
  },
  {
    id: 3,
    target: "row-case-demo-case-family-001",
    title: "Open the demo matter",
    description: "Click the case row to open the full matter — transcript, attendance note, audit trail, and compliance readiness all in one place.",
    placement: "bottom",
  },
  {
    id: 4,
    target: "nav-audit",
    title: "Consent confirmed in audit trail",
    description: "Your verbal consent confirmation was logged automatically when you clicked 'Yes, consent confirmed' — timestamped and HMAC-sealed. Every consent event is cryptographically verifiable.",
    placement: "right",
    requiresNavigation: true,
    navigationHint: "Open the demo case and navigate to the Audit Trail tab.",
  },
  {
    id: 5,
    target: "nav-sessions",
    title: "Every meeting, captured and linked",
    description: "Each session shows the date, duration, and a full diarized transcript produced automatically from the recording.",
    placement: "right",
    requiresNavigation: true,
    navigationHint: "Open the demo case to see this step.",
  },
  {
    id: 6,
    target: "nav-documents",
    title: "Attendance note produced from the recording",
    description: "From a recorded meeting, LegalNote compiled this structured attendance note — no typing required. Review and approve in two clicks.",
    placement: "right",
    requiresNavigation: true,
    navigationHint: "Open the demo case to see this step.",
  },
  {
    id: 7,
    target: "nav-audit",
    title: "Tamper-evident audit trail",
    description: "Every event — consent, recording, transcript, approval, share — is logged with an HMAC-SHA256 fingerprint. Cryptographic proof if anything is ever disputed.",
    placement: "right",
    requiresNavigation: true,
    navigationHint: "Open the demo case to see this step.",
  },
  {
    id: 8,
    target: "nav-undertakings",
    title: "Undertakings tracked automatically",
    description: "Undertakings given to clients and third parties are extracted from recordings and tracked. Outstanding items are flagged until resolved.",
    placement: "right",
    requiresNavigation: true,
    navigationHint: "Open the demo case to see this step.",
  },
  {
    id: 9,
    target: "demo-cta-bar",
    title: "Ready to see this in your firm?",
    description: "Book a personalised 15-minute walkthrough with a LegalNote solicitor. We'll show you exactly how it works for your practice area — no obligation.",
    placement: "top",
  },
];

const TOUR_KEY = "legalnote_demo_tour_complete_v6";

interface TooltipPosition {
  top?: number;
  left?: number;
}

interface DemoTourProps {
  restartTrigger: number;
  practiceArea?: string;
  startAtStep?: number;
  resumeTrigger?: number;
}

export function DemoTour({ restartTrigger, practiceArea, startAtStep, resumeTrigger }: DemoTourProps) {
  const tourKey = practiceArea ? `${TOUR_KEY}_${practiceArea}` : TOUR_KEY;
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 100, left: 20 });
  const [visible, setVisible] = useState(false);
  const [elementMissing, setElementMissing] = useState(false);
  const positionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  const positionTooltip = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(`[data-testid="${currentStep.target}"]`);
    if (!el) {
      setElementMissing(true);
      setTooltipPos({ top: 80, left: 20 });
      setVisible(true);
      return;
    }
    setElementMissing(false);
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
    if (resumeTrigger && resumeTrigger > 0) {
      const idx = startAtStep !== undefined ? startAtStep : 0;
      localStorage.removeItem(tourKey);
      setActive(true);
      setStepIndex(idx);
    }
  }, [resumeTrigger, tourKey, startAtStep]);

  useEffect(() => {
    if (!active || !currentStep) return;
    setVisible(false);
    setElementMissing(false);
    if (positionTimerRef.current) clearTimeout(positionTimerRef.current);
    positionTimerRef.current = setTimeout(() => {
      positionTooltip();
    }, 600);
    return () => {
      if (positionTimerRef.current) clearTimeout(positionTimerRef.current);
    };
  }, [active, currentStep, positionTooltip]);

  useEffect(() => {
    if (!active || !currentStep || !elementMissing) return;
    const interval = setInterval(() => {
      const el = document.querySelector(`[data-testid="${currentStep.target}"]`);
      if (el) {
        setElementMissing(false);
        positionTooltip();
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [active, currentStep, elementMissing, positionTooltip]);

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
      <div
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{ background: "rgba(0,0,0,0.10)" }}
      />
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

        {elementMissing && currentStep.navigationHint ? (
          <div className="flex items-start gap-2 mb-3 p-2 rounded-md bg-muted/50 border border-border">
            <ArrowRight className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">{currentStep.navigationHint}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            {currentStep.description}
          </p>
        )}

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
