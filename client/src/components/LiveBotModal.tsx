import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Video,
  Shield,
  CheckCircle2,
  AlertCircle,
  Mic,
  Clock,
  Users,
  Check,
  X,
  Send,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Case } from "@shared/schema";
import { CONSENT_DISCLAIMER_TEXT } from "@shared/consent";
import { useLiveBotSessionOptional } from "@/contexts/LiveBotSessionContext";

interface LiveBotModalProps {
  caseId?: string | null;
  caseTitle?: string;
  /** Prefill the meeting URL (e.g. from an upcoming scheduled meeting). */
  initialMeetingUrl?: string | null;
  /** Client name from the calendar/meeting invite — used to suggest the likely matter. */
  suggestedClientName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "select_case" | "url" | "consent" | "live" | "processing" | "done" | "error";
type ConsentMode = "pre_confirmed" | "in_meeting";

const SUGGEST_SCORE_THRESHOLD = 60;

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Score how well a case matches a meeting's client name (higher = better). */
export function caseMatchScore(caseItem: Pick<Case, "clientName" | "title">, clientHint: string): number {
  const hint = normalizeName(clientHint);
  if (!hint) return 0;
  const client = normalizeName(caseItem.clientName || "");
  const title = normalizeName(caseItem.title || "");
  if (!client && !title) return 0;
  if (client === hint) return 100;
  if (client.includes(hint) || hint.includes(client)) return 80;
  const hintTokens = hint.split(" ").filter((t) => t.length > 1);
  const clientTokens = new Set(client.split(" ").filter((t) => t.length > 1));
  const overlap = hintTokens.filter((t) => clientTokens.has(t)).length;
  if (overlap >= 2) return 60;
  if (overlap === 1 && hintTokens.length <= 2) return 40;
  if (title.includes(hint)) return 30;
  return 0;
}

type BotStatus =
  | "joining_call"
  | "in_waiting_room"
  | "in_call_not_recording"
  | "in_call_recording"
  | "call_ended"
  | "done"
  | "fatal"
  | string;

interface BotPollResponse {
  importId: string;
  botId: string;
  botStatus: BotStatus;
  importStatus: string;
  statusLabel: string;
  participants: Array<{ name: string }>;
  meetingTitle?: string;
  consentMode?: string;
  consentConfirmed?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  joining_call: "Joining the call...",
  in_waiting_room: "In the waiting room — admit LegalNote to begin",
  in_call_not_recording: "In the call (starting recording...)",
  in_call_recording: "Recording in progress",
  call_ended: "Call ended — collecting recording",
  done: "Recording complete",
  fatal: "Bot encountered an error",
  left_consent_declined: "Left call — consent declined",
};

const ACTIVE_STATUSES = new Set([
  "joining_call",
  "in_waiting_room",
  "in_call_not_recording",
  "in_call_recording",
  "call_ended",
]);

function detectPlatform(url: string): "zoom" | "teams" | "meet" | null {
  const lower = url.toLowerCase();
  if (lower.includes("zoom.us") || lower.includes("zoom.com")) return "zoom";
  if (lower.includes("teams.microsoft.com") || lower.includes("teams.live.com")) return "teams";
  if (lower.includes("meet.google.com")) return "meet";
  return null;
}

const PLATFORM_LABELS: Record<string, string> = {
  zoom: "Zoom",
  teams: "Microsoft Teams",
  meet: "Google Meet",
};

export function LiveBotModal({
  caseId,
  caseTitle,
  initialMeetingUrl,
  suggestedClientName,
  open,
  onOpenChange,
}: LiveBotModalProps) {
  const { toast } = useToast();
  const liveBotSession = useLiveBotSessionOptional();
  const [step, setStep] = useState<Step>(caseId ? "url" : "select_case");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [platform, setPlatform] = useState<string | null>(null);
  const [consentMode, setConsentMode] = useState<ConsentMode>("in_meeting");
  const [importId, setImportId] = useState<string | null>(null);
  const [botId, setBotId] = useState<string | null>(null);
  const [botPoll, setBotPoll] = useState<BotPollResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [consentObtained, setConsentObtained] = useState(false);
  const [consentDeclined, setConsentDeclined] = useState(false);
  const [consentRecordedElapsed, setConsentRecordedElapsed] = useState<number | null>(null);

  // Send consent link state
  const [showSendConsentLink, setShowSendConsentLink] = useState(false);
  const [consentLinkContact, setConsentLinkContact] = useState("");
  const [consentLinkName, setConsentLinkName] = useState("");
  const [consentLinkSent, setConsentLinkSent] = useState(false);

  // Post-meeting inline assignment state (for impromptu recordings without a case)
  const [postMeetingMode, setPostMeetingMode] = useState<"choose" | "existing" | "create" | "discard">("choose");
  const [postMeetingCaseId, setPostMeetingCaseId] = useState("");
  const [postMeetingRecordingType, setPostMeetingRecordingType] = useState("full_meeting");
  const [postMeetingTitle, setPostMeetingTitle] = useState("");
  const [postMeetingClient, setPostMeetingClient] = useState("");
  const [discardConfirmed, setDiscardConfirmed] = useState(false);
  const [assignDone, setAssignDone] = useState(false);

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(caseId || null);
  const [selectedCaseTitle, setSelectedCaseTitle] = useState<string>(caseTitle || "");
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseClient, setNewCaseClient] = useState(suggestedClientName || "");
  /** When true, show the full matter list instead of the suggested confirm card. */
  const [browseAllCases, setBrowseAllCases] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consentObtainedRef = useRef(false);

  // URL platform detection
  useEffect(() => {
    setPlatform(detectPlatform(meetingUrl));
  }, [meetingUrl]);

  // Polling when live
  useEffect(() => {
    if (step === "live" && botId) {
      pollRef.current = setInterval(async () => {
        try {
          const data = await apiRequest<BotPollResponse>("GET", `/api/recall/bot/${botId}`);
          setBotPoll(data);

          if (data.botStatus === "in_call_recording" && !recordingStarted) {
            setRecordingStarted(true);
          }

          // Sync consent from server: if consent was confirmed via a digital link or another
          // channel while this modal is open, update local state so the UI reflects it
          if (data.consentConfirmed && !consentObtainedRef.current) {
            consentObtainedRef.current = true;
            setConsentObtained(true);
            setConsentDeclined(false);
          }

          if (data.importStatus === "transcribing" || data.importStatus === "completed" || data.importStatus === "awaiting_assignment") {
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            clearInterval(recordingTimerRef.current!);
            if (data.importStatus === "awaiting_assignment") {
              setStep("done");
              if (selectedCaseId ?? caseId) queryClient.invalidateQueries({ queryKey: [`/api/cases/${selectedCaseId ?? caseId}`] });
              queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/unassigned"] });
            } else {
              setStep("processing");
              if (selectedCaseId ?? caseId) queryClient.invalidateQueries({ queryKey: [`/api/cases/${selectedCaseId ?? caseId}`] });
            }
          }

          if (data.botStatus === "fatal") {
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            clearInterval(recordingTimerRef.current!);
            setStep("error");
            setErrorMessage("The bot was unable to join or record the meeting. Please check the meeting URL and try again.");
          }

          if (data.importStatus === "completed") {
            setStep("done");
            if (selectedCaseId ?? caseId) queryClient.invalidateQueries({ queryKey: [`/api/cases/${selectedCaseId ?? caseId}`] });
            queryClient.invalidateQueries({ queryKey: ["/api/recall/meetings"] });
          }
        } catch {
          // Ignore poll errors — connection may be briefly interrupted
        }
      }, 5000);

      timerRef.current = setInterval(() => {
        setElapsed(e => e + 1);
      }, 1000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, botId, caseId, selectedCaseId]);

  // Recording elapsed timer — starts only when bot is actually recording
  useEffect(() => {
    if (recordingStarted && step === "live") {
      recordingTimerRef.current = setInterval(() => {
        setRecordingElapsed(e => e + 1);
      }, 1000);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [recordingStarted, step]);

  // Cases for post-meeting assignment / matter picker (only fetched when needed)
  const { data: cases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: (step === "done" && !caseId) || step === "select_case",
  });

  const rankedCases = useMemo(() => {
    if (!cases?.length) return [];
    const hint = suggestedClientName || "";
    return [...cases]
      .map((c) => ({ caseItem: c, score: caseMatchScore(c, hint) }))
      .sort((a, b) => b.score - a.score || a.caseItem.title.localeCompare(b.caseItem.title));
  }, [cases, suggestedClientName]);

  const suggestedCase = useMemo(() => {
    const top = rankedCases[0];
    if (!top || top.score < SUGGEST_SCORE_THRESHOLD) return null;
    return top.caseItem;
  }, [rankedCases]);

  const showSuggestedConfirm =
    step === "select_case" && !!suggestedCase && !browseAllCases && !isCreatingCase;

  const continueAfterCaseSelect = (id: string, title: string) => {
    setSelectedCaseId(id);
    setSelectedCaseTitle(title);
    const detected = detectPlatform(meetingUrl);
    setStep(detected ? "consent" : "url");
  };

  const postAssignMutation = useMutation({
    mutationFn: async ({ assignCaseId, recordingType, createCase: shouldCreate, caseData }: {
      assignCaseId?: string;
      recordingType: string;
      createCase?: boolean;
      caseData?: { title: string; clientName: string };
    }) => {
      if (!importId) throw new Error("No import ID");
      return apiRequest("POST", `/api/recall/import/${importId}/assign`, {
        caseId: assignCaseId,
        recordingType,
        createCase: shouldCreate,
        caseData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setAssignDone(true);
    },
    onError: (error: any) => {
      toast({ title: "Assignment failed", description: error.message || "Could not assign the recording. Please try again.", variant: "destructive" });
    },
  });

  const postDiscardMutation = useMutation({
    mutationFn: async () => {
      if (!importId) throw new Error("No import ID");
      return apiRequest("POST", `/api/recall/import/${importId}/discard`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/unassigned"] });
      setAssignDone(true);
    },
    onError: (error: any) => {
      const msg = error?.message || "";
      let display = msg;
      try { const p = JSON.parse(msg.replace(/^\d{3}:\s*/, "")); if (p?.message) display = p.message; } catch {}
      toast({ title: "Could not discard recording", description: display || "Storage deletion failed. Please try again.", variant: "destructive" });
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: { title: string; clientName: string }) =>
      apiRequest("POST", "/api/cases", data),
    onSuccess: async (newCase: any) => {
      setIsCreatingCase(false);
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      continueAfterCaseSelect(newCase.id, newCase.title);
    },
    onError: (error: any) => {
      toast({ title: "Could not create case", description: error.message, variant: "destructive" });
    },
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ importId: string; botId: string; platform: string; status: string }>(
        "POST",
        "/api/recall/bot",
        { meetingUrl, ...((selectedCaseId ?? caseId) ? { caseId: selectedCaseId ?? caseId } : {}), consentMode }
      );
    },
    onSuccess: async (data) => {
      setImportId(data.importId);
      setBotId(data.botId);

      liveBotSession?.startSession({
        importId: data.importId,
        botId: data.botId,
        caseId: selectedCaseId ?? caseId,
        caseTitle: caseTitle || selectedCaseTitle || null,
        meetingUrl,
        consentMode,
      });

      // For pre_confirmed path, log consent immediately (only for client meetings)
      if (consentMode === "pre_confirmed" && (selectedCaseId ?? caseId)) {
        try {
          await apiRequest("PATCH", `/api/recall/import/${data.importId}/consent`, {
            userConfirmsVerbalConsent: true,
          });
        } catch {
          // Non-fatal — consent can be added after
        }
      }

      // Attempt to open the meeting in the platform's native client
      if (meetingUrl) {
        const lower = meetingUrl.toLowerCase();
        let deepLink: string | null = null;
        if (lower.includes('zoom.us') || lower.includes('zoom.com')) {
          // Convert https://zoom.us/j/MEETINGID to zoommtg:// scheme
          const match = meetingUrl.match(/zoom\.us\/j\/(\d+)/);
          if (match) {
            deepLink = `zoommtg://zoom.us/join?confno=${match[1]}`;
          }
        } else if (lower.includes('teams.microsoft.com') || lower.includes('teams.live.com')) {
          deepLink = meetingUrl.replace('https://', 'msteams://');
        }
        // Google Meet has no reliable deep-link scheme — open in browser tab
        if (deepLink) {
          window.location.href = deepLink;
          // Fallback to browser tab after 2s if scheme did not open
          setTimeout(() => window.open(meetingUrl, '_blank'), 2000);
        } else {
          window.open(meetingUrl, '_blank');
        }
      }

      setStep("live");
      setElapsed(0);
    },
    onError: (error: Error) => {
      const raw = error.message || "";
      const withoutStatus = raw.replace(/^\d{3}:\s*/, "");
      let display = withoutStatus;
      try {
        const parsed = JSON.parse(withoutStatus);
        if (parsed?.message) display = parsed.message;
      } catch {
        // Not JSON — use as-is
      }
      display = display.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
      const isHtmlPage = display.toLowerCase().includes("doctype") || display.toLowerCase().includes("we couldn");
      if (!display || isHtmlPage || display.length > 300) {
        display = "Failed to deploy the bot. Please check the meeting URL and try again. If the problem persists, contact support.";
      }
      setStep("error");
      setErrorMessage(display);
    },
  });

  const consentMutation = useMutation({
    mutationFn: async (consented: boolean) => {
      if (!importId) throw new Error("No import ID");
      if (consented) {
        return apiRequest("PATCH", `/api/recall/import/${importId}/consent`, {
          userConfirmsVerbalConsent: true,
          elapsedSeconds: recordingElapsed,
          consentSource: 'in_meeting_live_panel',
        });
      }
      // Log the decline server-side for GDPR audit trail
      return apiRequest("POST", `/api/recall/import/${importId}/consent-decline`, {
        elapsedSeconds: recordingElapsed,
      });
    },
    onSuccess: (data, consented) => {
      if (consented) {
        consentObtainedRef.current = true;
        setConsentObtained(true);
        setConsentRecordedElapsed(recordingElapsed); // freeze display time at confirmation
        const cid = selectedCaseId ?? caseId;
        if (cid) queryClient.invalidateQueries({ queryKey: [`/api/cases/${cid}/live-import`] });
      } else {
        setConsentDeclined(true);
        const left = (data as { botLeft?: boolean } | undefined)?.botLeft === true;
        toast({
          title: left ? "LegalNote is leaving the call" : "Consent declined",
          description: left
            ? "Client declined consent. The bot is being removed from the meeting now — you don't need to eject it manually."
            : "Consent decline was recorded. If the bot is still visible, remove it from the meeting or contact support.",
          duration: 6000,
        });
      }
    },
  });

  const sendConsentLinkMutation = useMutation({
    mutationFn: async () => {
      if (!importId) throw new Error("No import ID");
      const contact = consentLinkContact.trim();
      const isEmail = contact.includes("@");
      return apiRequest("POST", `/api/recall/import/${importId}/send-consent-link`, {
        ...(isEmail ? { contactEmail: contact } : { contactMobile: contact }),
        contactName: consentLinkName || undefined,
      });
    },
    onSuccess: () => {
      setConsentLinkSent(true);
      toast({
        title: "Consent link sent",
        description: `A consent confirmation link has been sent to ${consentLinkContact}.`,
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: "Failed to send consent link",
        description: "Please check the contact details and try again.",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const handleSendBot = () => {
    deployMutation.mutate();
  };

  // Prefill from upcoming-meeting / scheduled join so solicitor must still press Send to Call
  useEffect(() => {
    if (!open) return;
    const url = (initialMeetingUrl || "").trim();
    setBrowseAllCases(false);
    setNewCaseClient(suggestedClientName || "");
    if (!url) {
      if (!(caseId || selectedCaseId)) setStep("select_case");
      return;
    }
    setMeetingUrl(url);
    const detected = detectPlatform(url);
    setPlatform(detected);
    if (caseId || selectedCaseId) {
      setStep(detected ? "consent" : "url");
    } else {
      setStep("select_case");
    }
  }, [open, initialMeetingUrl, caseId, suggestedClientName]);

  const handleClose = () => {
    // If in-meeting consent mode and consent not yet obtained, warn but don't block
    if (step === "live" && !consentDeclined) {
      toast({
        title: "Bot still running",
        description: "LegalNote is still recording. Watch the status pill in the bottom-right — it will update when the call ends and notes are produced.",
        duration: 6000,
      });
    }
    resetState();
    onOpenChange(false);
  };

  // Tell the global indicator whether this modal is open (hides floating pill while visible)
  useEffect(() => {
    if (!liveBotSession) return;
    liveBotSession.setLiveBotModalOpen(open);
    if (!open && liveBotSession.session) {
      const p = liveBotSession.phase;
      if (
        p === "ended" ||
        p === "processing" ||
        p === "complete" ||
        p === "awaiting_assignment" ||
        p === "error"
      ) {
        liveBotSession.setPanelOpen(true);
      }
    }
    return () => liveBotSession.setLiveBotModalOpen(false);
    // Intentionally only react to open — phase/session read at close time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetState = () => {
    const url = (initialMeetingUrl || "").trim();
    const detected = url ? detectPlatform(url) : null;
    setStep(caseId ? (detected ? "consent" : "url") : "select_case");
    setMeetingUrl(url);
    setPlatform(detected);
    setConsentMode("in_meeting");
    setImportId(null);
    setBotId(null);
    setBotPoll(null);
    setErrorMessage("");
    setElapsed(0);
    setRecordingElapsed(0);
    setRecordingStarted(false);
    consentObtainedRef.current = false;
    setConsentObtained(false);
    setConsentDeclined(false);
    setConsentRecordedElapsed(null);
    setShowSendConsentLink(false);
    setConsentLinkContact("");
    setConsentLinkName("");
    setConsentLinkSent(false);
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setSelectedCaseId(caseId || null);
    setSelectedCaseTitle(caseTitle || "");
    setIsCreatingCase(false);
    setNewCaseTitle("");
    setNewCaseClient(suggestedClientName || "");
    setBrowseAllCases(false);
  };

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const currentStatus = botPoll?.botStatus;
  const isRecording = currentStatus === "in_call_recording";
  const isWaiting = currentStatus === "joining_call" || currentStatus === "in_waiting_room";
  // Prefer server-returned consentMode from poll; fall back to local selection pre-deploy
  const effectiveConsentMode = (botPoll?.consentMode as ConsentMode | undefined) ?? consentMode;
  const showInMeetingConsentCard = effectiveConsentMode === "in_meeting" && isRecording && !consentObtained && !consentDeclined;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            {step === "select_case"
              ? showSuggestedConfirm
                ? "Confirm matter"
                : "Select matter"
              : "Join meeting with LegalNote"}
          </DialogTitle>
          <DialogDescription>
            {caseTitle || selectedCaseTitle
              ? `Send the LegalNote bot to join your video call and record it for "${caseTitle || selectedCaseTitle}"`
              : "Send the LegalNote bot to join your video call. You can assign the recording to a matter after the call ends."}
          </DialogDescription>
        </DialogHeader>

        {step === "select_case" && (
          <div className="flex flex-col gap-4">
            {!isCreatingCase && !showSuggestedConfirm && (
              <p className="text-sm text-muted-foreground">
                {suggestedClientName
                  ? `Which matter is this meeting for? Matters matching “${suggestedClientName}” are listed first.`
                  : "Which matter is this meeting for?"}
              </p>
            )}

            {showSuggestedConfirm && suggestedCase ? (
              <div className="flex flex-col gap-4" data-testid="suggested-case-confirm">
                <p className="text-sm text-muted-foreground">
                  Based on the meeting invite, this looks like the right matter.
                </p>
                <div className="rounded-md border bg-muted/40 px-3 py-3 space-y-1">
                  <p className="text-sm font-medium">{suggestedCase.title}</p>
                  {suggestedCase.clientName && (
                    <p className="text-xs text-muted-foreground">{suggestedCase.clientName}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full"
                    onClick={() => continueAfterCaseSelect(suggestedCase.id, suggestedCase.title)}
                    data-testid="button-confirm-suggested-case"
                  >
                    Confirm this matter
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setBrowseAllCases(true)}
                    data-testid="button-choose-different-case"
                  >
                    Choose a different matter
                  </Button>
                </div>
              </div>
            ) : !isCreatingCase ? (
              <>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {rankedCases.map(({ caseItem: c, score }) => (
                    <button
                      key={c.id}
                      onClick={() => continueAfterCaseSelect(c.id, c.title)}
                      className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-md border text-left hover:bg-muted/50 transition-colors"
                      data-testid={`button-select-case-${c.id}`}
                    >
                      <span className="text-sm font-medium flex items-center gap-2">
                        {c.title}
                        {score >= SUGGEST_SCORE_THRESHOLD && (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            Likely match
                          </Badge>
                        )}
                      </span>
                      {c.clientName && (
                        <span className="text-xs text-muted-foreground">{c.clientName}</span>
                      )}
                    </button>
                  ))}
                  {!rankedCases.length && (
                    <p className="text-sm text-muted-foreground text-center py-4">No cases found</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setIsCreatingCase(true);
                    if (suggestedClientName && !newCaseClient) {
                      setNewCaseClient(suggestedClientName);
                    }
                  }}
                >
                  <PlusCircle className="w-4 h-4" />
                  Create new matter
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-case-title">Matter name</Label>
                  <Input
                    id="new-case-title"
                    placeholder="e.g. Smith v Jones — Conveyancing"
                    value={newCaseTitle}
                    onChange={(e) => setNewCaseTitle(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-case-client">Client name</Label>
                  <Input
                    id="new-case-client"
                    placeholder="e.g. Mr James Smith"
                    value={newCaseClient}
                    onChange={(e) => setNewCaseClient(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsCreatingCase(false)}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!newCaseTitle.trim() || !newCaseClient.trim() || createCaseMutation.isPending}
                    onClick={() => createCaseMutation.mutate({ title: newCaseTitle.trim(), clientName: newCaseClient.trim() })}
                  >
                    {createCaseMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Create & continue"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "url" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="meeting-url">Meeting link</Label>
              <Input
                id="meeting-url"
                placeholder="https://zoom.us/j/... or https://teams.microsoft.com/l/..."
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                data-testid="input-meeting-url"
              />
              {meetingUrl && (
                <p className="text-xs text-muted-foreground">
                  {platform
                    ? <span className="text-green-600 dark:text-green-400">{PLATFORM_LABELS[platform]} detected</span>
                    : <span className="text-destructive">Paste a Zoom, Teams, or Google Meet link</span>}
                </p>
              )}
            </div>

            <div className="p-3 bg-muted/40 rounded-md text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How it works</p>
              <p>LegalNote will join the call as a participant named "LegalNote". When the call ends, the recording is transcribed and your attendance note is produced automatically.</p>
              <p className="font-medium text-amber-700 dark:text-amber-400 pt-1">Nothing is recording until you press Send LegalNote to Call on the next step.</p>
            </div>

            <Button
              className="w-full"
              disabled={!platform}
              onClick={() => setStep("consent")}
              data-testid="button-continue-to-consent"
            >
              Continue
            </Button>
          </div>
        )}

        {step === "consent" && (
          <div className="space-y-5">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Recording consent is required. Confirm how you will obtain it so it is captured on the audit trail.
              </AlertDescription>
            </Alert>

            <div className="p-3 border rounded-md bg-muted/20 text-sm">
              <p className="font-medium">{PLATFORM_LABELS[platform!]} meeting</p>
              <p className="text-xs text-muted-foreground mt-0.5 break-all">{meetingUrl}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">How will you obtain consent?</p>

              <button
                type="button"
                onClick={() => setConsentMode("in_meeting")}
                className={`w-full text-left p-4 rounded-md border-2 transition-colors duration-150 ${
                  consentMode === "in_meeting"
                    ? "border-accent bg-accent/5"
                    : "border-border bg-muted/20 hover-elevate"
                }`}
                data-testid="option-consent-in-meeting"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    consentMode === "in_meeting" ? "border-accent" : "border-muted-foreground"
                  }`}>
                    {consentMode === "in_meeting" && <div className="w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">I will read the consent script at the start of the recording</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Recommended. The script appears once recording begins so the client&apos;s verbal agreement is captured on the recording and audit trail.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setConsentMode("pre_confirmed")}
                className={`w-full text-left p-4 rounded-md border-2 transition-colors duration-150 ${
                  consentMode === "pre_confirmed"
                    ? "border-accent bg-accent/5"
                    : "border-border bg-muted/20 hover-elevate"
                }`}
                data-testid="option-consent-pre-confirmed"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    consentMode === "pre_confirmed" ? "border-accent" : "border-muted-foreground"
                  }`}>
                    {consentMode === "pre_confirmed" && <div className="w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Consent already confirmed before this meeting</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Only use this if consent was obtained through LegalNote before the call (e.g. a consent email). Self-attestation alone is not a full audit trail.</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("url")} data-testid="button-back-to-url">
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={deployMutation.isPending}
                onClick={handleSendBot}
                data-testid="button-send-bot"
              >
                {deployMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending LegalNote...</>
                ) : (
                  "Send LegalNote to Call"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "live" && (
          <div className="space-y-5">
            <div className="flex flex-col items-center py-4 gap-3">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isRecording ? "bg-destructive/10" : "bg-muted"}`}>
                {isRecording
                  ? <Mic className="w-7 h-7 text-destructive animate-pulse" />
                  : <Loader2 className="w-7 h-7 text-muted-foreground animate-spin" />}
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">
                  {currentStatus ? (STATUS_LABELS[currentStatus] || currentStatus) : "Connecting..."}
                </p>
                {isRecording && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{formatElapsed(elapsed)}</p>
                )}
              </div>
              {isWaiting && (
                <div className="space-y-2 max-w-sm mx-auto">
                  <p className="text-xs text-muted-foreground text-center">
                    If your meeting has a waiting room, admit &quot;LegalNote&quot; to start recording.
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Zoom, Teams, or Meet may label the participant as &quot;unverified&quot;. That is the meeting platform&apos;s default for third-party recording bots — not a LegalNote security warning. Removing it requires platform publisher verification (Zoom Marketplace / Microsoft / Google), not a setting in this app.
                  </p>
                </div>
              )}
            </div>

            {/* In-meeting consent script card */}
            {showInMeetingConsentCard && (
              <div className="border-2 border-amber-500/50 bg-amber-500/5 rounded-md p-4 space-y-3" data-testid="card-in-meeting-consent">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Read consent script to client now</p>
                </div>
                <div className="bg-background rounded-md p-3 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">READ TO CLIENT:</p>
                  <p className="text-sm leading-relaxed italic">"{CONSENT_DISCLAIMER_TEXT}"</p>
                </div>
                <div className="bg-muted/40 p-2.5 rounded-md">
                  <p className="text-xs text-muted-foreground">
                    <strong>Recording time:</strong> {formatElapsed(recordingElapsed)} into session. The client's verbal response is being captured on the recording.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    disabled={consentMutation.isPending}
                    onClick={() => consentMutation.mutate(false)}
                    data-testid="button-client-declined"
                  >
                    <X className="w-4 h-4" />
                    Client Declined
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    disabled={consentMutation.isPending}
                    onClick={() => consentMutation.mutate(true)}
                    data-testid="button-client-consented"
                  >
                    {consentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Client Consented
                  </Button>
                </div>

                {/* Send consent link option */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowSendConsentLink(s => !s)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-send-consent-link"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send a digital consent link instead
                    {showSendConsentLink ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showSendConsentLink && !consentLinkSent && (
                    <div className="mt-2 space-y-2">
                      <Input
                        placeholder="Client email or mobile number"
                        value={consentLinkContact}
                        onChange={e => setConsentLinkContact(e.target.value)}
                        data-testid="input-consent-link-contact"
                      />
                      <Input
                        placeholder="Client name (optional)"
                        value={consentLinkName}
                        onChange={e => setConsentLinkName(e.target.value)}
                        data-testid="input-consent-link-name"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        disabled={!consentLinkContact.trim() || sendConsentLinkMutation.isPending}
                        onClick={() => sendConsentLinkMutation.mutate()}
                        data-testid="button-send-consent-link"
                      >
                        {sendConsentLinkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Send Consent Link
                      </Button>
                    </div>
                  )}
                  {consentLinkSent && (
                    <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Consent link sent to {consentLinkContact}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Consent obtained indicator */}
            {consentObtained && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-md" data-testid="alert-consent-recorded">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Consent recorded</p>
                  <p className="text-xs text-muted-foreground">Verbal consent confirmed {formatElapsed(consentRecordedElapsed ?? recordingElapsed)} into the recording.</p>
                </div>
              </div>
            )}

            {/* Consent declined — bot is ejected automatically */}
            {consentDeclined && (
              <div className="space-y-2" data-testid="alert-consent-declined">
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-destructive font-medium">Client declined consent — LegalNote is leaving</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The refusal has been logged. The bot is being removed from the call automatically. No attendance note will be produced from this session.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {botPoll?.participants && botPoll.participants.length > 0 && !consentDeclined && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Participants in call
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {botPoll.participants.map((p, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{p.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {!consentDeclined && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-md">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  You can close this panel — LegalNote keeps recording. A status pill stays in the bottom-right and will open Meeting-to-Matter when the call ends.
                </span>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={handleClose} data-testid="button-close-live">
              {consentDeclined ? "Close" : "Close panel (bot stays active)"}
            </Button>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
            <div>
              <p className="font-semibold">Call ended — producing your documents</p>
              <p className="text-sm text-muted-foreground mt-1">Transcribing and generating your attendance note. This may take a few minutes.</p>
            </div>
            <Button variant="outline" onClick={handleClose} data-testid="button-close-processing">
              Close
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            {(selectedCaseId ?? caseId) ? (
              <div className="text-center">
                <p className="font-semibold">Documents ready</p>
                <p className="text-sm text-muted-foreground mt-1">Your attendance note and transcript have been added to the matter record.</p>
                <Button onClick={handleClose} className="mt-4" data-testid="button-close-done">View documents</Button>
              </div>
            ) : assignDone ? (
              <div className="text-center">
                <p className="font-semibold">All done</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {postMeetingMode === "discard" ? "The recording has been permanently deleted." : "The recording has been assigned and is being processed."}
                </p>
                <Button onClick={handleClose} className="mt-4" data-testid="button-close-done">Close</Button>
              </div>
            ) : (
              <div className="w-full space-y-4">
                <div className="text-center">
                  <p className="font-semibold">Recording saved</p>
                  <p className="text-sm text-muted-foreground mt-1">What would you like to do with this recording?</p>
                </div>

                {postMeetingMode === "choose" && (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="default"
                      className="w-full justify-start gap-2"
                      onClick={() => setPostMeetingMode("existing")}
                      data-testid="button-post-link-existing"
                    >
                      <FolderPlus className="w-4 h-4" />
                      Link to an existing matter
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => setPostMeetingMode("create")}
                      data-testid="button-post-create-matter"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Create a new matter
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-destructive"
                      onClick={() => setPostMeetingMode("discard")}
                      data-testid="button-post-discard"
                    >
                      <Trash2 className="w-4 h-4" />
                      Discard recording
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleClose} className="w-full text-muted-foreground" data-testid="button-post-later">
                      Decide later (recording saved to dashboard)
                    </Button>
                  </div>
                )}

                {postMeetingMode === "existing" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="post-case-select">Select matter</Label>
                      <Select value={postMeetingCaseId} onValueChange={setPostMeetingCaseId}>
                        <SelectTrigger id="post-case-select" data-testid="select-post-case">
                          <SelectValue placeholder="Choose a matter..." />
                        </SelectTrigger>
                        <SelectContent>
                          {cases?.filter(c => !c.archived).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.title}{c.clientName ? ` — ${c.clientName}` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="post-rec-type">Session type</Label>
                      <Select value={postMeetingRecordingType} onValueChange={setPostMeetingRecordingType}>
                        <SelectTrigger id="post-rec-type" data-testid="select-post-recording-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_meeting">Client Meeting</SelectItem>
                          <SelectItem value="telephone_call">Telephone Call</SelectItem>
                          <SelectItem value="court_hearing">Court Hearing</SelectItem>
                          <SelectItem value="police_station">Police Station</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setPostMeetingMode("choose")} data-testid="button-post-back">Back</Button>
                      <Button
                        className="flex-1"
                        disabled={!postMeetingCaseId || postAssignMutation.isPending}
                        onClick={() => postAssignMutation.mutate({ assignCaseId: postMeetingCaseId, recordingType: postMeetingRecordingType })}
                        data-testid="button-post-assign-existing"
                      >
                        {postAssignMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Assigning…</> : "Assign & process"}
                      </Button>
                    </div>
                  </div>
                )}

                {postMeetingMode === "create" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="post-matter-title">Matter title <span className="text-accent">*</span></Label>
                      <Input
                        id="post-matter-title"
                        placeholder="e.g. Smith v Jones — contract dispute"
                        value={postMeetingTitle}
                        onChange={(e) => setPostMeetingTitle(e.target.value)}
                        data-testid="input-post-matter-title"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="post-rec-type-create">Session type</Label>
                      <Select value={postMeetingRecordingType} onValueChange={setPostMeetingRecordingType}>
                        <SelectTrigger id="post-rec-type-create" data-testid="select-post-recording-type-create">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_meeting">Client Meeting</SelectItem>
                          <SelectItem value="telephone_call">Telephone Call</SelectItem>
                          <SelectItem value="court_hearing">Court Hearing</SelectItem>
                          <SelectItem value="police_station">Police Station</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="post-matter-client">Client name <span className="text-accent">*</span></Label>
                      <Input
                        id="post-matter-client"
                        placeholder="e.g. Jane Smith"
                        value={postMeetingClient}
                        onChange={(e) => setPostMeetingClient(e.target.value)}
                        data-testid="input-post-matter-client"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setPostMeetingMode("choose")} data-testid="button-post-back-create">Back</Button>
                      <Button
                        className="flex-1"
                        disabled={!postMeetingTitle.trim() || !postMeetingClient.trim() || postAssignMutation.isPending}
                        onClick={() => postAssignMutation.mutate({
                          recordingType: postMeetingRecordingType,
                          createCase: true,
                          caseData: { title: postMeetingTitle.trim(), clientName: postMeetingClient.trim() },
                        })}
                        data-testid="button-post-create-assign"
                      >
                        {postAssignMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating…</> : "Create & process"}
                      </Button>
                    </div>
                  </div>
                )}

                {postMeetingMode === "discard" && (
                  <div className="space-y-3">
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                      This will permanently delete the stored audio recording. This cannot be undone.
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer" htmlFor="post-discard-confirm">
                      <input
                        id="post-discard-confirm"
                        type="checkbox"
                        checked={discardConfirmed}
                        onChange={(e) => setDiscardConfirmed(e.target.checked)}
                        className="mt-0.5 shrink-0"
                        data-testid="checkbox-post-discard-confirm"
                      />
                      <span className="text-sm">I confirm I want to permanently delete this recording and its audio.</span>
                    </label>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => { setPostMeetingMode("choose"); setDiscardConfirmed(false); }} data-testid="button-post-back-discard">Back</Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        disabled={!discardConfirmed || postDiscardMutation.isPending}
                        onClick={() => postDiscardMutation.mutate()}
                        data-testid="button-post-discard-confirm"
                      >
                        {postDiscardMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Deleting…</> : "Delete permanently"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={resetState} data-testid="button-try-again">
                Try again
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleClose} data-testid="button-close-error">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default LiveBotModal;
