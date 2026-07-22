import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { LegalPageFooter } from "@/components/LegalPageFooter";
import { LegalAgreementMarkdown } from "@/components/LegalAgreementMarkdown";

const linkClass =
  "text-[hsl(18,65%,45%)] dark:text-[hsl(18,70%,62%)] hover:underline";

type CertificatePayload = {
  id: string;
  firmName: string;
  signerName: string;
  signerTitle: string;
  email: string;
  sraNumber: string | null;
  evaluationPeriodDays: number;
  feeEarnerCount: number;
  acceptedAt: string | null;
  dpaContentHash: string | null;
  evaluationContentHash: string | null;
  acceptancePayloadHash: string | null;
  documents: {
    dpa: { text: string; contentHash: string } | null;
    evaluation: { text: string; contentHash: string } | null;
  };
};

type VerifyPayload = {
  valid: boolean;
  recordSealValid: boolean;
  dpaHashValid: boolean;
  evaluationHashValid: boolean;
};

export default function AcceptanceCertificatePage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearch();
  const token = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  ).get("token");

  useEffect(() => {
    document.title = "Acceptance certificate - LegalNote";
  }, []);

  const qs = token ? `?token=${encodeURIComponent(token)}` : "";

  const { data, isLoading, isError, error } = useQuery<CertificatePayload>({
    queryKey: ["/api/legal-acceptances", id, token],
    queryFn: async () => {
      const res = await fetch(`/api/legal-acceptances/${id}${qs}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Unable to load certificate");
      }
      return res.json();
    },
    enabled: Boolean(id),
    retry: false,
  });

  const { data: verify } = useQuery<VerifyPayload>({
    queryKey: ["/api/legal-acceptances", id, "verify", token],
    queryFn: async () => {
      const res = await fetch(`/api/legal-acceptances/${id}/verify${qs}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Verify failed");
      return res.json();
    },
    enabled: Boolean(id) && Boolean(data),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-[hsl(30,25%,97%)] dark:bg-background">
      <SecondaryPageHeader />

      <main className="max-w-4xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {isLoading && (
            <div className="flex items-center gap-2 text-[hsl(25,20%,45%)] dark:text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading certificate…
            </div>
          )}

          {isError && (
            <p className="text-sm text-red-700 dark:text-red-300">
              {error instanceof Error ? error.message : "Unable to load certificate"}
            </p>
          )}

          {data && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle2
                  className="h-10 w-10 text-emerald-700 dark:text-emerald-400"
                  aria-hidden
                />
                <div>
                  <h1
                    className="text-3xl font-medium text-[hsl(25,30%,12%)] dark:text-foreground"
                    data-testid="heading-certificate"
                  >
                    Acceptance certificate
                  </h1>
                  <p className="text-sm text-[hsl(25,20%,45%)] dark:text-muted-foreground">
                    {verify?.valid
                      ? "Record seal and document hashes verified"
                      : "Certificate details"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-[hsl(25,20%,30%)] dark:text-foreground mb-10 border border-[hsl(25,15%,85%)] dark:border-border rounded-md bg-white/70 dark:bg-card p-6">
                <p>
                  <strong>Firm:</strong> {data.firmName}
                </p>
                <p>
                  <strong>Signatory:</strong> {data.signerName}, {data.signerTitle}
                </p>
                <p>
                  <strong>Email:</strong> {data.email}
                </p>
                {data.sraNumber && (
                  <p>
                    <strong>SRA:</strong> {data.sraNumber}
                  </p>
                )}
                <p>
                  <strong>Accepted at (UTC):</strong> {data.acceptedAt}
                </p>
                <p>
                  <strong>Evaluation Period:</strong> {data.evaluationPeriodDays}{" "}
                  days
                </p>
                <p>
                  <strong>Fee Earner Count:</strong> {data.feeEarnerCount}
                </p>
                <p>
                  <strong>Acceptance ID:</strong>{" "}
                  <code className="text-xs">{data.id}</code>
                </p>
                <p>
                  <strong>DPA hash:</strong>{" "}
                  <code className="text-xs break-all">{data.dpaContentHash}</code>
                </p>
                <p>
                  <strong>Evaluation hash:</strong>{" "}
                  <code className="text-xs break-all">
                    {data.evaluationContentHash}
                  </code>
                </p>
                {data.acceptancePayloadHash && (
                  <p>
                    <strong>Acceptance payload hash:</strong>{" "}
                    <code className="text-xs break-all">
                      {data.acceptancePayloadHash}
                    </code>
                  </p>
                )}
              </div>

              {data.documents.dpa && (
                <section className="mb-10">
                  <h2 className="text-xl font-medium text-[hsl(25,30%,15%)] dark:text-foreground mb-3">
                    Accepted DPA text
                  </h2>
                  <LegalAgreementMarkdown
                    text={data.documents.dpa.text}
                    className="border border-[hsl(25,15%,85%)] dark:border-border bg-white/60 dark:bg-card rounded-md p-6 max-h-[40vh] overflow-y-auto text-sm leading-relaxed text-[hsl(25,20%,30%)] dark:text-foreground"
                  />
                </section>
              )}

              {data.documents.evaluation && (
                <section className="mb-10">
                  <h2 className="text-xl font-medium text-[hsl(25,30%,15%)] dark:text-foreground mb-3">
                    Accepted Evaluation Agreement text
                  </h2>
                  <LegalAgreementMarkdown
                    text={data.documents.evaluation.text}
                    className="border border-[hsl(25,15%,85%)] dark:border-border bg-white/60 dark:bg-card rounded-md p-6 max-h-[40vh] overflow-y-auto text-sm leading-relaxed text-[hsl(25,20%,30%)] dark:text-foreground"
                  />
                </section>
              )}

              <p className="text-sm">
                <Link href="/dpa" className={linkClass}>
                  ← Back to DPA
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </main>

      <LegalPageFooter />
    </div>
  );
}
