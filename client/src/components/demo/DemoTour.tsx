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
  autoAdvanceMs?: number;
  animatedCursor?: boolean;
  cursorTarget?: string;
  autoClick?: boolean;
  autoAction?: boolean;
  yellowWash?: boolean;
  fullScreenCard?: boolean;
}

const NAV_TARGETS = ["nav-sessions", "nav-documents", "nav-obligations", "nav-undertakings", "nav-consent", "nav-audit"];

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    target: "dashboard-welcome-header",
    title: "No more post-meeting scramble",
    description: "This is your LegalNote dashboard: every active matter, upcoming meeting, and compliance obligation in one place. No post-meeting typing, no dictation, no missed obligations.",
    placement: "bottom",
    actionRequired: false,
  },
  {
    id: 2,
    target: "button-join-meeting-dashboard",
    title: "Run this consultation through Meeting-to-Matter\u2122",
    description: "Tap Join Meeting to run this session through Meeting-to-Matter\u2122. One recording becomes a compliance-ready attendance note, a sealed consent record, and a defensible matter trail, while you stay focused on the client.",
    placement: "bottom",
    actionRequired: true,
  },
  {
    id: 3,
    target: "demo-meeting-connect",
    title: "Join through a compliance-ready environment",
    description: "Your meeting connects through a platform built for compliance: consent capture, GDPR retention, sealed audit trail, all handled by default. Tap Connect to join.",
    placement: "top",
    actionRequired: true,
  },
  {
    id: 4,
    target: "demo-consent-confirm",
    title: "Log consent in one tap",
    description: "Your client has agreed. Tap to log it: timestamped, GDPR Article 7 compliant, sealed to the audit trail. The same evidence standard every time.",
    placement: "bottom",
    actionRequired: true,
  },
  {
    id: 5,
    target: "demo-end-recording",
    title: "Wrap up the session",
    description: "Tap End Recording when your session is complete. Meeting-to-Matter\u2122 compiles your attendance note, extracts obligations, flags AML indicators, and seals the full audit trail from one recording.",
    placement: "top",
    actionRequired: true,
  },
  {
    id: 6,
    target: "nav-sessions",
    title: "Recording retained for 7 days, then deleted",
    description: "Your recording is accessible here for 7 days per GDPR Article 17, then permanently deleted. Audio, diarized transcript, and full speaker log all live in Sessions, compiled in under 60 seconds.",
    placement: "right",
    actionRequired: false,
    animatedCursor: true,
    autoClick: true,
    autoAction: true,
    yellowWash: true,
  },
  {
    id: 7,
    target: "audio-player-container",
    cursorTarget: "button-play-pause",
    title: "Audio playback, retained for 7 days",
    description: "The full session recording is stored here. Playback is available for the GDPR retention window, then the audio is permanently deleted.",
    placement: "bottom",
    actionRequired: false,
    delayMs: 1200,
    animatedCursor: true,
  },
  {
    id: 8,
    target: "session-transcript-preview",
    title: "Diarized transcript stored alongside audio",
    description: "Every word, every speaker, timestamped and attributed. The full diarized transcript is compiled from your recording and stored here alongside the session audio.",
    placement: "bottom",
    actionRequired: false,
    animatedCursor: true,
    autoAdvanceMs: 3500,
    delayMs: 400,
  },
  {
    id: 9,
    target: "nav-documents",
    title: "Documents compiled from the recording",
    description: "Opening Documents now. The full attendance note, matter record, and client care letter are all compiled from the recording. Compiled in under 60 seconds.",
    placement: "right",
    actionRequired: false,
    animatedCursor: true,
    autoClick: true,
    delayMs: 600,
    yellowWash: true,
  },
  {
    id: 91,
    target: "audio-player-container",
    title: "Session audio, stored and accessible",
    description: "The full recording is stored here and available for playback. Every word, every speaker — accessible during the GDPR retention window for review or dispute.",
    placement: "bottom",
    actionRequired: false,
    delayMs: 600,
  },
  {
    id: 92,
    target: "audio-retention-countdown",
    title: "Deleted on schedule. GDPR Article 17.",
    description: "The countdown shows exactly when this audio is permanently deleted. No manual steps, no data left behind. The deletion event is logged to the tamper-evident audit trail.",
    placement: "bottom",
    actionRequired: false,
    delayMs: 400,
  },
  {
    id: 10,
    target: "tab-attendance",
    title: "Compliance-ready attendance note",
    description: "Structured, accurate, and ready to approve. Every section compiled directly from what was said in the meeting, not typed, not dictated.",
    placement: "bottom",
    actionRequired: false,
    animatedCursor: true,
    autoClick: true,
    autoAdvanceMs: 4500,
    delayMs: 600,
  },
  {
    id: 11,
    target: "button-case-actions",
    title: "Opening case actions to send a secure link",
    description: "The attendance note is ready to share. Opening the case actions menu to send a secure link, the client verifies by SMS before accessing, access is timestamped and logged.",
    placement: "top",
    actionRequired: false,
    animatedCursor: true,
    autoClick: true,
    autoAction: true,
  },
  {
    id: 12,
    target: "action-share",
    title: "Secure share, SMS-verified client access",
    description: "Tapping Secure Share now. Your client receives a link and must verify by SMS before viewing. Every access attempt is timestamped and logged to the tamper-evident audit trail.",
    placement: "top",
    actionRequired: false,
    animatedCursor: true,
    autoAction: true,
    delayMs: 400,
  },
  {
    id: 13,
    target: "secure-share-modal-fields",
    title: "Enter client details for secure sharing",
    description: "Add the client's email, name, and mobile number. The secure link will be sent to them with SMS verification before they can access any documents.",
    placement: "right",
    actionRequired: false,
    delayMs: 600,
  },
  {
    id: 14,
    target: "secure-share-sms-section",
    title: "SMS verification protects every access",
    description: "Enable SMS verification so your client must confirm their identity before viewing any shared documents. Every access attempt is logged to the audit trail.",
    placement: "right",
    actionRequired: false,
    delayMs: 400,
  },
  {
    id: 15,
    target: "button-send-link",
    title: "Send the secure link",
    description: "Once details are confirmed, send the secure link. Your client receives an email, verifies by SMS, and every access event is sealed to the tamper-evident audit trail.",
    placement: "top",
    actionRequired: false,
    animatedCursor: true,
    autoAdvanceMs: 3000,
    delayMs: 400,
  },
  {
    id: 16,
    target: "nav-obligations",
    title: "Obligations captured from the recording",
    description: "Every undertaking or obligation given during the session was captured from the transcript. Each one is tracked until discharged, flagged, logged, and verifiable.",
    placement: "right",
    actionRequired: false,
    animatedCursor: true,
    autoClick: true,
    yellowWash: true,
    delayMs: 400,
  },
  {
    id: 17,
    target: "nav-consent",
    title: "Consent evidence, sealed",
    description: "Consent was captured in-session, timestamped, and sealed to the audit trail. GDPR Article 7 compliant, defensible if ever challenged.",
    placement: "right",
    actionRequired: false,
    animatedCursor: true,
    autoClick: true,
    yellowWash: true,
    delayMs: 400,
  },
  {
    id: 18,
    target: "nav-audit",
    title: "Tamper-evident audit trail",
    description: "Every event, consent, recording, document approval, and secure share access, is logged with a cryptographic fingerprint. Proof of everything, if it is ever disputed.",
    placement: "right",
    actionRequired: false,
    animatedCursor: true,
    autoClick: true,
    yellowWash: true,
    delayMs: 400,
  },
  {
    id: 19,
    target: "audit-trail-content",
    title: "Full audit log with cryptographic fingerprints",
    description: "Every entry is sealed with a cryptographic fingerprint. If a record is ever altered, the fingerprint breaks. This is the evidence standard that protects you if anything is disputed.",
    placement: "top",
    actionRequired: false,
    delayMs: 600,
  },
  {
    id: 20,
    target: "button-case-actions",
    title: "Opening case actions for SRA report",
    description: "Opening case actions to compile a complete SRA-ready defence report. Sessions, consent log, documents, audit trail, and a tamper-evidence declaration, everything bundled in under 60 seconds.",
    placement: "top",
    actionRequired: false,
    animatedCursor: true,
    autoClick: true,
    autoAction: true,
    delayMs: 400,
  },
  {
    id: 21,
    target: "action-sra-report",
    title: "SRA-ready matter report",
    description: "If the SRA investigates or a PI claim is made, compile a complete defence report: sessions, consent log, documents, audit trail, and a tamper-evidence declaration. Everything bundled in under 60 seconds.",
    placement: "bottom",
    actionRequired: false,
    animatedCursor: true,
    autoClick: true,
    autoAction: true,
    delayMs: 600,
  },
  {
    id: 22,
    target: "button-confirm-compile-report",
    title: "Compile the full defence report",
    description: "Tap Compile Report to bundle every session, consent log, document, audit entry, and tamper-evidence declaration into one SRA-ready PDF. Everything compiled in under 60 seconds.",
    placement: "top",
    actionRequired: false,
    animatedCursor: true,
    delayMs: 800,
  },
  {
    id: 23,
    target: "demo-final-impact",
    title: "The gap is real. Most firms don't know it.",
    description: "Solo practitioners and boutique firms are most exposed when things go wrong, and least likely to have the documented processes that protect them. You have just seen what protection looks like in practice. Book a 15-minute call.",
    placement: "bottom",
    actionRequired: false,
    fullScreenCard: true,
  },
];

const TOUR_KEY = "legalnote_demo_tour_complete_v11";
const VOICE_KEY = "legalnote_demo_voice";

interface TooltipPosition {
  top?: number;
  left?: number;
  isMobileSheet?: boolean;
  mobileSheetAtTop?: boolean;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
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
  onStepTargetChange?: (target: string | null) => void;
  onStepAutoAction?: (stepId: number) => void;
  onComplete?: () => void;
}

export const DemoTour = forwardRef<DemoTourHandle, DemoTourProps>(function DemoTour(
  { restartTrigger, practiceArea, startAtStep, resumeTrigger, name, firmName, hidden, onStepTargetChange, onStepAutoAction, onComplete },
  ref
) {
  const tourKey = practiceArea ? `${TOUR_KEY}_${practiceArea}` : TOUR_KEY;
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 100, left: 20 });
  const [visible, setVisible] = useState(false);
  const [elementMissing, setElementMissing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem(VOICE_KEY) !== "off");
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [yellowWashRect, setYellowWashRect] = useState<SpotlightRect | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorAnimating, setCursorAnimating] = useState(false);
  const positionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spotlightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  const isNavTarget = (target: string) => NAV_TARGETS.includes(target);

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

  const updateSpotlight = useCallback((step: TourStep) => {
    const el = document.querySelector(`[data-testid="${step.target}"]`);
    if (!el) {
      setSpotlightRect(null);
      setYellowWashRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "instant", block: "nearest" });
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      if (step.yellowWash && isNavTarget(step.target)) {
        setYellowWashRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      } else {
        setYellowWashRect(null);
      }
    });
  }, []);

  const positionTooltip = useCallback((step?: TourStep) => {
    const s = step ?? currentStep;
    if (!s) return;

    if (s.fullScreenCard) {
      setElementMissing(false);
      setTooltipPos({ top: 0, left: 0 });
      setVisible(true);
      setSpotlightRect(null);
      setYellowWashRect(null);
      return;
    }

    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      const el = document.querySelector(`[data-testid="${s.target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "center" });
      }
      setElementMissing(false);
      requestAnimationFrame(() => {
        const SHEET_HEIGHT = 220;
        let atTop = false;
        let sRect: SpotlightRect | null = null;
        if (el) {
          const rect = (el as HTMLElement).getBoundingClientRect();
          // If element centre is in the bottom portion that the sheet would cover, flip to top
          const elCentre = rect.top + rect.height / 2;
          atTop = elCentre > window.innerHeight - SHEET_HEIGHT - 20;
          if (rect.width > 0 && rect.height > 0) {
            sRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
          }
        }
        setTooltipPos({ isMobileSheet: true, mobileSheetAtTop: atTop });
        setSpotlightRect(sRect);
        setYellowWashRect(null);
        setVisible(true);
      });
      return;
    }

    const el = document.querySelector(`[data-testid="${s.target}"]`);
    if (!el) {
      if (s.target === "demo-consent-confirm") {
        setElementMissing(true);
        setTooltipPos({ top: 80, left: 20 });
        setVisible(false);
        setSpotlightRect(null);
        setYellowWashRect(null);
        return;
      }
      setElementMissing(true);
      setTooltipPos({ top: 80, left: 20 });
      setVisible(!!s.navigationHint);
      setSpotlightRect(null);
      setYellowWashRect(null);
      return;
    }

    const elRect = el.getBoundingClientRect();
    if (elRect.width === 0 || elRect.height === 0) {
      setElementMissing(true);
      setTooltipPos({ top: 80, left: 20 });
      setVisible(false);
      setSpotlightRect(null);
      setYellowWashRect(null);
      return;
    }

    setElementMissing(false);
    el.scrollIntoView({ behavior: "instant", block: "nearest" });
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const tooltipWidth = 300;
      const tooltipHeight = 200;
      const margin = 14;
      const placement = s.placement || "bottom";
      let top = 0;
      let left = 0;

      if (placement === "bottom") {
        top = rect.bottom + margin;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
      } else if (placement === "top") {
        top = rect.top - tooltipHeight - margin;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
      } else if (placement === "right") {
        top = rect.top;
        left = rect.right + margin;
      } else if (placement === "left") {
        top = rect.top;
        left = rect.left - tooltipWidth - margin;
      }

      left = Math.min(left, window.innerWidth - tooltipWidth - 8);
      left = Math.max(8, left);
      top = Math.max(70, top);
      top = Math.min(top, window.innerHeight - tooltipHeight - 24);

      setTooltipPos({ top, left });
      setVisible(true);

      setSpotlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });

      if (s.yellowWash && isNavTarget(s.target)) {
        setYellowWashRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      } else {
        setYellowWashRect(null);
      }
    });
  }, [currentStep]);

  useImperativeHandle(ref, () => ({
    advanceTourToStep: (index: number) => {
      if (!active) return;
      const step = TOUR_STEPS[index];
      if (!step) return;
      stopAudio();
      onStepTargetChange?.(step.target);

      if (step.delayMs && step.delayMs > 0) {
        setVisible(false);
        setSpotlightRect(null);
        setYellowWashRect(null);
        setStepIndex(index);
        positionTimerRef.current = setTimeout(() => {
          positionTooltip(step);
        }, step.delayMs);
      } else {
        setStepIndex(index);
      }
    },
  }), [active, stopAudio, positionTooltip, onStepTargetChange]);

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
    if (!active || !currentStep) {
      onStepTargetChange?.(null);
      return;
    }
    onStepTargetChange?.(currentStep.target);
  }, [active, currentStep, onStepTargetChange]);

  useEffect(() => {
    if (!active || !currentStep) return;
    if (currentStep.delayMs && currentStep.delayMs > 0) {
      return;
    }
    setVisible(false);
    setSpotlightRect(null);
    setYellowWashRect(null);
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
    if (!active || !currentStep || !visible || hidden) return;
    if (voiceEnabled) {
      playStepAudio(currentStep.id);
    }
    return () => {
      stopAudio();
    };
  }, [active, currentStep, visible, voiceEnabled, playStepAudio, stopAudio, hidden]);

  useEffect(() => {
    if (!active || !currentStep || !elementMissing) return;
    const interval = setInterval(() => {
      const el = document.querySelector(`[data-testid="${currentStep.target}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setElementMissing(false);
          positionTooltip();
          clearInterval(interval);
        }
      }
    }, 300);
    return () => clearInterval(interval);
  }, [active, currentStep, elementMissing, positionTooltip]);

  useEffect(() => {
    if (!active || !currentStep || !visible || hidden) {
      if (spotlightTimerRef.current) clearInterval(spotlightTimerRef.current);
      return;
    }
    if (currentStep.fullScreenCard) return;
    if (spotlightTimerRef.current) clearInterval(spotlightTimerRef.current);
    spotlightTimerRef.current = setInterval(() => {
      updateSpotlight(currentStep);
    }, 300);
    return () => {
      if (spotlightTimerRef.current) clearInterval(spotlightTimerRef.current);
    };
  }, [active, currentStep, visible, hidden, updateSpotlight]);

  useEffect(() => {
    return () => {
      stopAudio();
      if (spotlightTimerRef.current) clearInterval(spotlightTimerRef.current);
    };
  }, [stopAudio]);

  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (!active || !currentStep || !visible || hidden) return;
    if (!currentStep.autoAdvanceMs) return;
    const isLast = stepIndex === TOUR_STEPS.length - 1;
    autoAdvanceTimerRef.current = setTimeout(() => {
      if (!isLast) {
        setStepIndex((i) => i + 1);
      } else {
        handleComplete();
      }
    }, currentStep.autoAdvanceMs);
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, [active, currentStep, visible, hidden, stepIndex, onStepTargetChange, tourKey]);

  useEffect(() => {
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    setCursorPos(null);
    setCursorAnimating(false);
    if (!active || !currentStep || !visible || hidden) return;
    if (!currentStep.animatedCursor) return;

    const cursorTargetId = currentStep.cursorTarget || currentStep.target;
    const el = document.querySelector(`[data-testid="${cursorTargetId}"]`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    setCursorPos({ x: targetX - 100, y: targetY + 60 });
    setCursorAnimating(false);

    cursorTimerRef.current = setTimeout(() => {
      setCursorPos({ x: targetX, y: targetY });
      setCursorAnimating(true);

      if (currentStep.autoClick || currentStep.autoAction) {
        const stepAtTrigger = currentStep;
        cursorTimerRef.current = setTimeout(() => {
          if (stepAtTrigger.autoClick) {
            const target = document.querySelector(`[data-testid="${stepAtTrigger.target}"]`);
            if (target) {
              (target as HTMLElement).click();
            }
          }
          if (stepAtTrigger.autoAction) {
            onStepAutoAction?.(stepAtTrigger.id);
          }
        }, 800);
      }
    }, 600);

    return () => {
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, [active, currentStep, visible, hidden, onStepAutoAction]);

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
    setSpotlightRect(null);
    setYellowWashRect(null);
    onStepTargetChange?.(null);
    localStorage.setItem(tourKey, "1");
    onComplete?.();
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

  if (currentStep.fullScreenCard) {
    return (
      <>
        <style>{`
          @keyframes demo-spotlight-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}</style>
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          data-testid="demo-final-impact"
        >
          <div className="max-w-lg w-full mx-4 bg-background rounded-md border border-border shadow-2xl p-8 space-y-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight">The gap is real. Most firms don't know it.</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Solo practitioners and boutique firms are most exposed when things go wrong, and least likely to have the documented processes that protect them.
              You have just seen what protection looks like in practice.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                size="default"
                onClick={handleComplete}
                data-testid="button-tour-finish"
              >
                Book a 15-minute call
              </Button>
            </div>
            <div className="flex items-center gap-1.5 justify-center">
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
          </div>
        </div>
      </>
    );
  }

  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isFirst = stepIndex === 0;
  const isActionRequired = currentStep.actionRequired === true;
  const isMobile = tooltipPos.isMobileSheet;

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
      ) : (
        <p className={`text-xs text-muted-foreground leading-relaxed mb-3 ${isMobile ? "line-clamp-3" : ""}`}>
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
            Tap the highlighted area
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

  const spotlightPad = 6;
  const mobileAtTop = tooltipPos.mobileSheetAtTop === true;

  if (isMobile) {
    return (
      <>
        <style>{`
          @keyframes demo-spotlight-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}</style>
        <div
          className="fixed inset-0 z-[60] pointer-events-none"
          style={{ background: "rgba(0,0,0,0.35)" }}
        />
        {spotlightRect && (
          <div
            className="fixed z-[61] pointer-events-none rounded-md"
            style={{
              top: spotlightRect.top - spotlightPad,
              left: spotlightRect.left - spotlightPad,
              width: spotlightRect.width + spotlightPad * 2,
              height: spotlightRect.height + spotlightPad * 2,
              boxShadow: "0 0 0 3px hsl(var(--primary)), 0 0 16px 4px hsl(var(--primary) / 0.45)",
              animation: "demo-spotlight-pulse 1.8s ease-in-out infinite",
            }}
          />
        )}
        {yellowWashRect && (
          <div
            className="fixed z-[60] pointer-events-none rounded-md"
            style={{
              top: yellowWashRect.top,
              left: yellowWashRect.left,
              width: yellowWashRect.width,
              height: yellowWashRect.height,
              background: "rgba(253, 224, 71, 0.35)",
            }}
          />
        )}
        <div
          className={`fixed z-[70] left-0 right-0 bg-background shadow-lg p-4 ${
            mobileAtTop
              ? "top-0 border-b border-border rounded-b-lg"
              : "bottom-0 border-t border-border rounded-t-lg"
          }`}
          data-testid="tour-tooltip"
        >
          {tooltipContent}
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes demo-spotlight-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes demo-cursor-click {
          0% { transform: scale(1); }
          50% { transform: scale(0.75); }
          100% { transform: scale(1); }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{ background: "rgba(0,0,0,0.35)" }}
      />
      {spotlightRect && (
        <div
          className="fixed z-[61] pointer-events-none rounded-md"
          style={{
            top: spotlightRect.top - spotlightPad,
            left: spotlightRect.left - spotlightPad,
            width: spotlightRect.width + spotlightPad * 2,
            height: spotlightRect.height + spotlightPad * 2,
            boxShadow: "0 0 0 3px hsl(var(--primary)), 0 0 20px 6px hsl(var(--primary) / 0.45)",
            animation: "demo-spotlight-pulse 1.8s ease-in-out infinite",
          }}
        />
      )}
      {yellowWashRect && (
        <div
          className="fixed z-[60] pointer-events-none rounded-md"
          style={{
            top: yellowWashRect.top,
            left: yellowWashRect.left,
            width: yellowWashRect.width,
            height: yellowWashRect.height,
            background: "rgba(253, 224, 71, 0.35)",
          }}
        />
      )}
      {cursorPos && currentStep?.animatedCursor && (
        <div
          className="fixed z-[80] pointer-events-none"
          style={{
            top: cursorPos.y,
            left: cursorPos.x,
            transition: cursorAnimating ? "top 0.6s cubic-bezier(0.4,0,0.2,1), left 0.6s cubic-bezier(0.4,0,0.2,1)" : undefined,
            transform: "translate(-4px, -4px)",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
              animation: cursorAnimating ? "demo-cursor-click 0.5s ease-in-out 0.7s 1" : undefined,
            }}
          >
            <path
              d="M5 3L19 12L12 13L9 20L5 3Z"
              fill="white"
              stroke="black"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
      <div
        className="fixed z-[70] w-[300px] bg-background border border-border rounded-md shadow-lg p-4"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        data-testid="tour-tooltip"
      >
        {tooltipContent}
      </div>
    </>
  );
});
