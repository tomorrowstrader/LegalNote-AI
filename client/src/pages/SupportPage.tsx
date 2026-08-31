import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Mic,
  MicOff,
  LifeBuoy,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVoiceCommandRecognition } from "@/hooks/useVoiceCommandRecognition";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getApiErrorMessage, queryClient } from "@/lib/queryClient";
import type { Case, SupportTicket } from "@shared/schema";
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_SEVERITIES,
  supportCategoryLabel,
  supportSeverityLabel,
  supportStatusLabel,
  type SupportTicketCategory,
  type SupportTicketSeverity,
} from "@shared/supportTickets";
import { cn } from "@/lib/utils";

type Step = "category" | "severity" | "describe" | "review";

const STEPS: Step[] = ["category", "severity", "describe", "review"];

export default function SupportPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<SupportTicketCategory | "">("");
  const [severity, setSeverity] = useState<SupportTicketSeverity | "">("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [polishedDescription, setPolishedDescription] = useState("");
  const [caseId, setCaseId] = useState<string>("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: cases = [] } = useQuery<Case[]>({ queryKey: ["/api/cases"] });
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
  });

  const appendTranscript = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDescription((prev) => (prev ? `${prev.trim()}\n\n${trimmed}` : trimmed));
  }, []);

  const voice = useVoiceCommandRecognition({ onFinalTranscript: appendTranscript });

  useEffect(() => {
    if (!screenshot) {
      setScreenshotPreview(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setScreenshotPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  const stepIndex = STEPS.indexOf(step);

  const goNext = async () => {
    if (step === "category" && !category) {
      toast({ title: "Choose a category", variant: "destructive" });
      return;
    }
    if (step === "severity" && !severity) {
      toast({ title: "Choose how urgent this is", variant: "destructive" });
      return;
    }
    if (step === "describe") {
      if (description.trim().length < 10) {
        toast({
          title: "Tell us a bit more",
          description: "Please describe the issue in at least a sentence or two.",
          variant: "destructive",
        });
        return;
      }
      setPreviewLoading(true);
      try {
        const preview = await apiRequest<{
          title: string;
          summary: string;
          polishedDescription: string;
        }>("POST", "/api/support/tickets/preview", {
          category,
          severity,
          description: description.trim(),
        });
        setTitle(preview.title);
        setAiSummary(preview.summary);
        setPolishedDescription(preview.polishedDescription);
        setStep("review");
      } catch (err) {
        toast({
          title: "Could not prepare preview",
          description: getApiErrorMessage(err),
          variant: "destructive",
        });
      } finally {
        setPreviewLoading(false);
      }
      return;
    }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("category", category);
      form.append("severity", severity);
      form.append("description", description.trim());
      form.append("title", title.trim());
      form.append("polishedDescription", polishedDescription.trim());
      form.append("aiSummary", aiSummary.trim());
      form.append("pageUrl", window.location.href);
      form.append("userAgent", navigator.userAgent);
      if (caseId) form.append("caseId", caseId);
      if (screenshot) form.append("screenshot", screenshot);

      const res = await fetch("/api/support/tickets", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || res.statusText);
      }
      return (await res.json()) as SupportTicket;
    },
    onSuccess: (ticket) => {
      toast({
        title: "Support request sent",
        description: `Reference ${ticket.ticketRef}. We'll email you a confirmation shortly.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setCategory("");
      setSeverity("");
      setDescription("");
      setTitle("");
      setAiSummary("");
      setPolishedDescription("");
      setCaseId("");
      setScreenshot(null);
      setStep("category");
    },
    onError: (err: Error) => {
      toast({
        title: "Could not send request",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onPasteScreenshot = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setScreenshot(file);
          e.preventDefault();
        }
        break;
      }
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-4 md:p-6 space-y-6" data-testid="support-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="support-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Help &amp; Support
          </h1>
          <p className="text-sm text-muted-foreground">
            Describe what happened — voice works best. We attach safe technical context automatically.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full",
              i <= stepIndex ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === "category" && "What do you need help with?"}
            {step === "severity" && "How urgent is this?"}
            {step === "describe" && "Tell us what happened"}
            {step === "review" && "Review before sending"}
          </CardTitle>
          <CardDescription>
            {step === "describe" && "Tap the microphone and speak naturally — we'll transcribe it for you to edit."}
            {step === "review" && "Check the summary below. You can edit the title and description."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4" onPaste={step === "review" ? onPasteScreenshot : undefined}>
          {step === "category" && (
            <div className="grid gap-2">
              {SUPPORT_TICKET_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left text-sm transition-colors min-h-[44px]",
                    category === c.id ? "border-primary bg-primary/5" : "hover:bg-muted",
                  )}
                  data-testid={`support-category-${c.id}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {step === "severity" && (
            <div className="grid gap-2">
              {SUPPORT_TICKET_SEVERITIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSeverity(s.id)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left min-h-[44px]",
                    severity === s.id ? "border-primary bg-primary/5" : "hover:bg-muted",
                  )}
                  data-testid={`support-severity-${s.id}`}
                >
                  <div className="font-medium text-sm">{s.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                </button>
              ))}
            </div>
          )}

          {step === "describe" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  variant={voice.status === "listening" ? "destructive" : "secondary"}
                  onClick={() => {
                    if (voice.status === "listening") void voice.finish();
                    else void voice.start();
                  }}
                  disabled={voice.status === "transcribing" || voice.status === "unsupported"}
                  data-testid="support-voice-btn"
                >
                  {voice.status === "listening" ? (
                    <MicOff className="h-4 w-4 mr-2" />
                  ) : voice.status === "transcribing" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mic className="h-4 w-4 mr-2" />
                  )}
                  {voice.status === "listening"
                    ? "Stop"
                    : voice.status === "transcribing"
                      ? "Transcribing…"
                      : "Speak your issue"}
                </Button>
                {voice.status === "listening" && (
                  <span className="text-xs text-muted-foreground animate-pulse">Listening…</span>
                )}
              </div>
              {voice.errorMessage && (
                <p className="text-xs text-destructive">{voice.errorMessage}</p>
              )}
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Or type here — include what you were trying to do and any error messages you saw."
                rows={8}
                data-testid="support-description"
              />
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{supportCategoryLabel(category)}</Badge>
                <Badge
                  variant={severity === "blocked" ? "destructive" : "secondary"}
                >
                  {supportSeverityLabel(severity)}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-title">Title</Label>
                <Input
                  id="support-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="support-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-polished">Description</Label>
                <Textarea
                  id="support-polished"
                  value={polishedDescription}
                  onChange={(e) => setPolishedDescription(e.target.value)}
                  rows={6}
                  data-testid="support-polished"
                />
              </div>
              {aiSummary && (
                <p className="text-xs text-muted-foreground rounded-md bg-muted p-3">
                  <strong>For our team:</strong> {aiSummary}
                </p>
              )}
              <div className="space-y-2">
                <Label>Link to a matter (optional)</Label>
                <Select value={caseId || "none"} onValueChange={(v) => setCaseId(v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="support-case-select">
                    <SelectValue placeholder="No specific matter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific matter</SelectItem>
                    {cases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                        {c.matterReference ? ` (${c.matterReference})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Screenshot (optional)</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Upload image
                  </Button>
                  <span className="text-xs text-muted-foreground">or paste from clipboard on this step</span>
                </div>
                {screenshotPreview && (
                  <img
                    src={screenshotPreview}
                    alt="Screenshot preview"
                    className="max-h-48 rounded-md border object-contain"
                  />
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={stepIndex === 0 || previewLoading || submitMutation.isPending}
            >
              Back
            </Button>
            {step !== "review" ? (
              <Button
                type="button"
                onClick={() => void goNext()}
                disabled={previewLoading}
                data-testid="support-next"
              >
                {previewLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !title.trim() || !polishedDescription.trim()}
                data-testid="support-submit"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Send to support
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your requests</CardTitle>
          <CardDescription>Track status of tickets you've opened.</CardDescription>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No support requests yet.</p>
          ) : (
            <ul className="divide-y">
              {tickets.map((t) => (
                <li key={t.id} className="py-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.ticketRef} · {format(new Date(t.createdAt), "dd MMM yyyy")}
                    </div>
                  </div>
                  <Badge variant={t.status === "resolved" || t.status === "closed" ? "secondary" : "default"}>
                    {supportStatusLabel(t.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
