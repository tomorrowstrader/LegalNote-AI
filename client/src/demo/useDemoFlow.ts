import { useState, useCallback } from "react";

export type DemoFlowState = "dashboard" | "meeting_setup" | "processing" | "case";

export interface UseDemoFlowResult {
  flowState: DemoFlowState;
  advanceFlow: (next: DemoFlowState) => void;
  isAccessibleCaseVisible: boolean;
  markCaseVisible: () => void;
}

export function useDemoFlow(): UseDemoFlowResult {
  const [flowState, setFlowState] = useState<DemoFlowState>("dashboard");
  const [isAccessibleCaseVisible, setIsAccessibleCaseVisible] = useState(false);

  const advanceFlow = useCallback((next: DemoFlowState) => {
    setFlowState(next);
    if (next === "case") {
      setIsAccessibleCaseVisible(true);
    }
  }, []);

  const markCaseVisible = useCallback(() => {
    setIsAccessibleCaseVisible(true);
    setFlowState("case");
  }, []);

  return { flowState, advanceFlow, isAccessibleCaseVisible, markCaseVisible };
}
