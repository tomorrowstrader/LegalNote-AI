import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2, CheckCircle2 } from "lucide-react";

interface ProcessingStep {
  label: string;
  completedText: string;
}

const PROCESSING_STEPS: ProcessingStep[] = [
  { label: "Transcribing session", completedText: "2,124 words transcribed" },
  { label: "Identifying speakers", completedText: "2 speakers identified: Solicitor, Client" },
  { label: "Producing attendance note", completedText: "Attendance note ready" },
  { label: "Applying SRA compliance checks", completedText: "3 checks passed, 1 pending" },
  { label: "Extracting undertakings", completedText: "1 undertaking detected" },
  { label: "Logging to audit trail", completedText: "Audit trail sealed with HMAC-SHA256" },
];

const STEP_DURATION_MS = 1200;

interface DemoCinematicProcessingProps {
  onComplete: () => void;
}

export function DemoCinematicProcessing({ onComplete }: DemoCinematicProcessingProps) {
  const [completedSteps, setCompletedSteps] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [done, setDone] = useState(false);
  const calledComplete = useRef(false);

  const triggerComplete = () => {
    if (calledComplete.current) return;
    calledComplete.current = true;
    onComplete();
  };

  useEffect(() => {
    let step = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const advance = () => {
      if (step >= PROCESSING_STEPS.length) {
        setDone(true);
        const t = setTimeout(triggerComplete, 2000);
        timers.push(t);
        return;
      }
      setActiveStep(step);
      const t1 = setTimeout(() => {
        setCompletedSteps(step + 1);
        step++;
        const t2 = setTimeout(advance, 300);
        timers.push(t2);
      }, STEP_DURATION_MS);
      timers.push(t1);
    };

    const t0 = setTimeout(advance, 400);
    timers.push(t0);

    return () => timers.forEach(clearTimeout);
  }, []);

  const progress = Math.round((completedSteps / PROCESSING_STEPS.length) * 100);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background"
      data-testid="demo-cinematic-processing"
    >
      <div className="w-full max-w-md px-8 py-10 space-y-8">
        {!done ? (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">Processing your session</h2>
              <p className="text-sm text-muted-foreground">In your account this compiles in under 60 seconds, in the background</p>
            </div>

            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
                data-testid="demo-processing-progress"
              />
            </div>

            <div className="space-y-3">
              {PROCESSING_STEPS.map((step, i) => {
                const isCompleted = i < completedSteps;
                const isActive = i === activeStep && !isCompleted;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 transition-opacity duration-300 ${
                      i > activeStep && !isCompleted ? "opacity-30" : "opacity-100"
                    }`}
                    data-testid={`demo-processing-step-${i}`}
                  >
                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                      {isCompleted ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1">
                      {isCompleted ? (
                        <p className="text-sm text-muted-foreground">{step.completedText}</p>
                      ) : (
                        <p className={`text-sm ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-6 py-4 animate-in fade-in duration-500">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <div className="text-center space-y-1">
              <h2 className="text-xl font-semibold">Your matter record is ready.</h2>
              <p className="text-sm text-muted-foreground">All documents, transcript, and audit trail have been compiled.</p>
            </div>
            <Button
              size="default"
              onClick={triggerComplete}
              data-testid="demo-processing-review-now"
            >
              Review now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
