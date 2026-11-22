import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2, Loader2, Mic, PictureInPicture2, Shield, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { consentScriptWording } from "@shared/consent";
import { alertLegalNoteAdmitted } from "@/lib/meetingAlerts";
import { PipPortal, useConsentPip } from "@/components/ConsentPip";

type ImportPoll = {
  id: string;
  botStatus: string | null;
  consentMode?: string;
  consentConfirmed?: boolean;
  consentScript?: string | null;
  consentScriptStartedAt?: string | null;
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
  /** Rendered inside the always-on-top window: no nested window button. */
  pipMode?: boolean;
};

export function InMeetingConsentPanel({
  importId,
  caseId,
  poll = true,
  onConsentConfirmed,
  compact = false,
  pipMode = false,
}: InMeetingConsentPanelProps) {
  const pip = useConsentPip();
  const [scriptStarted, setScriptStarted] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [consentObtained, setConsentObtained] = useState(false);
  const [consentRecordedElapsed, setConsentRecordedElapsed] = useState<number | null>(null);
  const [importData, setImportData] = useState<ImportPoll | null>(null);
  // Set when the bot was sent: the participant notice when the client is not in the meeting.
  const isParticipant = importData?.consentScript === "participant";
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
        if (json.consentScriptStartedAt) setScriptStarted(true);
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

  // The solicitor is looking at Zoom or Teams: tell them the moment LegalNote is in.
  useEffect(() => {
    if (pipMode || !showPanel || !importId) return;
    alertLegalNoteAdmitted({ importId, participantNotice: isParticipant });
  }, [pipMode, showPanel, importId, isParticipant]);

  // Once consent is recorded, show it in the small window briefly, then close it.
  const consentDone = consentObtained || !!importData?.consentConfirmed;
  useEffect(() => {
    if (!consentDone || !pip.pipWindow) return;
    const id = window.setTimeout(pip.close, 4000);
    return () => window.clearTimeout(id);
  }, [consentDone, pip.pipWindow, pip.close]);

  const scriptStartMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/recall/import/${importId}/consent-script-started`),
    onSuccess: () => setScriptStarted(true),
  });

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

  if (pip.pipWindow && !pipMode) {
    return (
      <>
        <PipPortal pipWindow={pip.pipWindow}>
          <InMeetingConsentPanel importId={importId} caseId={caseId} compact pipMode onConsentConfirmed={onConsentConfirmed} />
        </PipPortal>
        <div className="flex items-center justify-between gap-2 p-3 border border-amber-500/50 bg-amber-500/5 rounded-md">
          <p className="text-xs text-muted-foreground">The consent card is on top of your meeting window.</p>
          <Button size="sm" variant="outline" onClick={pip.close} data-testid="button-consent-pip-close">
            Bring it back here
          </Button>
        </div>
      </>
    );
  }

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
    if (importData && !isRecording && importData.status === "live" && !importData.consentConfirmed) {
      return (
        <p className="text-xs text-muted-foreground">
          Waiting for LegalNote to be admitted. You&apos;ll get an alert when it&apos;s in, so you can read
          the consent script before anything else.
        </p>
      );
    }
    return null;
  }

  const keepOnTopButton =
    !pipMode && pip.supported ? (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs gap-1"
        onClick={() => void pip.open()}
        data-testid="button-consent-pip-open"
      >
        <PictureInPicture2 className="w-3.5 h-3.5" />
        Keep on top of meeting
      </Button>
    ) : null;

  if (!scriptStarted) {
    return (
      <div
        className={`border-2 border-amber-500/50 bg-amber-500/5 rounded-md space-y-3 ${
          compact ? "p-3" : "p-4"
        }`}
        data-testid="card-in-meeting-consent"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              LegalNote is in. {isParticipant ? "Give the participant notice" : "Ask for consent"} first.
            </p>
          </div>
          {keepOnTopButton}
        </div>
        <p className="text-xs text-muted-foreground">
          Press this as you start reading, so LegalNote knows where consent begins.
        </p>
        <Button
          className="w-full gap-2"
          size={compact ? "sm" : "default"}
          disabled={scriptStartMutation.isPending}
          onClick={() => scriptStartMutation.mutate()}
          data-testid="button-start-consent-script"
        >
          {scriptStartMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          {isParticipant ? "Start participant notice" : "Start consent script"}
        </Button>
        {scriptStartMutation.isError && (
          <p className="text-xs text-destructive">Couldn&apos;t mark the start. Read the script anyway, then confirm below.</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`border-2 border-amber-500/50 bg-amber-500/5 rounded-md space-y-3 ${
        compact ? "p-3" : "p-4"
      }`}
      data-testid="card-in-meeting-consent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            {isParticipant ? "Read participant notice to attendees now" : "Read consent script to client now"}
          </p>
        </div>
        {keepOnTopButton}
      </div>
      <div className="bg-background rounded-md p-3 border border-border">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          {isParticipant ? "READ TO ATTENDEES:" : "READ TO CLIENT:"}
        </p>
        <p className="text-sm leading-relaxed italic">&quot;{consentScriptWording(isParticipant ? "participant" : "client").text}&quot;</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Recording time: {formatElapsed(recordingElapsed)} -{" "}
        {isParticipant ? "attendees' verbal responses are" : "client's verbal response is"} captured
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
          {isParticipant ? "Declined" : "Client Declined"}
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
          {isParticipant ? "Everyone agreed" : "Client Consented"}
        </Button>
      </div>
    </div>
  );
}
