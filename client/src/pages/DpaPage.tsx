import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { dpaStartRequestSchema, type DpaStartRequest } from "@shared/schema";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { LegalPageFooter } from "@/components/LegalPageFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest, getApiErrorMessage } from "@/lib/queryClient";

const linkClass = "text-[hsl(18,65%,45%)] hover:underline";

type DpaStatus = { enabled: boolean; available: boolean };
type DpaFormError = {
  message: string;
  consentUrl?: string;
};

function getRefFromUrl(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("ref") || "";
}

export default function DpaPage() {
  const search = useSearch();
  const refFromUrl = getRefFromUrl(search);
  const [formError, setFormError] = useState<DpaFormError | null>(null);

  useEffect(() => {
    document.title = "Data Processing Agreement - LegalNote";

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Sign the LegalNote Data Processing Agreement (DPA) for governed evaluation and B2B use of the LegalNote platform.",
      );
    }
  }, []);

  const { data: status } = useQuery<DpaStatus>({
    queryKey: ["/api/dpa/status"],
  });

  const form = useForm<DpaStartRequest>({
    resolver: zodResolver(dpaStartRequestSchema),
    defaultValues: {
      firmName: "",
      signerName: "",
      signerTitle: "",
      email: "",
      sraNumber: "",
      ref: refFromUrl || undefined,
    },
  });

  useEffect(() => {
    if (refFromUrl) {
      form.setValue("ref", refFromUrl);
    }
  }, [refFromUrl, form]);

  const startMutation = useMutation({
    mutationFn: (data: DpaStartRequest) =>
      apiRequest<{ signingUrl: string; envelopeId: string }>(
        "POST",
        "/api/dpa/start",
        data,
      ),
    onSuccess: (result) => {
      window.location.href = result.signingUrl;
    },
    onError: (error) => {
      const raw = error instanceof Error ? error.message : "";
      const withoutStatus = raw.replace(/^\d{3}:\s*/, "").trim();
      try {
        const parsed = JSON.parse(withoutStatus);
        if (
          parsed?.code === "DOCUSIGN_CONSENT_REQUIRED" &&
          typeof parsed?.consentUrl === "string"
        ) {
          setFormError({
            message:
              "DocuSign needs one-time JWT consent before embedded signing can start.",
            consentUrl: parsed.consentUrl,
          });
          return;
        }
      } catch {
        // Fall through to the shared user-facing parser.
      }
      setFormError({
        message: getApiErrorMessage(error, "Unable to start signing. Please try again."),
      });
    },
  });

  const statusLoaded = status !== undefined;
  const signingAvailable = status?.available === true;
  const formDisabled = (statusLoaded && !signingAvailable) || startMutation.isPending;

  return (
    <div className="min-h-screen bg-[hsl(30,25%,97%)] dark:bg-background">
      <SecondaryPageHeader />

      <main className="max-w-4xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1
            className="text-4xl font-medium text-[hsl(25,30%,12%)] mb-2"
            data-testid="heading-dpa"
          >
            Data Processing Agreement
          </h1>
          <p className="text-[hsl(25,20%,45%)] mb-8">
            For governed evaluation clients and law firms using LegalNote as a
            processor
          </p>

          <div className="space-y-6 text-[hsl(25,20%,30%)] mb-12">
            <p className="leading-relaxed">
              Firms that require a Data Processing Agreement (DPA) under UK GDPR
              may review and electronically sign LegalNote&apos;s DPA below.
              Upon completion, DocuSign emails a copy of the executed agreement
              to the address you provide.
            </p>
            <p className="leading-relaxed text-sm text-[hsl(25,20%,45%)]">
              Entering into a new DPA replaces any prior LegalNote DPA in its
              entirety. This DPA supplements the{" "}
              <Link href="/terms" className={linkClass}>
                Terms of Service
              </Link>
              .
            </p>
            <p>
              <Link
                href="/dpa/preview"
                className={linkClass}
                data-testid="link-dpa-preview"
              >
                Review the current DPA text
              </Link>
              {" · "}
              <Link href="/sub-processors" className={linkClass}>
                Sub-processors
              </Link>
              {" · "}
              <Link href="/privacy" className={linkClass}>
                Privacy Policy
              </Link>
            </p>
          </div>

          <section
            className="border-t border-[hsl(25,15%,85%)] pt-10"
            aria-labelledby="dpa-sign-heading"
          >
            <h2
              id="dpa-sign-heading"
              className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-2"
            >
              Sign the DPA
            </h2>
            <p className="text-sm text-[hsl(25,20%,45%)] mb-8">
              Complete your firm and signer details to open a secure DocuSign
              signing session. You will be redirected back here when finished.
            </p>

            {statusLoaded && !signingAvailable && (
              <div
                className="mb-8 rounded-md border border-[hsl(25,15%,85%)] bg-[hsl(30,20%,94%)] px-4 py-3 text-sm text-[hsl(25,20%,35%)]"
                data-testid="dpa-signing-unavailable"
              >
                Electronic signing is not available yet. You can still{" "}
                <Link href="/dpa/preview" className={linkClass}>
                  review the DPA text
                </Link>
                , or contact{" "}
                <a href="mailto:legal@legalnote.ai" className={linkClass}>
                  legal@legalnote.ai
                </a>{" "}
                to arrange execution.
              </div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => {
                  setFormError(null);
                  startMutation.mutate({
                    ...values,
                    ref: values.ref || refFromUrl || undefined,
                  });
                })}
                className="space-y-5 max-w-xl"
                data-testid="form-dpa-start"
              >
                <h3 className="text-lg font-medium text-[hsl(25,30%,15%)]">
                  Company Information
                </h3>

                <FormField
                  control={form.control}
                  name="firmName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Legal Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Example LLP"
                          disabled={formDisabled}
                          data-testid="input-firm-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="signerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Signatory Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={formDisabled}
                          data-testid="input-signer-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="signerTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Signatory Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Partner, COLP, Managing Director…"
                          disabled={formDisabled}
                          data-testid="input-signer-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Signatory Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          autoComplete="email"
                          disabled={formDisabled}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sraNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SRA No.</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Solicitors Regulation Authority number"
                          disabled={formDisabled}
                          data-testid="input-sra-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {refFromUrl ? (
                  <p className="text-xs text-[hsl(25,20%,50%)]">
                    Evaluation reference: <code>{refFromUrl}</code>
                  </p>
                ) : null}

                {formError && (
                  <div
                    className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
                    role="alert"
                    data-testid="text-dpa-error"
                  >
                    <p>{formError.message}</p>
                    {formError.consentUrl && (
                      <a
                        href={formError.consentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block underline"
                      >
                        Grant DocuSign JWT consent
                      </a>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!signingAvailable || startMutation.isPending}
                  className="bg-[hsl(18,65%,45%)] hover:bg-[hsl(18,65%,38%)] text-white"
                  data-testid="button-start-dpa-signing"
                >
                  {startMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening DocuSign…
                    </>
                  ) : !statusLoaded ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking availability…
                    </>
                  ) : (
                    "Continue to sign"
                  )}
                </Button>
              </form>
            </Form>
          </section>
        </motion.div>
      </main>

      <LegalPageFooter />
    </div>
  );
}
