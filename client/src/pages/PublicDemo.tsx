import { useMemo, useState } from "react";
import { useParams, useSearch } from "wouter";
import {
  DEMO_VARIANTS,
  PRACTICE_AREA_LABELS,
  isValidPracticeArea,
  personaliseMatters,
  personaliseObligations,
  personaliseLeadMatter,
  type PracticeAreaKey,
} from "@/data/demoData";
import { DemoShell, type DemoScreen } from "@/components/demo/DemoShell";
import { DemoTour } from "@/components/demo/DemoTour";
import { DemoDashboard } from "@/components/demo/DemoDashboard";
import { DemoCaseDetail } from "@/components/demo/DemoCaseDetail";
import { DemoDocumentViewer } from "@/components/demo/DemoDocumentViewer";
import { DemoTranscript } from "@/components/demo/DemoTranscript";
import { DemoAuditTrail } from "@/components/demo/DemoAuditTrail";

export default function PublicDemo() {
  const params = useParams<{ practiceArea: string }>();
  const searchStr = useSearch();

  const searchParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const firstName = searchParams.get("name") || "";
  const firmName = searchParams.get("firm") || "";
  const region = searchParams.get("region") || "";
  const size = searchParams.get("size") || "";
  const lastName = searchParams.get("lastName") || "";

  const rawKey = params.practiceArea?.toLowerCase() as PracticeAreaKey;
  const practiceAreaKey: PracticeAreaKey = isValidPracticeArea(rawKey) ? rawKey : "family";

  const variant = DEMO_VARIANTS[practiceAreaKey];
  const practiceAreaLabel = PRACTICE_AREA_LABELS[practiceAreaKey];

  const resolvedLastName = useMemo(() => {
    if (lastName) return lastName;
    if (!firstName) return "";
    const parts = firstName.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : "";
  }, [lastName, firstName]);

  const matters = useMemo(
    () => personaliseMatters(variant.matters, resolvedLastName),
    [variant.matters, resolvedLastName]
  );

  const obligations = useMemo(
    () => personaliseObligations(variant.obligations, resolvedLastName),
    [variant.obligations, resolvedLastName]
  );

  const leadMatter = useMemo(
    () => personaliseLeadMatter(variant.leadMatter, firstName, resolvedLastName, firmName),
    [variant.leadMatter, firstName, resolvedLastName, firmName]
  );

  const displayName = firstName || "there";
  const displayFirm = firmName || "your firm";

  const [screen, setScreen] = useState<DemoScreen>("dashboard");
  const [tourRestartTrigger, setTourRestartTrigger] = useState(0);

  const handleNavigate = (s: DemoScreen) => setScreen(s);
  const handleRestartTour = () => setTourRestartTrigger((v) => v + 1);

  return (
    <DemoShell
      screen={screen}
      onNavigate={handleNavigate}
      firmName={displayFirm}
      firstName={firstName}
      practiceAreaLabel={practiceAreaLabel}
      onRestartTour={handleRestartTour}
    >
      {screen === "dashboard" && (
        <DemoDashboard
          variant={variant}
          matters={matters}
          obligations={obligations}
          displayName={displayName}
          displayFirm={displayFirm}
          practiceAreaLabel={practiceAreaLabel}
          onViewCaseDetail={() => setScreen("case-detail")}
        />
      )}
      {screen === "case-detail" && (
        <DemoCaseDetail
          matter={leadMatter}
          onViewDocument={() => setScreen("document")}
          onViewTranscript={() => setScreen("transcript")}
          onViewAudit={() => setScreen("audit")}
          onBack={() => setScreen("dashboard")}
        />
      )}
      {screen === "document" && (
        <DemoDocumentViewer
          matter={leadMatter}
          onBack={() => setScreen("case-detail")}
        />
      )}
      {screen === "transcript" && (
        <DemoTranscript
          matter={leadMatter}
          onBack={() => setScreen("case-detail")}
        />
      )}
      {screen === "audit" && (
        <DemoAuditTrail
          matter={leadMatter}
          onBack={() => setScreen("case-detail")}
        />
      )}

      <DemoTour
        currentScreen={screen}
        onNavigate={handleNavigate}
        restartTrigger={tourRestartTrigger}
        practiceArea={practiceAreaKey}
      />
    </DemoShell>
  );
}
