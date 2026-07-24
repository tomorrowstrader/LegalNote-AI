import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import {
  LegalPageFooter,
  legalH1Class,
  legalLinkClass,
  legalMutedClass,
  legalPageShellClass,
} from "@/components/LegalPageFooter";
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

const firmFormSchema = z.object({
  firmName: z.string().min(1, "Required").max(300),
  signerName: z.string().min(1, "Required").max(200),
  signerTitle: z.string().min(1, "Required").max(200),
  email: z.string().email().max(255),
  sraNumber: z.string().max(50).optional(),
});

type FirmFormValues = z.infer<typeof firmFormSchema>;

function parseSignedKeyTerms(search: string): {
  evaluationPeriodDays: number | null;
  feeEarnerCount: number | null;
  ktExp: number | null;
  keyTermsSig: string | null;
  ref: string | null;
  validShape: boolean;
} {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const days = params.get("evaluationPeriodDays");
  const count = params.get("feeEarnerCount");
  const ktExp = params.get("ktExp");
  const keyTermsSig = params.get("keyTermsSig");
  const ref = params.get("ref");

  const evaluationPeriodDays = days != null && /^\d+$/.test(days) ? Number(days) : null;
  const feeEarnerCount = count != null && /^\d+$/.test(count) ? Number(count) : null;
  const expires = ktExp != null && /^\d+$/.test(ktExp) ? Number(ktExp) : null;

  return {
    evaluationPeriodDays,
    feeEarnerCount,
    ktExp: expires,
    keyTermsSig,
    ref,
    validShape:
      evaluationPeriodDays != null &&
      feeEarnerCount != null &&
      expires != null &&
      typeof keyTermsSig === "string" &&
      keyTermsSig.length > 0,
  };
}

export default function DpaPage() {
  const search = useSearch();
  const keyTerms = useMemo(() => parseSignedKeyTerms(search), [search]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = "Data Processing Agreement - LegalNote";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Accept the LegalNote Data Processing Agreement and Governed Evaluation Agreement.",
      );
    }
  }, []);

  const form = useForm<FirmFormValues>({
    resolver: zodResolver(firmFormSchema),
    defaultValues: {
      firmName: "",
      signerName: "",
      signerTitle: "",
      email: "",
      sraNumber: "",
    },
  });

  const offerExpired =
    keyTerms.ktExp != null && Math.floor(Date.now() / 1000) > keyTerms.ktExp;

  const requestMutation = useMutation({
    mutationFn: (data: FirmFormValues) =>
      apiRequest<{ ok: boolean; message: string }>("POST", "/api/dpa/request", {
        ...data,
        sraNumber: data.sraNumber || undefined,
        ref: keyTerms.ref || undefined,
        evaluationPeriodDays: keyTerms.evaluationPeriodDays,
        feeEarnerCount: keyTerms.feeEarnerCount,
        ktExp: keyTerms.ktExp,
        keyTermsSig: keyTerms.keyTermsSig,
      }),
    onSuccess: () => {
      setSubmitted(true);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Unable to start acceptance. Please try again."));
    },
  });

  return (
    <div className={legalPageShellClass}>
      <SecondaryPageHeader />

      <main className="max-w-4xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1
            className={legalH1Class}
            data-testid="heading-dpa"
          >
            Data Processing Agreement
          </h1>
          <p className={`${legalMutedClass} mb-8`}>
            Accept the DPA and Governed Evaluation Agreement for governed
            evaluation of LegalNote
          </p>

          <div className="space-y-6 text-[hsl(25,20%,30%)] dark:text-foreground mb-12">
            <p className="leading-relaxed">
              An authorised representative of your firm may accept LegalNote&apos;s
              Data Processing Agreement and Governed Evaluation Agreement below.
              Acceptance is recorded in a tamper-evident audit trail bound to the
              exact text in force, and a certificate is emailed to you.
            </p>
            <p>
              <Link href="/dpa/preview" className={legalLinkClass} data-testid="link-dpa-preview">
                Data Processing Agreement
              </Link>
              {" · "}
              <Link href="/sub-processors" className={legalLinkClass}>
                Sub-processors
              </Link>
              {" · "}
              <Link href="/privacy" className={legalLinkClass}>
                Privacy Policy
              </Link>
            </p>
          </div>

          <section
            className="border-t border-[hsl(25,15%,85%)] dark:border-border pt-10"
            aria-labelledby="dpa-accept-heading"
          >
            <h2
              id="dpa-accept-heading"
              className="text-2xl font-medium text-[hsl(25,30%,15%)] dark:text-foreground mb-2"
            >
              Accept the agreements
            </h2>

            {!keyTerms.validShape && (
              <div
                className="mb-8 rounded-md border border-[hsl(25,15%,85%)] dark:border-border bg-[hsl(30,20%,94%)] dark:bg-muted px-4 py-3 text-sm text-[hsl(25,20%,35%)] dark:text-muted-foreground"
                data-testid="dpa-missing-key-terms"
              >
                This page requires a signed acceptance link from LegalNote that
                states the Evaluation Period and Fee Earner Count. Contact{" "}
                <a href="mailto:legal@legalnote.ai" className={legalLinkClass}>
                  legal@legalnote.ai
                </a>{" "}
                if you need a link.
              </div>
            )}

            {keyTerms.validShape && offerExpired && (
              <div
                className="mb-8 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200"
                data-testid="dpa-offer-expired"
              >
                This acceptance offer has expired. Please request a new link from
                LegalNote.
              </div>
            )}

            {keyTerms.validShape && !offerExpired && (
              <div
                className="mb-8 rounded-md border border-[hsl(25,15%,85%)] dark:border-border bg-white/70 dark:bg-card px-4 py-4 text-sm text-[hsl(25,20%,30%)] dark:text-foreground"
                data-testid="dpa-key-terms"
              >
                <h3 className="font-medium text-[hsl(25,30%,15%)] dark:text-foreground mb-2">
                  Key Terms
                </h3>
                <p className="mb-1">
                  Evaluation Period:{" "}
                  <strong>{keyTerms.evaluationPeriodDays} days</strong>
                </p>
                <p>
                  Fee Earner Count: <strong>{keyTerms.feeEarnerCount}</strong>
                </p>
                <p className="mt-3 text-xs text-[hsl(25,20%,50%)] dark:text-muted-foreground">
                  These terms are set by LegalNote. By proceeding you accept them
                  as stated.
                </p>
              </div>
            )}

            {submitted ? (
              <div
                className="rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-4 text-sm text-emerald-900 dark:text-emerald-100"
                data-testid="dpa-request-sent"
              >
                <p className="font-medium mb-1">Check your email</p>
                <p>
                  We sent a confirmation link to complete acceptance. Open that
                  link to review both agreements and affirmatively accept.
                </p>
              </div>
            ) : (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((values) => {
                    setFormError(null);
                    requestMutation.mutate(values);
                  })}
                  className="space-y-5 max-w-xl"
                  data-testid="form-dpa-request"
                >
                  <h3 className="text-lg font-medium text-[hsl(25,30%,15%)] dark:text-foreground">
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
                            disabled={!keyTerms.validShape || offerExpired || requestMutation.isPending}
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
                            disabled={!keyTerms.validShape || offerExpired || requestMutation.isPending}
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
                            disabled={!keyTerms.validShape || offerExpired || requestMutation.isPending}
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
                            disabled={!keyTerms.validShape || offerExpired || requestMutation.isPending}
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
                            disabled={!keyTerms.validShape || offerExpired || requestMutation.isPending}
                            data-testid="input-sra-number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {formError && (
                    <div
                      className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200"
                      role="alert"
                      data-testid="text-dpa-error"
                    >
                      {formError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={
                      !keyTerms.validShape ||
                      offerExpired ||
                      requestMutation.isPending
                    }
                    className="bg-[hsl(18,65%,45%)] hover:bg-[hsl(18,65%,38%)] text-white"
                    data-testid="button-dpa-request"
                  >
                    {requestMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending confirmation…
                      </>
                    ) : (
                      "Email me a confirmation link"
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </section>
        </motion.div>
      </main>

      <LegalPageFooter />
    </div>
  );
}
