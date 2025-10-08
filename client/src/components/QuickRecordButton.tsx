import { useState, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import ConsentModal from "@/components/ConsentModal";

export default function QuickRecordButton() {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [caseTitle, setCaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterRef, setMatterRef] = useState("");

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      // Show consent modal and start recording immediately
      setShowConsentModal(true);
      setIsRecording(true);
      setRecordingDuration(0);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  const initiateRecording = () => {
    setCountdown(3); // 3-second countdown
  };

  const cancelCountdown = () => {
    setCountdown(null);
  };

  const handleConsentGiven = () => {
    console.log('Client consent given - recording continues');
    setConsentGiven(true);
    setShowConsentModal(false);
    // Recording continues
  };

  const handleConsentDeclined = () => {
    console.log('Client consent declined - stopping recording');
    setConsentGiven(false);
    setShowConsentModal(false);
    setIsRecording(false);
    setRecordingDuration(0);
    // TODO: Show text notes fallback
    alert('Recording stopped. Text notes fallback will be implemented next.');
  };

  const stopRecording = () => {
    console.log('Quick recording stopped');
    setIsRecording(false);
    setShowMetadataModal(true);
  };

  const saveCase = () => {
    console.log('Saving case:', { caseTitle, clientName, matterRef });
    setShowMetadataModal(false);
    setRecordingDuration(0);
    setCaseTitle("");
    setClientName("");
    setMatterRef("");
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (countdown !== null) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-destructive/20 rounded-full px-3 py-1 animate-pulse">
          <span className="text-sm font-semibold text-destructive" data-testid="text-countdown">
            Recording in {countdown}...
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={cancelCountdown}
          className="text-primary-foreground"
          data-testid="button-cancel-countdown"
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <>
        <div className="flex items-center gap-3 bg-card/50 rounded-lg px-3 py-1">
          <Badge className="bg-destructive animate-pulse" data-testid="badge-quick-recording">
            Recording
          </Badge>
          <p className="text-sm font-mono font-semibold text-primary-foreground" data-testid="text-quick-duration">
            {formatDuration(recordingDuration)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={stopRecording}
            className="gap-1 text-primary-foreground h-7"
            data-testid="button-stop-quick-record"
          >
            <Square className="w-3 h-3" />
            Stop
          </Button>
        </div>
        
        <ConsentModal
          open={showConsentModal}
          onConsentGiven={handleConsentGiven}
          onConsentDeclined={handleConsentDeclined}
        />
      </>
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            onClick={initiateRecording}
            className="w-9 h-9 rounded-full bg-destructive hover:bg-destructive/90"
            data-testid="button-quick-record"
          >
            <Mic className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm max-w-[200px]">
            <strong>Quick Record:</strong> Start recording instantly, add case details after
          </p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={showMetadataModal} onOpenChange={setShowMetadataModal}>
        <DialogContent data-testid="dialog-metadata">
          <DialogHeader>
            <DialogTitle>Add Case Details</DialogTitle>
            <DialogDescription>
              Recording complete. Add case information while we process the transcription.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quick-case-title">
                Case Title <span className="text-accent">*</span>
              </Label>
              <Input
                id="quick-case-title"
                placeholder="e.g., Estate Planning Consultation"
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                data-testid="input-quick-case-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-client-name">
                Client Name <span className="text-accent">*</span>
              </Label>
              <Input
                id="quick-client-name"
                placeholder="e.g., Mrs. Catherine Williams"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                data-testid="input-quick-client-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-matter-ref">Matter Reference</Label>
              <Input
                id="quick-matter-ref"
                placeholder="e.g., MAT-2025-001"
                value={matterRef}
                onChange={(e) => setMatterRef(e.target.value)}
                data-testid="input-quick-matter-ref"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowMetadataModal(false)}
              data-testid="button-cancel-metadata"
            >
              Cancel
            </Button>
            <Button
              onClick={saveCase}
              disabled={!caseTitle || !clientName}
              className="bg-accent hover:bg-accent"
              data-testid="button-save-case"
            >
              Save & Process
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
