import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, FileText, Lock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface AcknowledgeData {
  documentId: string;
  content: string;
  documentType?: string;
  documentLabel?: string;
  caseTitle: string;
  matterReference: string | null;
  acknowledgedAt: string | null;
  acknowledgedByEmail: string | null;
  firmProfile: { firmName: string; logoUrl: string | null } | null;
}

export default function AcknowledgePage() {
  const { token } = useParams<{ token: string }>();
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<AcknowledgeData>({
    queryKey: [`/api/documents/acknowledge/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/documents/acknowledge/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Invalid or expired link");
      }
      return res.json();
    },
    retry: false,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/documents/acknowledge/${token}`, { email });
    },
    onSuccess: () => {
      setConfirmed(true);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || "Something went wrong. Please try again.");
    },
  });

  const handleConfirm = () => {
    setError(null);
    acknowledgeMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your document...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="bg-card rounded-md border border-border shadow-md max-w-md w-full p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold">Link invalid or expired</h1>
          <p className="text-sm text-muted-foreground">
            This acknowledgement link is no longer valid. Please contact your solicitor if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  const alreadyAcknowledged = !!data.acknowledgedAt;
  const firmName = data.firmProfile?.firmName || "Your Solicitors";
  const documentLabel = data.documentLabel || "Client Care Letter";

  if (confirmed || alreadyAcknowledged) {
    const acknowledgedAt = confirmed
      ? new Date()
      : data.acknowledgedAt
      ? new Date(data.acknowledgedAt)
      : new Date();

    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="bg-card rounded-md border border-border shadow-md max-w-md w-full p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
          <h1 className="text-xl font-semibold">Acknowledged</h1>
          <p className="text-sm text-muted-foreground">
            Thank you. Your acknowledgement of the {documentLabel} for{" "}
            <strong>{data.caseTitle}</strong> has been recorded.
          </p>
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-4 py-3">
            Recorded: {format(acknowledgedAt, "d MMMM yyyy 'at' HH:mm")}
          </div>
          <p className="text-xs text-muted-foreground">
            A copy of this record has been sent to <strong>{firmName}</strong>. Please retain this
            page or take a screenshot for your records.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{firmName}</p>
              <p className="text-xs text-muted-foreground truncate">{data.caseTitle}</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 shrink-0">
            <Lock className="w-3 h-3" />
            Secure
          </Badge>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Instruction banner */}
        <div className="bg-card rounded-md border border-border p-5 space-y-2">
          <h2 className="text-base font-semibold">{documentLabel}</h2>
          {data.matterReference && (
            <p className="text-xs text-muted-foreground">Matter reference: {data.matterReference}</p>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please read the letter below in full, then scroll to the bottom to confirm your
            acknowledgement. Your confirmation creates a secure record for your protection.
          </p>
        </div>

        {/* Document body */}
        <div
          className="bg-card rounded-md border border-border shadow-sm p-8 text-sm leading-relaxed whitespace-pre-wrap font-['Georgia',serif] text-foreground"
          data-testid="text-document-content"
        >
          {data.content}
        </div>

        <Separator />

        {/* Acknowledgement form */}
        <div className="bg-card rounded-md border border-border p-6 space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Confirm acknowledgement</h3>
            <p className="text-xs text-muted-foreground">
              By clicking confirm, you acknowledge that you have read and understood the contents of
              this Client Care Letter.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="input-client-email">
              Your email address (optional — for your own records)
            </label>
            <Input
              id="input-client-email"
              data-testid="input-client-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive" data-testid="text-acknowledge-error">
              {error}
            </p>
          )}

          <Button
            onClick={handleConfirm}
            disabled={acknowledgeMutation.isPending}
            data-testid="button-confirm-acknowledgement"
            size="lg"
            className="w-full sm:w-auto"
          >
            {acknowledgeMutation.isPending ? "Submitting..." : "I confirm I have read and understood this letter"}
          </Button>

          <p className="text-[11px] text-muted-foreground">
            Your IP address and the time of confirmation will be recorded as part of the audit trail
            held by {firmName}. This is required by SRA regulations.
          </p>
        </div>
      </main>
    </div>
  );
}
