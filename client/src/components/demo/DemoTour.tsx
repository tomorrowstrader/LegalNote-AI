import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Volume2, VolumeX } from "lucide-react";

export interface TourStep {
  id: number;
  target: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
  requiresNavigation?: boolean;
  navigationHint?: string;
  actionRequired?: boolean;
  delayMs?: number;
}

const CONSENT_SCRIPT = `"I'm recording this meeting to create accurate attendance notes and evidence proper client care. The audio stays confidential in your case file only, used by me or my direct team if needed, and deleted after 7 days. Do you consent?"`;

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    target: "dashboard-welcome-header",
    title: "No more post-meeting scramble",
    description: "This is your LegalNote dashboard — every active matter, upcoming meeting, and compliance obligation in one place. For neurodivergent fee earners and every solicitor under caseload pressure, no more post-meeting scramble. Removing the documentation burden is both good practice and a reasonable adjustment under the Equality Act 2010.",
    placement: "bottom",
    actionRequired: false,
  },
  {
    id: 2,
    target: "button-join-meeting-dashboard",
    title: "Run this session through Meeting-to-Matter™",
    description: "Tap Join Meeting to run this session through LegalNote's Meeting-to-Matter™ engine. It converts a client conversation into a compliance-ready attendance note, a sealed consent record, and a defensible matter trail. Running entirely in the background while you stay focused on the client.",
    placement: "bottom",
    actionRequired: true,
  },
  {
    id: 3,
    target: "demo-meeting-connect",
    title: "The same script, every time",
    description: CONSENT_SCRIPT,
    placement: "bottom",
    actionRequired: true,
  },
  {
    id: 4,
    target: "demo-consent-confirm",
    title: "Log consent in one tap",
    description: "Your client has just agreed. Tap to log it — timestamped, GDPR Article 7 compliant, HMAC-sealed to the audit trail. The same evidence standard every time, regardless of who runs the meeting.",
    placement: "bottom",
    actionRequired: true,
  },
  {
    id: 5,
    target: "demo-end-recording",
    title: "Meeting complete",
    description: "Tap End Recording when your session is complete. Meeting-to-Matter™ produces your attendance note, extracts obligations, flags any AML risk indicators and conflict of interest changes from the session, and seals the full audit trail — all from one recording.",
    placement: "top",
    actionRequired: true,
    delayMs: 5000,
  },
  {
    id: 6,
    target: "tab-review",
    title: "Ready for your review",
    description: "Your case has moved to Review. LegalNote compiled your attendance note from the recording in under 5 minutes — no typing, no dictation. Click the Review tab.",
    placement: "bottom",
    actionRequired: true,
  },
  {
    id: 7,
    target: "row-case-demo-case-family-001",
    title: "Open the matter",
    description: "Click the case to see your documents, extracted obligations, full transcript, and audit trail — everything in one place.",
    placement: "bottom",
    actionRequired: true,
  },
  {
    id: 8,
    target: "nav-documents",
    title: "Attendance note compiled from the recording",
    description: "Produced in under 5 minutes. No typing. For neurodivergent fee earners — and every solicitor under caseload pressure — removing the transcription burden is a meaningful cognitive load reduction and a reasonable adjustment under the Equality Act 2010.",
    placement: "right",
    actionRequired: true,
  },
  {
    id: 9,
    target: "action-share",
    title: "Send it securely — with SMS authentication",
    description: "Share this attendance note with your client via a secure link. They verify by SMS before accessing it — delivery confirmed, access timestamped, and the entire chain logged to the audit trail.",
    placement: "bottom",
    actionRequired: true,
  },
  {
    id: 10,
    target: "nav-undertakings",
    title: "Obligations extracted from the recording",
    description: "Any undertakings or obligations given during the session were captured automatically from the transcript. Each one is tracked until discharged — flagged, logged, and verifiable.",
    placement: "right",
    actionRequired: true,
  },
  {
    id: 11,
    target: "nav-audit",
    title: "Tamper-evident audit trail",
    description: "Every event — consent, recording, document approval, secure share access — is logged here with a cryptographic fingerprint. The share link access from the previous step is already in this trail. Proof of everything, if it's ever disputed.",
    placement: "right",
    actionRequired: true,
  },
  {
    id: 12,
    target: "action-pi-pack",
    title: "5-minute SRA-ready defence pack",
    description: "If the SRA investigates or a PI claim is made, generate a complete defence pack here — sessions, consent log, documents, audit trail, and a tamper-evidence declaration. Everything bundled in under 5 minutes.",
    placement: "bottom",
    actionRequired: false,
  },
  {
    id: 13,
    target: "demo-cta-bar",
    title: "The gap is real. Most firms don't know it.",
    description: "Solo practitioners and boutique firms are most exposed when things go wrong — and least likely to have the documented processes that protect them. You've just seen what protection looks like in practice. This isn't a nice-to-have. Book a 15-minute call.",
    placement: "top",
    actionRequired: false,
  },
];

const TOUR_KEY = "legalnote_demo_tour_complete_v7";
const VOICE_KEY = "legalnote_demo_voice";

interface TooltipPosition {
  top?: number;
  left?: number;
  isMobileSheet?: boolean;
}

export interface DemoTourHandle {
  advanceTourToStep: (index: number) => void;
}

interface DemoTourProps {
  restartTrigger: number;
  practiceArea?: string;
  startAtStep?: number;
  resumeTrigger?: number;
  name?: string;
  firmName?: string;
  hidden?: boolean;
}

export const DemoTour = forwardRef<DemoTourHandle, DemoTourProps>(function DemoTour(
  { restartTrigger, practiceArea, startAtStep, resumeTrigger, name, firmName, hidden },
  ref
) {
  const tourKey = practiceArea ? `${TOUR_KEY}_${practiceArea}` : TOUR_KEY;
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 100, left: 20 });
  const [visible, setVisible] = useState(false);
  const [elementMissing, setElementMissing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem(VOICE_KEY) !== "off");
  const positionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current);
      audioBlobUrlRef.current = null;
    }
  }, []);

  const playStepAudio = useCallback(async (stepId: number) => {
    stopAudio();
    try {
      const response = await fetch("/api/demo/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId, name, firmName }),
      });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      audioBlobUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch {
    }
  }, [stopAudio, name, firmName]);

  const positionTooltip = useCallback((step?: TourStep) => {
    const s = step ?? currentStep;
    if (!s) return;

    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      const el = document.querySelector(`[data-testid="${s.target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setElementMissing(false);
      setTooltipPos({ isMobileSheet: true });
      setVisible(true);
      return;
    }

    const el = document.querySelector(`[data-testid="${s.target}"]`);
    if (!el) {
      setElementMissing(true);
      setTooltipPos({ top: 80, left: 20 });
      setVisible(true);
      return;
    }
    setElementMissing(false);
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 220;
    const margin = 14;
    const placement = s.placement || "bottom";
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
    top = Math.min(top, window.innerHeight - tooltipHeight - 24 + window.scrollY);

    setTooltipPos({ top, left });
    setVisible(true);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentStep]);

  useImperativeHandle(ref, () => ({
    advanceTourToStep: (index: number) => {
      if (!active) return;
      const step = TOUR_STEPS[index];
      if (!step) return;
      stopAudio();

      if (step.delayMs && step.delayMs > 0) {
        setVisible(false);
        setStepIndex(index);
        positionTimerRef.current = setTimeout(() => {
          positionTooltip(step);
        }, step.delayMs);
      } else {
        setStepIndex(index);
      }
    },
  }), [active, stopAudio, positionTooltip]);

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
    if (currentStep.delayMs && currentStep.delayMs > 0) {
      return;
    }
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
    if (!active || !currentStep || !visible) return;
    if (voiceEnabled) {
      playStepAudio(currentStep.id);
    }
    return () => {
      stopAudio();
    };
  }, [active, currentStep, visible, voiceEnabled, playStepAudio, stopAudio]);

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

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const handleNext = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    stopAudio();
    setActive(false);
    setVisible(false);
    localStorage.setItem(tourKey, "1");
  };

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    localStorage.setItem(VOICE_KEY, next ? "on" : "off");
    if (!next) {
      stopAudio();
    } else if (active && currentStep && visible) {
      playStepAudio(currentStep.id);
    }
  };

  if (!active || !currentStep || !visible || hidden) return null;

  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isFirst = stepIndex === 0;
  const isActionRequired = currentStep.actionRequired === true;

  const isConsentStep = currentStep.id === 3;

  const tooltipContent = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
          {currentStep.id}
        </span>
        <p className="text-sm font-semibold leading-tight">{currentStep.title}</p>
      </div>

      {elementMissing && currentStep.navigationHint ? (
        <div className="flex items-start gap-2 mb-3 p-2 rounded-md bg-muted/50 border border-border">
          <ArrowRight className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">{currentStep.navigationHint}</p>
        </div>
      ) : isConsentStep ? (
        <div className="mb-3 space-y-2">
          <div className="rounded-md bg-muted/60 border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground font-medium mb-1.5">Standardized consent script:</p>
            <p className="text-xs text-foreground leading-relaxed italic">{currentStep.description}</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This script is standardized by the platform — every fee earner reads identical GDPR-compliant wording, every time. No guesswork, no variation. Tap Connect to continue.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          {currentStep.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <button
            onClick={toggleVoice}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-tour-voice-toggle"
            title={voiceEnabled ? "Mute voice guidance" : "Enable voice guidance"}
          >
            {voiceEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        {isActionRequired ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/70" />
            </span>
            Waiting...
          </div>
        ) : (
          <Button
            size="sm"
            onClick={isLast ? handleComplete : handleNext}
            data-testid="button-tour-next"
          >
            {isLast ? "Finish" : isFirst ? "Got it \u2192" : "Got it \u2192"}
          </Button>
        )}
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
    </>
  );

  if (tooltipPos.isMobileSheet) {
    return (
      <>
        <div
          className="fixed inset-0 z-[60] pointer-events-none"
          style={{ background: "rgba(0,0,0,0.10)" }}
        />
        <div
          className="fixed z-[70] bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-lg shadow-lg p-4"
          data-testid="tour-tooltip"
        >
          {tooltipContent}
        </div>
      </>
    );
  }

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
        {tooltipContent}
      </div>
    </>
  );
});
