import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Mic,
  Video,
  Download,
  FileUp,
  Phone,
  Keyboard,
  ArrowLeft,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import NewNote from "@/pages/NewNote";
import LiveBotModal from "@/components/LiveBotModal";
import ImportRecordingModal from "@/components/ImportRecordingModal";
import UploadTranscriptModal from "@/components/UploadTranscriptModal";
import LogCallModal from "@/components/LogCallModal";
import CaseSelectorModal from "@/components/CaseSelectorModal";
import {
  buildCapturePath,
  captureModeRequiresCase,
  isCaptureMode,
  type CaptureMode,
} from "@/lib/capture";
import type { Case } from "@shared/schema";
import { QUICK_RECORD_SHORTCUT_EVENT } from "@/hooks/useQuickRecordShortcut";

interface ModeTile {
  mode: CaptureMode;
  title: string;
  description: string;
  icon: typeof Mic;
  testId: string;
}

const MODE_TILES: ModeTile[] = [
  {
    mode: "record",
    title: "Record in person",
    description: "Prepare matter details, then start mic recording with consent capture.",
    icon: Mic,
    testId: "capture-mode-record",
  },
  {
    mode: "join",
    title: "Join video meeting",
    description: "Send LegalNote into Zoom, Teams, or Meet.",
    icon: Video,
    testId: "capture-mode-join",
  },
  {
    mode: "import",
    title: "Import past meeting",
    description: "Pull in a completed video-call recording for this matter.",
    icon: Download,
    testId: "capture-mode-import",
  },
  {
    mode: "transcript",
    title: "Upload transcript",
    description: "Paste or upload a transcript and produce documents.",
    icon: FileUp,
    testId: "capture-mode-transcript",
  },
  {
    mode: "phone",
    title: "Dictate phone note",
    description: "Dictate a telephone attendance note (no client consent required).",
    icon: Phone,
    testId: "capture-mode-phone",
  },
];

export default function Capture() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(
    searchString.startsWith("?") ? searchString : `?${searchString}`,
  );
  const rawMode = searchParams.get("mode");
  const mode = isCaptureMode(rawMode) ? rawMode : null;
  const queryCaseId = searchParams.get("caseId");

  const [pendingMode, setPendingMode] = useState<CaptureMode | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showCaseSelector, setShowCaseSelector] = useState(false);
  const [showLiveBot, setShowLiveBot] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);

  const { data: queryCase } = useQuery<Case>({
    queryKey: ["/api/cases", queryCaseId],
    enabled: !!queryCaseId,
  });

  const activeCase =
    selectedCase || (queryCaseId && queryCase?.id === queryCaseId ? queryCase : null);

  const clearMode = () => {
    setPendingMode(null);
    setSelectedCase(null);
    setShowLiveBot(false);
    setShowImport(false);
    setShowTranscript(false);
    setShowLogCall(false);
    setShowCaseSelector(false);
    setLocation(buildCapturePath());
  };

  const openMode = (nextMode: CaptureMode, caseOverride?: Case | null) => {
    const matter = caseOverride ?? activeCase;
    if (nextMode === "record") {
      setLocation(buildCapturePath({ mode: "record", caseId: matter?.id ?? queryCaseId }));
      return;
    }
    if (captureModeRequiresCase(nextMode) && !matter) {
      setPendingMode(nextMode);
      setShowCaseSelector(true);
      return;
    }
    setLocation(buildCapturePath({ mode: nextMode, caseId: matter?.id ?? queryCaseId }));
  };

  // Deep-link: open the right modal when mode is in the URL
  useEffect(() => {
    if (!mode || mode === "record") {
      setShowLiveBot(false);
      setShowImport(false);
      setShowTranscript(false);
      setShowLogCall(false);
      return;
    }

    if (captureModeRequiresCase(mode) && !activeCase) {
      if (queryCaseId && !queryCase) return; // still loading
      setPendingMode(mode);
      setShowCaseSelector(true);
      return;
    }

    setShowLiveBot(mode === "join");
    setShowImport(mode === "import" && !!activeCase);
    setShowTranscript(mode === "transcript" && !!activeCase);
    setShowLogCall(mode === "phone" && !!activeCase);
  }, [mode, activeCase, queryCaseId, queryCase]);

  const handleCaseSelected = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setShowCaseSelector(false);
    const next = pendingMode || mode;
    setPendingMode(null);
    if (!next) return;
    if (next === "record") {
      setLocation(buildCapturePath({ mode: "record", caseId: caseItem.id }));
      return;
    }
    setLocation(buildCapturePath({ mode: next, caseId: caseItem.id }));
  };

  const handleModalClose = (open: boolean) => {
    if (open) return;
    const returnCaseId = activeCase?.id || queryCaseId;
    if (returnCaseId && mode && mode !== "record") {
      setLocation(`/case/${returnCaseId}`);
      return;
    }
    clearMode();
  };

  // Prepare-first mic path (former New Note form)
  if (mode === "record") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 pt-6">
          <Button
            variant="ghost"
            onClick={() => setLocation(buildCapturePath({ caseId: queryCaseId }))}
            className="mb-2 gap-2"
            data-testid="button-back-to-capture"
          >
            <ArrowLeft className="w-4 h-4" />
            All capture options
          </Button>
        </div>
        <NewNote initialCaseId={queryCaseId} captureBranding />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation(activeCase ? `/case/${activeCase.id}` : "/")}
          className="mb-6 gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          {activeCase ? "Back to matter" : "Back to Dashboard"}
        </Button>

        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-semibold text-foreground" data-testid="text-capture-title">
            Capture
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Choose how you want to capture this attendance. For zero-click start, use the red
            microphone or{" "}
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[11px] font-mono">
              Ctrl+L
            </kbd>
            .
          </p>
          {activeCase && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
              <FolderOpen className="w-4 h-4" />
              <span>
                For matter: <span className="font-medium text-foreground">{activeCase.title}</span>
                {activeCase.clientName ? ` · ${activeCase.clientName}` : ""}
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {MODE_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <Card
                key={tile.mode}
                className="hover-elevate cursor-pointer transition-colors"
                onClick={() => openMode(tile.mode)}
                data-testid={tile.testId}
              >
                <CardContent className="p-5 flex gap-4 items-start">
                  <div className="rounded-md bg-accent/10 text-accent p-2.5 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-base font-semibold text-foreground">{tile.title}</h2>
                    <p className="text-sm text-muted-foreground leading-snug">{tile.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Keyboard className="w-4 h-4" />
          <span>Client already in the room?</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.dispatchEvent(new CustomEvent(QUICK_RECORD_SHORTCUT_EVENT))}
            data-testid="button-capture-start-now"
          >
            <Mic className="w-3.5 h-3.5" />
            Start recording now
          </Button>
        </div>
      </div>

      <CaseSelectorModal
        open={showCaseSelector}
        onOpenChange={(open) => {
          setShowCaseSelector(open);
          if (!open) {
            setPendingMode(null);
            if (mode && captureModeRequiresCase(mode) && !activeCase) {
              clearMode();
            }
          }
        }}
        onSelect={handleCaseSelected}
        title="Select a matter"
        description="Which matter is this capture for?"
      />

      <LiveBotModal
        open={showLiveBot}
        onOpenChange={(open) => {
          setShowLiveBot(open);
          if (!open) handleModalClose(false);
        }}
        caseId={activeCase?.id}
        caseTitle={activeCase?.title}
      />

      {activeCase && (
        <>
          <ImportRecordingModal
            open={showImport}
            onOpenChange={(open) => {
              setShowImport(open);
              if (!open) handleModalClose(false);
            }}
            caseId={activeCase.id}
            caseTitle={activeCase.title}
          />
          <UploadTranscriptModal
            open={showTranscript}
            onOpenChange={(open) => {
              setShowTranscript(open);
              if (!open) handleModalClose(false);
            }}
            caseId={activeCase.id}
            caseTitle={activeCase.title}
          />
          <LogCallModal
            open={showLogCall}
            onOpenChange={(open) => {
              setShowLogCall(open);
              if (!open) handleModalClose(false);
            }}
            caseId={activeCase.id}
            caseTitle={activeCase.title}
            clientName={activeCase.clientName}
            clientId={activeCase.clientId || undefined}
            matterReference={activeCase.matterReference || undefined}
          />
        </>
      )}
    </div>
  );
}
