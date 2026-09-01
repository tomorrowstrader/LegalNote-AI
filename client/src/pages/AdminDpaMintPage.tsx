import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Copy, Check, Link2, Mail, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getApiErrorMessage } from "@/lib/queryClient";

type MintResult = {
  url: string;
  evaluationPeriodDays: number;
  feeEarnerCount: number;
  ktExp: number;
  validForDays: number;
  expiresAt: string;
  expiresAtDisplay: string;
  ref: string | null;
};

type SendInviteResult = MintResult & {
  success: boolean;
  message: string;
  messageId?: string;
};

function buildMintPayload(
  evaluationPeriodDays: string,
  feeEarnerCount: string,
  validForDays: string,
  ref: string,
) {
  return {
    evaluationPeriodDays: Number(evaluationPeriodDays),
    feeEarnerCount: Number(feeEarnerCount),
    validForDays: Number(validForDays),
    ref: ref.trim() || undefined,
  };
}

export default function AdminDpaMintPage() {
  const { toast } = useToast();
  const [evaluationPeriodDays, setEvaluationPeriodDays] = useState("21");
  const [feeEarnerCount, setFeeEarnerCount] = useState("3");
  const [validForDays, setValidForDays] = useState("7");
  const [ref, setRef] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [firmName, setFirmName] = useState("");
  const [signerName, setSignerName] = useState("");
  const [result, setResult] = useState<MintResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { isLoading: accessLoading, error: accessError } = useQuery({
    queryKey: ["/api/admin/dpa/acceptances"],
  });

  const mintMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<MintResult>("POST", "/api/admin/dpa/mint", buildMintPayload(
        evaluationPeriodDays,
        feeEarnerCount,
        validForDays,
        ref,
      ));
    },
    onSuccess: (data) => {
      setResult(data);
      setCopied(false);
      toast({
        title: "Link minted",
        description: `Expires ${format(new Date(data.expiresAt), "dd MMM yyyy HH:mm")} UTC`,
      });
    },
    onError: (error) => {
      toast({
        title: "Mint failed",
        description: getApiErrorMessage(error, "Could not mint acceptance link."),
        variant: "destructive",
      });
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<SendInviteResult>("POST", "/api/admin/dpa/send-invite", {
        ...buildMintPayload(evaluationPeriodDays, feeEarnerCount, validForDays, ref),
        recipientEmail: recipientEmail.trim(),
        firmName: firmName.trim() || undefined,
        signerName: signerName.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setCopied(false);
      toast({
        title: "Invitation sent",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Send failed",
        description: getApiErrorMessage(error, "Could not send acceptance invitation."),
        variant: "destructive",
      });
    },
  });

  const copyLink = async () => {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      toast({ title: "Copied", description: "Acceptance link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Select the link and copy manually.",
        variant: "destructive",
      });
    }
  };

  const termsValid =
    Number(evaluationPeriodDays) > 0 &&
    Number(feeEarnerCount) > 0 &&
    Number(validForDays) > 0;

  if (accessLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="container mx-auto p-6" data-testid="admin-dpa-mint-denied">
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Admin access required to view this page</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Failed to load mint tools. Please ensure you have admin privileges.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="admin-dpa-mint">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-dpa-mint-title">
            Mint DPA acceptance link
          </h1>
          <p className="text-muted-foreground">
            Create a signed Key Terms link, or send a branded invitation from LegalNote support.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/admin" className="text-muted-foreground hover:underline">
            Admin Dashboard
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/admin/dpa-acceptances" className="text-muted-foreground hover:underline">
            Acceptances
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Key Terms
          </CardTitle>
          <CardDescription>
            Evaluation period and fee earner count are fixed in the signed link. The firm cannot
            change them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4 max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              mintMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="evaluationPeriodDays">Evaluation period (days)</Label>
              <Input
                id="evaluationPeriodDays"
                type="number"
                min={1}
                max={3650}
                value={evaluationPeriodDays}
                onChange={(e) => setEvaluationPeriodDays(e.target.value)}
                required
                data-testid="input-evaluation-period-days"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feeEarnerCount">Fee earner count</Label>
              <Input
                id="feeEarnerCount"
                type="number"
                min={1}
                max={100000}
                value={feeEarnerCount}
                onChange={(e) => setFeeEarnerCount(e.target.value)}
                required
                data-testid="input-fee-earner-count"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validForDays">Valid for (days)</Label>
              <Input
                id="validForDays"
                type="number"
                min={1}
                max={365}
                value={validForDays}
                onChange={(e) => setValidForDays(e.target.value)}
                required
                data-testid="input-valid-for-days"
              />
              <p className="text-xs text-muted-foreground">
                Link expires after this many days from mint time (UTC).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref">Reference (optional)</Label>
              <Input
                id="ref"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="penn-chambers"
                maxLength={100}
                data-testid="input-ref"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={mintMutation.isPending || sendInviteMutation.isPending || !termsValid}
              data-testid="button-mint-link"
            >
              {mintMutation.isPending ? "Minting…" : "Mint link only"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card data-testid="card-dpa-send-invite">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send invitation from LegalNote
          </CardTitle>
          <CardDescription>
            Emails the signed acceptance link from{" "}
            <strong>noreply@legalnote.ai</strong> with reply-to{" "}
            <strong>support@legalnote.ai</strong>. The recipient completes acceptance on LegalNote;
            you do not need to email them the link yourself.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="recipientEmail">Recipient email</Label>
            <Input
              id="recipientEmail"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="shak.inayat@penngroup.co.uk"
              required
              data-testid="input-recipient-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firmName">Firm name (optional)</Label>
            <Input
              id="firmName"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Penn Chambers"
              data-testid="input-invite-firm-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signerName">Signatory first name (optional)</Label>
            <Input
              id="signerName"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Shak"
              data-testid="input-invite-signer-name"
            />
          </div>
          <Button
            type="button"
            disabled={
              sendInviteMutation.isPending ||
              mintMutation.isPending ||
              !termsValid ||
              !recipientEmail.trim()
            }
            onClick={() => sendInviteMutation.mutate()}
            data-testid="button-send-dpa-invite"
          >
            {sendInviteMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              "Mint and send invitation"
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card data-testid="mint-result">
          <CardHeader>
            <CardTitle>Signed link</CardTitle>
            <CardDescription>
              This link expires on{" "}
              <strong>{format(new Date(result.expiresAt), "dd MMM yyyy 'at' HH:mm")} UTC</strong>
              {" "}({result.validForDays} day{result.validForDays === 1 ? "" : "s"} from mint).
              Key Terms: {result.evaluationPeriodDays} days · {result.feeEarnerCount} fee earners
              {result.ref ? ` · ref ${result.ref}` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                readOnly
                value={result.url}
                className="font-mono text-xs"
                data-testid="input-minted-url"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={copyLink}
                data-testid="button-copy-link"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground break-all">{result.expiresAtDisplay}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
