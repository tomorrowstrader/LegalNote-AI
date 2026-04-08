import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Shield,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PRACTICE_AREA_LABELS, type PracticeAreaKey } from "@/data/demoData";

const schema = z.object({
  practiceArea: z.string().min(1, "Practice area is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  firmName: z.string().min(1, "Firm name is required"),
  region: z.string().optional(),
  firmSize: z.string().min(1, "Firm size is required"),
  sraNumber: z.string().optional(),
  billingRate: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

const FIRM_SIZES = [
  { value: "solo", label: "Solo practice" },
  { value: "small", label: "Small (2–5 solicitors)" },
  { value: "medium", label: "Medium (6–20 solicitors)" },
  { value: "large", label: "Large (20+ solicitors)" },
];

function buildDemoUrl(values: FormValues): string {
  const base = `${window.location.origin}/demo/${values.practiceArea}`;
  const params = new URLSearchParams();
  if (values.firstName) params.set("name", values.firstName);
  if (values.lastName) params.set("lastName", values.lastName);
  if (values.firmName) params.set("firm", values.firmName);
  if (values.region) params.set("region", values.region);
  if (values.firmSize) params.set("size", values.firmSize);
  if (values.sraNumber) params.set("sraNumber", values.sraNumber);
  if (values.billingRate) params.set("rate", String(values.billingRate));
  return `${base}?${params.toString()}`;
}

async function captureLead(values: FormValues, url: string) {
  try {
    await fetch("/api/demo/capture-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: values.firstName,
        lastName: values.lastName,
        firmName: values.firmName,
        practiceArea: values.practiceArea,
        firmSize: values.firmSize,
        region: values.region || null,
        sraNumber: values.sraNumber || null,
        billingRate: values.billingRate || null,
        demoUrl: url,
      }),
    });
  } catch {
    // Non-critical: silently ignore capture failures
  }
}

function buildLinkedInSnippet(values: FormValues, url: string): string {
  const areaLabel = PRACTICE_AREA_LABELS[values.practiceArea as PracticeAreaKey] || values.practiceArea;
  return `Hi ${values.firstName},

I put together a quick preview of what LegalNote looks like for a ${areaLabel} practice — personalised with your firm name.

It shows you exactly the kind of compliance visibility your team would have: overdue obligations, matter-level risk, and your readiness score.

No login, no setup — just the real product, shaped around ${values.firmName}.

Have a look: ${url}

Happy to walk you through it live — 15 minutes, no pitch, just the tool.

[Your name]`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: `${label} copied`, duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive", duration: 3000 });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      data-testid={`button-copy-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
      {copied ? "Copied!" : `Copy ${label}`}
    </Button>
  );
}

export default function DemoGenerator() {
  const { isAdmin, isFirmAdmin, isPartner, isSupervisor } = useAuth();
  const [, setLocation] = useLocation();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedSnippet, setGeneratedSnippet] = useState<string | null>(null);
  const [showSnippet, setShowSnippet] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      practiceArea: "",
      firstName: "",
      lastName: "",
      firmName: "",
      region: "",
      firmSize: "",
      sraNumber: "",
      billingRate: 220,
    },
  });

  const canAccess = isAdmin || isFirmAdmin || isPartner || isSupervisor;

  if (!canAccess) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center" data-testid="access-denied">
        <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access restricted</h2>
        <p className="text-muted-foreground text-sm">
          The demo link generator is available to firm admins, partners, and supervisors.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setLocation("/")}>
          Return to dashboard
        </Button>
      </div>
    );
  }

  const onSubmit = (values: FormValues) => {
    const url = buildDemoUrl(values);
    const snippet = buildLinkedInSnippet(values, url);
    setGeneratedUrl(url);
    setGeneratedSnippet(snippet);
    captureLead(values, url);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6" data-testid="demo-generator-page">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Demo Link Generator</h1>
          <Badge variant="outline" className="text-xs ml-1">Admin / Team</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Generate a personalised public demo URL for a prospect. Each link creates a
          compliance dashboard tailored to their firm, practice area, and name — no login required.
        </p>
      </div>

      {/* Form */}
      <Card data-testid="card-generator-form">
        <CardHeader>
          <CardTitle className="text-base">Prospect Details</CardTitle>
          <CardDescription>Fill in the prospect's details to personalise the demo link.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="practiceArea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Practice Area *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-practice-area">
                          <SelectValue placeholder="Select practice area" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.entries(PRACTICE_AREA_LABELS) as [PracticeAreaKey, string][]).map(
                          ([key, label]) => (
                            <SelectItem key={key} value={key} data-testid={`option-area-${key}`}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Sarah" data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Mitchell" data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="firmName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firm Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Thornton & Associates"
                        data-testid="input-firm-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Manchester" data-testid="input-region" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="firmSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Firm Size *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-firm-size">
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FIRM_SIZES.map((s) => (
                            <SelectItem key={s.value} value={s.value} data-testid={`option-size-${s.value}`}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sraNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SRA Number (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. 123456" data-testid="input-sra-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billingRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Rate (£/hr, optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          placeholder="e.g. 220"
                          data-testid="input-billing-rate"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full" data-testid="button-generate-link">
                <Link2 className="w-4 h-4 mr-2" />
                Generate Demo Link
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Generated output */}
      {generatedUrl && (
        <Card data-testid="card-generated-output">
          <CardHeader>
            <CardTitle className="text-base">Generated Demo Link</CardTitle>
            <CardDescription>
              Share this link with the prospect. It works without any login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* URL display */}
            <div className="space-y-2">
              <div
                className="p-3 rounded-md bg-muted font-mono text-xs break-all border border-border select-all"
                data-testid="text-generated-url"
              >
                {generatedUrl}
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={generatedUrl} label="URL" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  data-testid="button-preview-demo"
                >
                  <a href={generatedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Open in new tab
                  </a>
                </Button>
              </div>
            </div>

            <Separator />

            {/* Inline iframe preview */}
            <div className="space-y-2" data-testid="demo-iframe-preview">
              <p className="text-sm font-medium">Preview</p>
              <p className="text-xs text-muted-foreground">
                This is exactly what the prospect will see. The full interactive demo loads below.
              </p>
              <div className="rounded-md border border-border overflow-hidden bg-muted" style={{ height: "480px" }}>
                <iframe
                  src={generatedUrl}
                  className="w-full h-full"
                  title="Demo preview"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  data-testid="iframe-demo-preview"
                />
              </div>
            </div>

            <Separator />

            {/* LinkedIn snippet */}
            <div className="space-y-2">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium w-full text-left"
                onClick={() => setShowSnippet((v) => !v)}
                data-testid="button-toggle-snippet"
              >
                <MessageSquare className="w-4 h-4" />
                LinkedIn DM Snippet
                {showSnippet ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
              {showSnippet && generatedSnippet && (
                <div className="space-y-2">
                  <pre
                    className="p-3 rounded-md bg-muted text-xs break-words whitespace-pre-wrap border border-border select-all"
                    data-testid="text-linkedin-snippet"
                  >
                    {generatedSnippet}
                  </pre>
                  <CopyButton text={generatedSnippet} label="Snippet" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
