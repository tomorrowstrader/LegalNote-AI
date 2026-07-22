import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { LegalPageFooter } from "@/components/LegalPageFooter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiRequest, getApiErrorMessage } from "@/lib/queryClient";

const linkClass = "text-[hsl(18,65%,45%)] hover:underline";

type ConfirmPayload = {
  firmName: string;
  signerName: string;
  signerTitle: string;
  email: string;
  evaluationPeriodDays: number;
  feeEarnerCount: number;
  dpa: { text: string; contentHash: string };
  evaluation: { text: string; contentHash: string };
};

export default function DpaConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [evaluationAccepted, setEvaluationAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tab, setTab] = useState<"dpa" | "evaluation">("dpa");

  useEffect(() => {
    document.title = "Confirm acceptance - LegalNote";
  }, []);

  const { data, isLoading, isError, error } = useQuery<ConfirmPayload>({
    queryKey: ["/api/dpa/confirm", token],
    queryFn: async () => {
      const res = await fetch(`/api/dpa/confirm/${token}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Invalid or expired confirmation link");
      }
      return res.json();
    },
    enabled: Boolean(token),
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiRequest<{
        ok: boolean;
        acceptanceId: string;
        verifyToken: string;
      }>("POST", `/api/dpa/confirm/${token}`, {
        dpaAccepted: true as const,
        evaluationAccepted: true as const,
      }),
    onSuccess: (result) => {
      setLocation(
        `/legal/acceptance/${result.acceptanceId}?token=${encodeURIComponent(result.verifyToken)}`,
      );
    },
    onError: (err) => {
      setFormError(getApiErrorMessage(err, "Unable to complete acceptance."));
    },
  });

  const bothTicked = dpaAccepted && evaluationAccepted;

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
            className="text-3xl font-medium text-[hsl(25,30%,12%)] mb-2"
            data-testid="heading-dpa-confirm"
          >
            Review and accept
          </h1>
          <p className="text-sm text-[hsl(25,20%,45%)] mb-8">
            Read both agreements below, then tick each checkbox to accept.
          </p>

          {isLoading && (
            <div className="flex items-center gap-2 text-[hsl(25,20%,45%)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading agreements…
            </div>
          )}

          {isError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error instanceof Error ? error.message : "Invalid link"}
              <p className="mt-2">
                <Link href="/dpa" className={linkClass}>
                  Return to DPA page
                </Link>
              </p>
            </div>
          )}

          {data && (
            <>
              <div className="mb-6 rounded-md border border-[hsl(25,15%,85%)] bg-white/70 px-4 py-3 text-sm">
                <p>
                  <strong>{data.firmName}</strong> — {data.signerName},{" "}
                  {data.signerTitle} ({data.email})
                </p>
                <p className="mt-1 text-[hsl(25,20%,45%)]">
                  Key Terms: Evaluation Period of{" "}
                  <strong>{data.evaluationPeriodDays} days</strong>; Fee Earner
                  Count of <strong>{data.feeEarnerCount}</strong>
                </p>
              </div>

              <div className="flex gap-2 mb-3">
                <Button
                  type="button"
                  variant={tab === "dpa" ? "default" : "outline"}
                  onClick={() => setTab("dpa")}
                  data-testid="tab-dpa"
                >
                  Data Processing Agreement
                </Button>
                <Button
                  type="button"
                  variant={tab === "evaluation" ? "default" : "outline"}
                  onClick={() => setTab("evaluation")}
                  data-testid="tab-evaluation"
                >
                  Governed Evaluation Agreement
                </Button>
              </div>

              <pre
                className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[hsl(25,20%,30%)] border border-[hsl(25,15%,85%)] bg-white/60 rounded-md p-6 max-h-[50vh] overflow-y-auto mb-6"
                data-testid="confirm-document-body"
              >
                {tab === "dpa" ? data.dpa.text : data.evaluation.text}
              </pre>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="accept-dpa"
                    checked={dpaAccepted}
                    onCheckedChange={(v) => setDpaAccepted(v === true)}
                    data-testid="checkbox-accept-dpa"
                  />
                  <Label htmlFor="accept-dpa" className="text-sm leading-relaxed cursor-pointer">
                    I have read and accept the Data Processing Agreement (hash{" "}
                    <code className="text-xs">{data.dpa.contentHash.slice(0, 12)}…</code>)
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="accept-evaluation"
                    checked={evaluationAccepted}
                    onCheckedChange={(v) => setEvaluationAccepted(v === true)}
                    data-testid="checkbox-accept-evaluation"
                  />
                  <Label
                    htmlFor="accept-evaluation"
                    className="text-sm leading-relaxed cursor-pointer"
                  >
                    I have read and accept the Governed Evaluation Agreement
                    (hash{" "}
                    <code className="text-xs">
                      {data.evaluation.contentHash.slice(0, 12)}…
                    </code>
                    )
                  </Label>
                </div>
              </div>

              {formError && (
                <div
                  className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <Button
                type="button"
                disabled={!bothTicked || confirmMutation.isPending}
                onClick={() => {
                  setFormError(null);
                  confirmMutation.mutate();
                }}
                className="bg-[hsl(18,65%,45%)] hover:bg-[hsl(18,65%,38%)] text-white"
                data-testid="button-confirm-accept"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording acceptance…
                  </>
                ) : (
                  "Accept both agreements"
                )}
              </Button>
            </>
          )}
        </motion.div>
      </main>

      <LegalPageFooter />
    </div>
  );
}
