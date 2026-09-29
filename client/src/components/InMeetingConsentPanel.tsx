import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2, Loader2, Shield, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CONSENT_DISCLAIMER_TEXT } from "@shared/consent";

type ImportPoll = {
  id: string;
  botStatus: string | null;
  consentMode?: string;
  consentConfirmed?: boolean;
  status: string;
};

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

type InMeetingConsentPanelProps = {
  importId: string;
  caseId?: string | null;
  poll?: boolean;
  onConsentConfirmed?: () => void;
  compact?: boolean;
};

export function InMeetingConsentPanel({
  importId,
  caseId,
  poll = true,
  onConsentConfirmed,
  compact = false,
}: InMeetingConsentPanelProps) {
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [consentObtained, setConsentObtained] = useState(false);
  const [consentRecordedElapsed, setConsentRecordedElapsed] = useState<number | null>(null);
  const [importData, setImportData] = useState<ImportPoll | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!poll || !importId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/recall/import/${importId}`, { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as ImportPoll;
        if (cancelled) return;
        setImportData(json);
        if (json.consentConfirmed) setConsentObtained(true);
        const recording =
          json.botStatus === "in_call_recording" || json.botStatus === "in_call";
        if (recording && recordingStartedAtRef.current == null) {
          recordingStartedAtRef.current = Date.now();
        }
      } catch {
        // ignore
      }
    };

    void tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [poll, importId]);

  useEffect(() => {
    if (recordingStartedAtRef.current == null) return;
    const id = window.setInterval(() => {
      setRecordingElapsed(
        Math.floor((Date.now() - recordingStartedAtRef.current!) / 1000),
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [importData?.botStatus]);

  const isRecording =
    importData?.botStatus === "in_call_recording" || importData?.botStatus === "in_call";

  const showPanel =
    !consentObtained &&
    !importData?.consentConfirmed &&
    (importData?.consentMode ?? "in_meeting") === "in_meeting" &&
    isRecording;

  const consentMutation = useMutation({
    mutationFn: async (consented: boolean) => {
      if (consented) {
        return apiRequest("PATCH", `/api/recall/import/${importId}/consent`, {
          userConfirmsVerbalConsent: true,
          elapsedSeconds: recordingElapsed,
          consentSource: "in_meeting_live_panel",
        });
      }
      return apiRequest("POST", `/api/recall/import/${importId}/consent-decline`, {
        elapsedSeconds: recordingElapsed,
      });
    },
    onSuccess: (_data, consented) => {
      if (consented) {
        setConsentObtained(true);
        setConsentRecordedElapsed(recordingElapsed);
        if (caseId) {
          queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/live-import`] });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/scheduled-meetings"] });
        onConsentConfirmed?.();
      }
    },
  });

  if (consentObtained || importData?.consentConfirmed) {
    return (
      <div
        className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-md"
        data-testid="alert-consent-recorded"
      >
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-700 dark:text-green-300">Consent recorded</p>
          <p className="text-xs text-muted-foreground">
            Verbal consent confirmed{" "}
            {formatElapsed(consentRecordedElapsed ?? recordingElapsed)} into the recording.
          </p>
        </div>
      </div>
    );
  }

  if (!showPanel) {
    if (importData && !isRecording && importData.status === "live") {
      return (
        <p className="text-xs text-muted-foreground">
          Waiting for the recording to start — read the consent script once the call is live.
        </p>
      );
    }
    return null;
  }

  return (
    <div
      className={`border-2 border-amber-500/50 bg-amber-500/5 rounded-md space-y-3 ${
        compact ? "p-3" : "p-4"
      }`}
      data-testid="card-in-meeting-consent"
    >
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          Read consent script to client now
        </p>
      </div>
      <div className="bg-background rounded-md p-3 border border-border">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">READ TO CLIENT:</p>
        <p className="text-sm leading-relaxed italic">&quot;{CONSENT_DISCLAIMER_TEXT}&quot;</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Recording time: {formatElapsed(recordingElapsed)} — client&apos;s verbal response is captured
        on the recording.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          size={compact ? "sm" : "default"}
          disabled={consentMutation.isPending}
          onClick={() => consentMutation.mutate(false)}
          data-testid="button-client-declined"
        >
          <X className="w-4 h-4" />
          Client Declined
        </Button>
        <Button
          className="flex-1 gap-2"
          size={compact ? "sm" : "default"}
          disabled={consentMutation.isPending}
          onClick={() => consentMutation.mutate(true)}
          data-testid="button-client-consented"
        >
          {consentMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Client Consented
        </Button>
      </div>
    </div>
  );
}
