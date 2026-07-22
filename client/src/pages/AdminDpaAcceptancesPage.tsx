import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileCheck, ShieldCheck, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getApiErrorMessage } from "@/lib/queryClient";

type AcceptanceRow = {
  id: string;
  status: string;
  firmName: string;
  signerName: string;
  signerTitle: string;
  email: string;
  sraNumber: string | null;
  ref: string | null;
  evaluationPeriodDays: number;
  feeEarnerCount: number;
  acceptedAt: string | null;
  createdAt: string;
  verifyToken: string | null;
};

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "accepted":
      return "default";
    case "pending_email":
      return "secondary";
    case "expired":
    case "superseded":
      return "outline";
    default:
      return "secondary";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return format(new Date(dateStr), "dd MMM yyyy HH:mm");
}

export default function AdminDpaAcceptancesPage() {
  const { toast } = useToast();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<AcceptanceRow[]>({
    queryKey: ["/api/admin/dpa/acceptances"],
  });

  const verifyRow = async (row: AcceptanceRow) => {
    if (row.status !== "accepted" || !row.verifyToken) {
      toast({
        title: "Not available",
        description: "Verification is only available for accepted rows with a certificate token.",
        variant: "destructive",
      });
      return;
    }
    setVerifyingId(row.id);
    try {
      const result = await apiRequest<{
        valid: boolean;
        recordSealValid: boolean;
        dpaHashValid: boolean;
        evaluationHashValid: boolean;
        reasons?: string[];
      }>(
        "GET",
        `/api/legal-acceptances/${row.id}/verify?token=${encodeURIComponent(row.verifyToken)}`,
      );
      toast({
        title: result.valid ? "Record valid" : "Verification failed",
        description: result.valid
          ? "Row seal and document hashes match."
          : (result.reasons?.join(", ") || "Seal or hash check failed."),
        variant: result.valid ? "default" : "destructive",
      });
    } catch (err) {
      toast({
        title: "Verify failed",
        description: getApiErrorMessage(err, "Could not verify acceptance."),
        variant: "destructive",
      });
    } finally {
      setVerifyingId(null);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Admin access required to view acceptances</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Failed to load acceptances. Please ensure you have admin privileges.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="admin-dpa-acceptances">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-dpa-acceptances-title">
            DPA acceptances
          </h1>
          <p className="text-muted-foreground">
            All click-to-accept records, newest first. Certificate links are tokenised.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/admin" className="text-muted-foreground hover:underline">
            Admin Dashboard
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/admin/dpa-mint" className="text-muted-foreground hover:underline">
            Mint link
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Acceptances
            {data && data.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {data.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Firm, signatory, status, Key Terms, and links to the portable certificate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2 py-4">
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-5/6" />
              <div className="h-4 bg-muted rounded w-4/6" />
            </div>
          ) : data && data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Firm</th>
                    <th className="text-left py-2 px-2">Signatory</th>
                    <th className="text-left py-2 px-2">Email</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Key Terms</th>
                    <th className="text-left py-2 px-2">Accepted</th>
                    <th className="text-left py-2 px-2">Created</th>
                    <th className="text-left py-2 px-2">Ref</th>
                    <th className="text-left py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => {
                    const certificateHref =
                      row.status === "accepted" && row.verifyToken
                        ? `/legal/acceptance/${row.id}?token=${encodeURIComponent(row.verifyToken)}`
                        : null;
                    return (
                      <tr
                        key={row.id}
                        className="border-b hover-elevate"
                        data-testid={`row-acceptance-${row.id}`}
                      >
                        <td className="py-2 px-2 font-medium">{row.firmName}</td>
                        <td className="py-2 px-2">
                          {row.signerName}
                          {row.signerTitle ? (
                            <span className="text-muted-foreground">, {row.signerTitle}</span>
                          ) : null}
                        </td>
                        <td className="py-2 px-2">{row.email}</td>
                        <td className="py-2 px-2">
                          <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {row.evaluationPeriodDays} days / {row.feeEarnerCount}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {formatDate(row.acceptedAt)}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {row.ref || "—"}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {certificateHref ? (
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                data-testid={`link-certificate-${row.id}`}
                              >
                                <a href={certificateHref} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Certificate
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground px-1">—</span>
                            )}
                            {row.status === "accepted" && row.verifyToken ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={verifyingId === row.id}
                                onClick={() => verifyRow(row)}
                                data-testid={`button-verify-${row.id}`}
                              >
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                {verifyingId === row.id ? "…" : "Verify"}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-acceptances">
              No acceptances yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
