import { useState, useEffect, useRef } from "react";
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

interface LiveBotModalProps {
  caseId?: string | null;
  caseTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "url" | "consent" | "live" | "processing" | "done" | "error";
type ConsentMode = "pre_confirmed" | "in_meeting";

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
};

const ACTIVE_STATUSES = new Set([
  "joining_call",
  "in_waiting_room",
  "in_call_not_recording",
  "in_call_recording",
  "call_ended",
]);

const CONSENT_SCRIPT = `I'm recording this meeting to create accurate attendance notes and evidence proper client care. The audio stays confidential in your case file only, used by me or my direct team if needed, and the audio is deleted after 7 days. Do you consent?`;

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

export function LiveBotModal({ caseId, caseTitle, open, onOpenChange }: LiveBotModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("url");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [platform, setPlatform] = useState<string | null>(null);
  const [consentMode, setConsentMode] = useState<ConsentMode>("pre_confirmed");
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
              if (caseId) queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
              queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/unassigned"] });
            } else {
              setStep("processing");
              if (caseId) queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
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
            if (caseId) queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
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
  }, [step, botId, caseId]);

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

  // Cases for post-meeting assignment (only fetched when needed)
  const { data: cases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: step === "done" && !caseId,
  });

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

  const deployMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ importId: string; botId: string; platform: string; status: string }>(
        "POST",
        "/api/recall/bot",
        { meetingUrl, ...(caseId ? { caseId } : {}), consentMode }
      );
    },
    onSuccess: async (data) => {
      setImportId(data.importId);
      setBotId(data.botId);

      // For pre_confirmed path, log consent immediately (only for client meetings)
      if (consentMode === "pre_confirmed" && caseId) {
        try {
          await apiRequest("PATCH", `/api/recall/import/${data.importId}/consent`, {
            userConfirmsVerbalConsent: true,
          });
        } catch {
          // Non-fatal — consent can be added after
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
    onSuccess: (_, consented) => {
      if (consented) {
        consentObtainedRef.current = true;
        setConsentObtained(true);
        setConsentRecordedElapsed(recordingElapsed); // freeze display time at confirmation
        queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/live-import`] });
      } else {
        setConsentDeclined(true);
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

  const handleClose = () => {
    // If in-meeting consent mode and consent not yet obtained, warn but don't block
    if (step === "live") {
      toast({
        title: "Bot still running",
        description: "LegalNote is still recording. This window will close but the bot will continue until the call ends.",
        duration: 5000,
      });
    }
    resetState();
    onOpenChange(false);
  };

  const resetState = () => {
    setStep("url");
    setMeetingUrl("");
    setPlatform(null);
    setConsentMode("pre_confirmed");
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
            Join with LegalNote
          </DialogTitle>
          <DialogDescription>
            {caseTitle
              ? `Send the LegalNote bot to join your video call and record it for "${caseTitle}"`
              : "Send the LegalNote bot to join your video call. You can assign the recording to a matter after the call ends."}
          </DialogDescription>
        </DialogHeader>

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
                <strong>GDPR — Recording consent required.</strong> Choose how you will obtain consent from all participants.
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
                    <p className="text-xs text-muted-foreground mt-0.5">You have already obtained informed consent from all participants prior to this session.</p>
                  </div>
                </div>
              </button>

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
                    <p className="text-xs text-muted-foreground mt-0.5">The GDPR consent script will appear once recording begins. The client's verbal agreement will be captured on the recording.</p>
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
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                ) : (
                  "Send to Call"
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
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  If your meeting has a waiting room, admit "LegalNote" to start recording.
                </p>
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
                  <p className="text-sm leading-relaxed italic">"{CONSENT_SCRIPT}"</p>
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

            {/* Consent declined indicator + recovery send-link option */}
            {consentDeclined && (
              <div className="space-y-2" data-testid="alert-consent-declined">
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-destructive font-medium">Client declined consent</p>
                    <p className="text-xs text-muted-foreground mt-0.5">The client's refusal has been noted. You can still send a digital consent link for them to review.</p>
                  </div>
                </div>
                {!consentLinkSent && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowSendConsentLink(s => !s)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-send-consent-link-declined"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send a digital consent link
                      {showSendConsentLink ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {showSendConsentLink && (
                      <div className="mt-2 space-y-2">
                        <Input
                          placeholder="Client email or mobile number"
                          value={consentLinkContact}
                          onChange={e => setConsentLinkContact(e.target.value)}
                          data-testid="input-consent-link-contact-declined"
                        />
                        <Input
                          placeholder="Client name (optional)"
                          value={consentLinkName}
                          onChange={e => setConsentLinkName(e.target.value)}
                          data-testid="input-consent-link-name-declined"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          disabled={!consentLinkContact.trim() || sendConsentLinkMutation.isPending}
                          onClick={() => sendConsentLinkMutation.mutate()}
                          data-testid="button-send-consent-link-declined"
                        >
                          {sendConsentLinkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Send Consent Link
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {consentLinkSent && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Consent link sent to {consentLinkContact}
                  </p>
                )}
              </div>
            )}

            {botPoll?.participants && botPoll.participants.length > 0 && (
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

            <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-md">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>You can close this panel — LegalNote will continue recording and process the transcript automatically when the call ends.</span>
            </div>

            <Button variant="outline" className="w-full" onClick={handleClose} data-testid="button-close-live">
              Close panel (bot stays active)
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
            {caseId ? (
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
                          <SelectItem value="internal_meeting">Internal Meeting</SelectItem>
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
                          <SelectItem value="internal_meeting">Internal Meeting</SelectItem>
                          <SelectItem value="court_hearing">Court Hearing</SelectItem>
                          <SelectItem value="police_station">Police Station</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {postMeetingRecordingType !== "internal_meeting" && (
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
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setPostMeetingMode("choose")} data-testid="button-post-back-create">Back</Button>
                      <Button
                        className="flex-1"
                        disabled={!postMeetingTitle.trim() || (postMeetingRecordingType !== "internal_meeting" && !postMeetingClient.trim()) || postAssignMutation.isPending}
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
