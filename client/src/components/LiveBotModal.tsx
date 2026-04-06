import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Video,
  Shield,
  CheckCircle2,
  AlertCircle,
  Mic,
  Clock,
  Users,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LiveBotModalProps {
  caseId: string;
  caseTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "url" | "consent" | "live" | "processing" | "done" | "error";

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
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [botId, setBotId] = useState<string | null>(null);
  const [botPoll, setBotPoll] = useState<BotPollResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

          if (data.importStatus === "transcribing" || data.importStatus === "completed") {
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            setStep("processing");
            queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
          }

          if (data.botStatus === "fatal") {
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            setStep("error");
            setErrorMessage("The bot was unable to join or record the meeting. Please check the meeting URL and try again.");
          }

          if (data.importStatus === "completed") {
            setStep("done");
            queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
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

  const deployMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ importId: string; botId: string; platform: string; status: string }>(
        "POST",
        "/api/recall/bot",
        { meetingUrl, caseId }
      );
    },
    onSuccess: async (data) => {
      setImportId(data.importId);
      setBotId(data.botId);

      // Record verbal consent attestation
      try {
        await apiRequest("PATCH", `/api/recall/import/${data.importId}/consent`, {
          userConfirmsVerbalConsent: true,
        });
      } catch {
        // Non-fatal — consent can be added after
      }

      setStep("live");
      setElapsed(0);
    },
    onError: (error: Error) => {
      const raw = error.message || "";
      // Strip HTTP status code prefix (e.g. "503: ")
      const withoutStatus = raw.replace(/^\d{3}:\s*/, "");
      // Try to extract message from a JSON body
      let display = withoutStatus;
      try {
        const parsed = JSON.parse(withoutStatus);
        if (parsed?.message) display = parsed.message;
      } catch {
        // Not JSON — use as-is
      }
      // Strip any residual HTML tags and collapse whitespace
      display = display.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
      // Replace Replit error pages or anything suspiciously long with a safe fallback
      const isHtmlPage = display.toLowerCase().includes("doctype") || display.toLowerCase().includes("we couldn");
      if (!display || isHtmlPage || display.length > 300) {
        display = "Failed to deploy the bot. Please check the meeting URL and try again. If the problem persists, contact support.";
      }
      setStep("error");
      setErrorMessage(display);
    },
  });

  const handleSendBot = () => {
    if (!platform || !consentConfirmed) return;
    // Stay on consent step while deploying; onSuccess moves to "live"
    deployMutation.mutate();
  };

  const handleClose = () => {
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
    setConsentConfirmed(false);
    setImportId(null);
    setBotId(null);
    setBotPoll(null);
    setErrorMessage("");
    setElapsed(0);
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Join with LegalNote
          </DialogTitle>
          <DialogDescription>
            Send the LegalNote bot to join your video call and record it for "{caseTitle}"
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
                <strong>GDPR — Recording consent required.</strong> You must have obtained informed consent from all participants before the bot joins.
              </AlertDescription>
            </Alert>

            <div className="p-3 border rounded-md bg-muted/20 text-sm">
              <p className="font-medium">{PLATFORM_LABELS[platform!]} meeting</p>
              <p className="text-xs text-muted-foreground mt-0.5 break-all">{meetingUrl}</p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="live-consent"
                checked={consentConfirmed}
                onCheckedChange={(v) => setConsentConfirmed(v === true)}
                data-testid="checkbox-live-consent"
              />
              <Label htmlFor="live-consent" className="text-sm leading-relaxed cursor-pointer">
                I confirm all participants have been informed that this meeting will be recorded by LegalNote for the purpose of producing legal documentation, and have consented to this recording.
              </Label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("url")} data-testid="button-back-to-url">
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!consentConfirmed || deployMutation.isPending}
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
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold">Documents ready</p>
              <p className="text-sm text-muted-foreground mt-1">Your attendance note and transcript have been added to the matter record.</p>
            </div>
            <Button onClick={handleClose} data-testid="button-close-done">
              View documents
            </Button>
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
