import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Loader2, Upload } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RECORDING_TYPE_LABELS, type RecordingType } from "@shared/schema";

interface UploadTranscriptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
}

export default function UploadTranscriptModal({
  open,
  onOpenChange,
  caseId,
  caseTitle,
}: UploadTranscriptModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [source, setSource] = useState<"paste" | "file">("paste");
  const [originalFilename, setOriginalFilename] = useState<string | undefined>();
  const [recordingType, setRecordingType] = useState<RecordingType>("full_meeting");
  const [sessionTitle, setSessionTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationMinutes, setDurationMinutes] = useState("");
  const [generateClientLetter, setGenerateClientLetter] = useState(true);
  const [authorityAttested, setAuthorityAttested] = useState(false);

  const resetState = () => {
    setContent("");
    setSource("paste");
    setOriginalFilename(undefined);
    setRecordingType("full_meeting");
    setSessionTitle("");
    setMeetingDate(new Date().toISOString().slice(0, 10));
    setDurationMinutes("");
    setGenerateClientLetter(true);
    setAuthorityAttested(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/cases/${caseId}/transcript-imports`, {
        content,
        recordingType,
        sessionTitle: sessionTitle.trim() || undefined,
        meetingDate,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        generateClientLetter,
        authorityAttested: true as const,
        source,
        originalFilename,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/sessions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/transcript`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
      toast({
        title: "Transcript accepted",
        description: "Meeting-to-Matter™ is producing your attendance note and client letter.",
        duration: 5000,
      });
      onOpenChange(false);
      resetState();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Could not import transcript",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".txt") && file.type !== "text/plain") {
      toast({
        title: "Unsupported file",
        description: "Upload a .txt transcript for now. DOCX and PDF support comes next.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 1_000_000) {
      toast({
        title: "File too large",
        description: "Transcript files must be under 1 MB.",
        variant: "destructive",
      });
      return;
    }
    const text = await file.text();
    setContent(text);
    setSource("file");
    setOriginalFilename(file.name);
  };

  const canSubmit =
    content.trim().length >= 40 &&
    authorityAttested &&
    !!meetingDate &&
    !importMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetState();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Upload Transcript
          </DialogTitle>
          <DialogDescription>
            Paste or upload a transcript for “{caseTitle}”. LegalNote will derive an attendance
            note and client letter using the same Meeting-to-Matter™ engine — without re-transcribing
            audio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transcript-content">Transcript</Label>
            <Textarea
              id="transcript-content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setSource("paste");
                setOriginalFilename(undefined);
              }}
              placeholder={`[Solicitor]: Thank you for coming in today...\n[Client]: Of course...`}
              className="min-h-[180px] font-mono text-sm"
              data-testid="textarea-transcript-content"
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {content.trim().length.toLocaleString()} characters
                {originalFilename ? ` · ${originalFilename}` : ""}
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  data-testid="input-transcript-file"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-choose-transcript-file"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Choose .txt
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Session type</Label>
              <Select
                value={recordingType}
                onValueChange={(v) => setRecordingType(v as RecordingType)}
              >
                <SelectTrigger data-testid="select-transcript-recording-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RECORDING_TYPE_LABELS) as RecordingType[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {RECORDING_TYPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-date">Meeting date</Label>
              <Input
                id="meeting-date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                data-testid="input-transcript-meeting-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-title">Session title (optional)</Label>
              <Input
                id="session-title"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="e.g. First attendance"
                data-testid="input-transcript-session-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration-minutes">Duration minutes (optional)</Label>
              <Input
                id="duration-minutes"
                type="number"
                min={0}
                max={720}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 45"
                data-testid="input-transcript-duration"
              />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="generate-client-letter"
              checked={generateClientLetter}
              onCheckedChange={(v) => setGenerateClientLetter(v === true)}
              data-testid="checkbox-generate-client-letter"
            />
            <Label htmlFor="generate-client-letter" className="text-sm font-normal leading-snug">
              Also produce a client letter from the attendance note
            </Label>
          </div>

          <Alert>
            <AlertDescription className="space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="authority-attested"
                  checked={authorityAttested}
                  onCheckedChange={(v) => setAuthorityAttested(v === true)}
                  data-testid="checkbox-authority-attested"
                />
                <Label htmlFor="authority-attested" className="text-sm font-normal leading-snug">
                  I confirm I am authorised to upload and process this transcript on this matter,
                  and that LegalNote may store it and derive attendance notes and client letters
                  from it.
                </Label>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={!canSubmit}
            data-testid="button-submit-transcript-import"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Producing…
              </>
            ) : (
              "Produce documents"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
