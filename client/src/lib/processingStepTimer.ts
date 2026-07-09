import type { ProcessingStep } from "@/components/MeetingToMatterProcessingOverlay";

const DEFAULT_MIN_MS = 2000;

export function createProcessingStepTimer(
  setStep: (step: ProcessingStep) => void,
  minMs = DEFAULT_MIN_MS,
) {
  let stepStart = Date.now();

  return async function advanceStep(next: ProcessingStep) {
    const elapsed = Date.now() - stepStart;
    if (elapsed < minMs) {
      await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
    }
    setStep(next);
    stepStart = Date.now();
  };
}
