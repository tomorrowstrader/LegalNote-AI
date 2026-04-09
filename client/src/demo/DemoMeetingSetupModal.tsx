import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Square } from "lucide-react";

type ModalStep = "setup" | "connecting" | "in_call";

interface DemoMeetingSetupModalProps {
  open: boolean;
  caseTitle: string;
  onEndRecording: () => void;
  onClose: () => void;
  onConsentConfirmed: () => void;
  onConnectClick?: () => void;
}

const CONSENT_SCRIPT_TEXT = `"I'm recording this meeting to create accurate attendance notes and evidence proper client care. The audio stays confidential in your case file only, used by me or my direct team if needed, and deleted after 7 days. Do you consent?"`;

const CONNECTING_MESSAGES = [
  { text: "Joining Microsoft Teams call...", duration: 1000 },
  { text: "Authenticating with meeting host...", duration: 1000 },
  { text: "LegalNote recorder connected.", duration: 800 },
];

const TRANSCRIPT_LINES = [
  "Solicitor: Good morning. Thank you for coming in today.",
  "Solicitor: Before we begin, I need to confirm a few things with you.",
  "Solicitor: I'll be recording this meeting with your consent.",
  "Client: Yes, that's fine. I consent to the recording.",
  "Solicitor: Thank you. I've made a note of your consent.",
  "Solicitor: Can you tell me about your current living situation?",
  "Client: So, me and my husband — we separated about three months ago.",
  "Client: He moved out of the family home.",
  "Solicitor: I understand. That must be a very difficult situation.",
  "Client: We have two children together — Emily, she's seven, and Oliver who's just turned five.",
];

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DemoMeetingSetupModal({
  open,
  caseTitle,
  onEndRecording,
  onClose,
  onConsentConfirmed,
  onConnectClick,
}: DemoMeetingSetupModalProps) {
  const [step, setStep] = useState<ModalStep>("setup");
  const [connectingMsgIndex, setConnectingMsgIndex] = useState(0);
  const [consentState, setConsentState] = useState<"pending" | "confirmed" | "deferred">("pending");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [visibleTranscriptLines, setVisibleTranscriptLines] = useState<string[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [showEndCallout, setShowEndCallout] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("setup");
      setConnectingMsgIndex(0);
      setConsentState("pending");
      setElapsedSeconds(0);
      setVisibleTranscriptLines([]);
      setShowEndCallout(false);
    }
  }, [open]);

  useEffect(() => {
    if (step !== "connecting") return;
    let idx = 0;
    let cancelled = false;
    setConnectingMsgIndex(0);
    const timers: ReturnType<typeof setTimeout>[] = [];

    const runMessages = () => {
      if (cancelled) return;
      if (idx >= CONNECTING_MESSAGES.length) {
        if (!cancelled) setStep("in_call");
        return;
      }
      setConnectingMsgIndex(idx);
      idx++;
      const dur = CONNECTING_MESSAGES[idx - 1]?.duration ?? 1000;
      const t = setTimeout(runMessages, dur);
      timers.push(t);
    };

    const t0 = setTimeout(runMessages, 300);
    timers.push(t0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [step]);

  useEffect(() => {
    if (step !== "in_call") return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step !== "in_call") return;
    let lineIdx = 0;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const addLine = () => {
      if (cancelled || lineIdx >= TRANSCRIPT_LINES.length) return;
      setVisibleTranscriptLines((prev) => [...prev, TRANSCRIPT_LINES[lineIdx]]);
      lineIdx++;
      const t = setTimeout(addLine, 1500);
      timers.push(t);
    };
    const t0 = setTimeout(addLine, 500);
    timers.push(t0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [step]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [visibleTranscriptLines]);

  const handleConnect = () => {
    setStep("connecting");
    onConnectClick?.();
  };

  const handleConsentConfirmed = () => {
    setConsentState("confirmed");
    setShowEndCallout(true);
    onConsentConfirmed();
  };

  const handleConsentLater = () => {
    setConsentState("deferred");
    setShowEndCallout(true);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden" data-testid="demo-meeting-modal">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle data-testid="demo-meeting-title">
            {step === "setup" && "Join a meeting"}
            {step === "connecting" && "Connecting..."}
            {step === "in_call" && "Recording in progress"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5">
          {step === "setup" && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-sm text-foreground/80">
                <div className="text-xs text-muted-foreground mb-1 font-medium">Meeting URL</div>
                <div className="font-mono text-xs break-all">
                  https://teams.microsoft.com/l/meetup-join/demo-consultation
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs text-muted-foreground">Microsoft Teams detected</span>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1 font-medium">Linked matter</div>
                <div className="rounded-md border border-border px-3 py-2 text-sm bg-background">
                  {caseTitle}
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted/40 px-3 py-3 space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Read this to your client:</p>
                <p className="text-xs text-foreground leading-relaxed italic">{CONSENT_SCRIPT_TEXT}</p>
                <p className="text-xs text-muted-foreground/70 pt-0.5">
                  This script is standardized by the platform — identical GDPR-compliant wording, every time.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  data-testid="demo-meeting-cancel"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConnect}
                  data-testid="demo-meeting-connect"
                  className="flex-1"
                >
                  Connect to meeting
                </Button>
              </div>
            </div>
          )}

          {step === "connecting" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="space-y-1 text-center">
                {CONNECTING_MESSAGES.map((msg, i) => (
                  <p
                    key={i}
                    className={`text-sm transition-opacity duration-300 ${
                      i <= connectingMsgIndex ? "opacity-100 text-foreground" : "opacity-30 text-muted-foreground"
                    } ${i === connectingMsgIndex ? "font-medium" : ""}`}
                  >
                    {msg.text}
                  </p>
                ))}
              </div>
            </div>
          )}

          {step === "in_call" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                </span>
                <span className="text-sm font-mono font-semibold" data-testid="demo-recording-timer">
                  {formatTimer(elapsedSeconds)}
                </span>
                <Badge variant="destructive" className="text-xs">LIVE</Badge>
              </div>

              {consentState === "pending" && (
                <div className="rounded-md border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 space-y-3" data-testid="demo-consent-section">
                  <p className="text-sm font-medium text-foreground">
                    Have you confirmed verbal consent from all meeting attendees?
                  </p>
                  <div className="rounded-md bg-background/70 border border-border px-3 py-2.5 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Standardized consent script:</p>
                    <p className="text-xs text-foreground leading-relaxed italic">{CONSENT_SCRIPT_TEXT}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Confirm verbal consent now — timestamped, GDPR Article 7 compliant, HMAC-sealed to the audit trail.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleConsentConfirmed}
                      data-testid="demo-consent-confirm"
                    >
                      Yes, consent confirmed
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleConsentLater}
                      data-testid="demo-consent-later"
                    >
                      I'll confirm later
                    </Button>
                  </div>
                </div>
              )}

              {consentState === "confirmed" && (
                <div className="rounded-md border border-green-500/40 bg-green-50/50 dark:bg-green-950/20 px-3 py-2 flex items-center gap-2" data-testid="demo-consent-confirmed-banner">
                  <span className="text-green-600 dark:text-green-400 text-xs font-medium">Consent confirmed — logged to audit trail</span>
                </div>
              )}

              {consentState === "deferred" && (
                <div className="rounded-md border border-muted px-3 py-2 flex items-center gap-2" data-testid="demo-consent-deferred-banner">
                  <span className="text-muted-foreground text-xs">Consent pending — confirm before session ends</span>
                </div>
              )}

              <div>
                <div className="text-xs text-muted-foreground mb-1.5 font-medium">Live transcript</div>
                <div
                  ref={transcriptRef}
                  className="rounded-md border border-border bg-muted/30 px-3 py-2 h-36 overflow-y-auto space-y-1.5 scroll-smooth"
                  data-testid="demo-live-transcript"
                >
                  {visibleTranscriptLines.map((line, i) => {
                    const isSolicitor = line.startsWith("Solicitor:");
                    return (
                      <p
                        key={i}
                        className={`text-xs leading-relaxed animate-in fade-in duration-500 ${
                          isSolicitor ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {line}
                      </p>
                    );
                  })}
                  {visibleTranscriptLines.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 italic">Transcript will appear here...</p>
                  )}
                </div>
              </div>

              {showEndCallout && (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    Recording is live. End the meeting when your session is complete. In a real session, LegalNote continues recording in the background.
                  </p>
                </div>
              )}

              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={onEndRecording}
                data-testid="demo-end-recording"
              >
                <Square className="w-3.5 h-3.5 mr-2" />
                End Recording
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
