import { useEffect, useRef, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  estimateRemainingSeconds,
  formatEtaLabel,
  processingStartStorageKey,
} from "@/lib/processingEta";

// Mirror the real progress values emitted by the server pipeline
// (aiProcessingPipeline.ts) so the creep cap tracks the actual next step. The
// heaviest phase (attendance-note generation) runs while the server reports 40,
// so 40 -> 55 must span a wide range for the bar to keep visibly moving.
const PROCESSING_PROGRESS_MILESTONES = [10, 20, 35, 40, 55, 70, 85, 100];
const INITIAL_PROGRESS = 12;
// Time-based creep: ease toward the cap but never fully stall, so long LLM
// phases still show continuous motion instead of parking at one number.
const CREEP_EASE_PER_SEC = 0.09; // close ~9% of the remaining gap each second
const CREEP_MIN_RATE = 0.5; // ...but always advance at least 0.5%/sec until the cap

function getNextProcessingMilestone(progress: number): number {
  for (const milestone of PROCESSING_PROGRESS_MILESTONES) {
    if (milestone > progress) return milestone;
  }
  return 100;
}

function getProcessingCreepCap(realProgress: number): number {
  if (realProgress >= 100) return 100;
  // During transcription (below doc-gen at 40%), creep toward 39 for visible motion
  if (realProgress < 40) {
    const docGenMilestone = PROCESSING_PROGRESS_MILESTONES.find((m) => m >= 40);
    if (docGenMilestone) return docGenMilestone - 1;
  }
  // Long attendance-note generation sits at server 40 — creep toward 69 so the
  // bar doesn't park at 54%. Do NOT open the gate all the way to 99% here; later
  // phases (client letter at 70) must keep a truthful gap to 100.
  if (realProgress >= 40 && realProgress < 55) {
    return 69;
  }
  let next = getNextProcessingMilestone(realProgress);
  if (next - realProgress <= 5) {
    const further = getNextProcessingMilestone(next);
    if (further > next) next = further;
  }
  return next - 1;
}

export interface MeetingToMatterProcessingStatusCardProps {
  caseId: string;
  realProgress: number;
  currentStep?: string;
  error?: string;
  sessionExpired?: boolean;
  audioDurationSec?: number | null;
}

/**
 * Isolated so progress creep (rAF) and ETA ticks only re-render this card —
 * not CaseDetail / DocumentViewer — which previously starved click handling
 * on the side menu and top nav during long LLM phases.
 * Remount (via key) when processing is re-queued to reset animation/ETA.
 */
export default function MeetingToMatterProcessingStatusCard({
  caseId,
  realProgress,
  currentStep,
  error,
  sessionExpired,
  audioDurationSec,
}: MeetingToMatterProcessingStatusCardProps) {
  const [displayProgress, setDisplayProgress] = useState(INITIAL_PROGRESS);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const realProgressRef = useRef(realProgress);
  const displayProgressRef = useRef(INITIAL_PROGRESS);
  const rafIdRef = useRef<number | null>(null);
  const processingStartedAtRef = useRef<number | null>(null);
  const lastEtaProgressRef = useRef(0);

  useEffect(() => {
    realProgressRef.current = realProgress;
    if (realProgress >= 100) {
      displayProgressRef.current = 100;
      setDisplayProgress(100);
    } else if (realProgress > displayProgressRef.current) {
      displayProgressRef.current = realProgress;
      setDisplayProgress(realProgress);
    }
  }, [realProgress]);

  useEffect(() => {
    // Start from real progress when joining mid-pipeline (avoids a 12% flash).
    const start = Math.max(INITIAL_PROGRESS, realProgressRef.current);
    displayProgressRef.current = start;
    setDisplayProgress(start);

    let lastTs = performance.now();
    let lastPublishedRound = Math.round(start);

    const animate = (now: number) => {
      // Clamp dt so a backgrounded tab doesn't produce a huge jump on return.
      const dtSec = Math.min(Math.max((now - lastTs) / 1000, 0), 0.5);
      lastTs = now;

      const real = realProgressRef.current;
      let display = displayProgressRef.current;

      if (real >= 100) {
        display = 100;
      } else if (real > display) {
        display = real;
      } else {
        const cap = getProcessingCreepCap(real);
        if (display < cap) {
          const remaining = cap - display;
          const easeStep = remaining * CREEP_EASE_PER_SEC * dtSec;
          const floorStep = CREEP_MIN_RATE * dtSec;
          display = Math.min(display + Math.max(easeStep, floorStep), cap);
        }
        display = Math.min(display, 99);
      }

      display = Math.max(display, real);
      displayProgressRef.current = display;

      // Publish at most once per whole percent — the bar already rounds.
      // Avoiding 60fps setState keeps this subtree cheap even if isolation slips.
      const rounded = Math.round(display);
      if (rounded !== lastPublishedRound) {
        lastPublishedRound = rounded;
        setDisplayProgress(display);
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const storageKey = processingStartStorageKey(caseId);
    if (!processingStartedAtRef.current) {
      let startedAt = Date.now();
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (Number.isFinite(parsed) && parsed > 0) startedAt = parsed;
          else sessionStorage.setItem(storageKey, String(startedAt));
        } else {
          sessionStorage.setItem(storageKey, String(startedAt));
        }
      } catch {
        /* ignore */
      }
      processingStartedAtRef.current = startedAt;
      lastEtaProgressRef.current = realProgressRef.current;
    }

    const tick = () => {
      const startedAt = processingStartedAtRef.current ?? Date.now();
      const elapsedSec = Math.max(0, (Date.now() - startedAt) / 1000);
      const progress = realProgressRef.current;
      const target = estimateRemainingSeconds({
        progress,
        elapsedSec,
        audioDurationSec,
        currentStep,
      });

      const progressAdvanced = progress > lastEtaProgressRef.current + 0.5;
      if (progressAdvanced) lastEtaProgressRef.current = progress;

      setEtaSeconds((prev) => {
        if (progress >= 100) return 0;
        if (prev == null) return target;
        if (target < prev) {
          return Math.max(progress >= 90 ? 3 : 8, target);
        }
        if (progressAdvanced) return target;
        const floor = progress >= 90 ? 3 : Math.max(8, target);
        return Math.max(floor, prev - 1);
      });
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [caseId, realProgress, currentStep, audioDurationSec]);

  const roundedDisplay = Math.round(displayProgress);

  return (
    <div className="p-5 bg-card rounded-md border border-accent/30" data-testid="processing-status-card">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-1.5 bg-accent/20 rounded-md shrink-0">
          <Bot className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm">Meeting-to-Matter™ Engine</p>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
          </div>
          <p className="text-xs text-muted-foreground" data-testid="text-current-step">
            {currentStep || "Preparing..."}
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Progress value={roundedDisplay} className="h-1.5" data-testid="progress-bar" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" data-testid="text-progress-percentage">
            {roundedDisplay}% complete
          </p>
          {etaSeconds != null && (
            <p className="text-xs text-muted-foreground tabular-nums" data-testid="text-progress-eta">
              {formatEtaLabel(etaSeconds, realProgress)}
            </p>
          )}
        </div>
      </div>
      {error && (
        <Alert variant="destructive" className="mt-3" data-testid="alert-processing-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {sessionExpired && (
        <Alert variant="destructive" className="mt-3" data-testid="alert-processing-session">
          <AlertDescription>
            Your session expired while documents were being produced. Sign in again to see the latest status — your previous version remains on file.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
