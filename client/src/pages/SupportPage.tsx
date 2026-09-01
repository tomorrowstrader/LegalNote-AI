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
  X,
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

function ticketStatusDisplay(status: string): {
  label: string;
  dotClass: string;
  hint: string;
} {
  switch (status) {
    case "open":
      return {
        label: "Open",
        dotClass: "bg-amber-500",
        hint: "In our queue",
      };
    case "in_progress":
      return {
        label: "In progress",
        dotClass: "bg-blue-500",
        hint: "Team is working on it",
      };
    case "resolved":
      return {
        label: "Resolved",
        dotClass: "bg-emerald-500",
        hint: "Completed",
      };
    case "closed":
      return {
        label: "Closed",
        dotClass: "bg-muted-foreground/60",
        hint: "Archived",
      };
    default:
      return {
        label: supportStatusLabel(status),
        dotClass: "bg-muted-foreground/60",
        hint: "",
      };
  }
}

function TicketStatusIndicator({ status }: { status: string }) {
  const { label, dotClass, hint } = ticketStatusDisplay(status);
  return (
    <div
      className="flex flex-col items-end gap-0.5 shrink-0"
      role="status"
      aria-label={`Status: ${label}${hint ? ` — ${hint}` : ""}`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", dotClass)} aria-hidden />
        {label}
      </span>
      {hint ? <span className="text-[10px] text-muted-foreground/80">{hint}</span> : null}
    </div>
  );
}

const MAX_SCREENSHOTS = 8;

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
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
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
    const urls = screenshots.map((f) => URL.createObjectURL(f));
    setScreenshotPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [screenshots]);

  const addScreenshotFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!incoming.length) return;
    setScreenshots((prev) => {
      const merged = [...prev, ...incoming].slice(0, MAX_SCREENSHOTS);
      return merged;
    });
  }, []);

  const removeScreenshot = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

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
      screenshots.forEach((file) => form.append("screenshots", file));

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
      setScreenshots([]);
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
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length) {
      addScreenshotFiles(imageFiles);
      e.preventDefault();
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
            {step === "describe" && "Tap the microphone and speak — we'll transcribe it for you to edit below."}
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
            <div className="space-y-5">
              <div className="flex flex-col items-center py-4">
                <button
                  type="button"
                  onClick={() => {
                    if (voice.status === "listening") void voice.finish();
                    else void voice.start();
                  }}
                  disabled={voice.status === "transcribing" || voice.status === "unsupported"}
                  className={cn(
                    "flex h-28 w-28 items-center justify-center rounded-full shadow-lg transition-transform",
                    "border-4 border-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    voice.status === "listening"
                      ? "bg-red-600 text-white ring-4 ring-red-500/30 scale-105"
                      : "bg-primary text-primary-foreground hover:scale-105",
                    (voice.status === "transcribing" || voice.status === "unsupported") && "opacity-60 cursor-not-allowed",
                  )}
                  data-testid="support-voice-btn"
                  aria-label={
                    voice.status === "listening"
                      ? "Stop recording"
                      : voice.status === "transcribing"
                        ? "Transcribing"
                        : "Speak your issue"
                  }
                >
                  {voice.status === "transcribing" ? (
                    <Loader2 className="h-10 w-10 animate-spin" />
                  ) : voice.status === "listening" ? (
                    <MicOff className="h-10 w-10" />
                  ) : (
                    <Mic className="h-10 w-10" />
                  )}
                </button>
                <p className="mt-4 text-sm font-medium text-center">
                  {voice.status === "listening"
                    ? "Listening… tap to stop"
                    : voice.status === "transcribing"
                      ? "Transcribing your message…"
                      : "Speak your issue"}
                </p>
                <p className="text-xs text-muted-foreground text-center mt-1 max-w-xs">
                  Describe what you were doing and what went wrong. We'll turn it into text you can edit.
                </p>
              </div>

              {voice.errorMessage && (
                <p className="text-xs text-destructive text-center">{voice.errorMessage}</p>
              )}

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">or type</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Prefer typing? Briefly describe the issue and any error messages."
                rows={3}
                className="text-sm resize-none"
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
                <Label>Screenshots (optional)</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) addScreenshotFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={screenshots.length >= MAX_SCREENSHOTS}
                  >
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Add images
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    up to {MAX_SCREENSHOTS} · paste from clipboard
                  </span>
                </div>
                {screenshotPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {screenshotPreviews.map((src, i) => (
                      <div key={src} className="relative">
                        <img
                          src={src}
                          alt={`Screenshot ${i + 1}`}
                          className="h-24 w-24 rounded-md border object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeScreenshot(i)}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow flex items-center justify-center"
                          aria-label="Remove screenshot"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
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
          <CardDescription>
            Status updates are emailed to you — nothing to click here.
          </CardDescription>
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
                <li
                  key={t.id}
                  className="py-3 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t.ticketRef} · {format(new Date(t.createdAt), "dd MMM yyyy")}
                    </div>
                  </div>
                  <TicketStatusIndicator status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
