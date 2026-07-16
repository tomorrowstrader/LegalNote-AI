import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link2, ShieldOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ShareLinkSummary {
  id: string;
  recipientEmail: string;
  recipientName: string;
  accessLevel: "view" | "download";
  expiresAt: string;
  createdAt: string;
  accessCount: number;
  sharedDocuments: string[];
  passwordProtected: boolean;
  smsProtected: boolean;
}

export default function ActiveShareLinks({ caseId }: { caseId: string }) {
  const { toast } = useToast();
  const { data: links = [], isLoading } = useQuery<ShareLinkSummary[]>({
    queryKey: [`/api/cases/${caseId}/share-links`],
  });

  const revokeMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest("DELETE", `/api/share-links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/share-links`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/audit`] });
      toast({
        title: "Share link revoked",
        description: "The recipient can no longer access documents through this link.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to revoke link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const now = Date.now();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Share Links
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading share links...</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No share links have been created for this matter.</p>
        ) : (
          <div className="space-y-3">
            {links.map((link) => {
              const expired = new Date(link.expiresAt).getTime() <= now;
              return (
                <div
                  key={link.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-3"
                  data-testid={`share-link-${link.id}`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{link.recipientName}</span>
                      <Badge variant={expired ? "secondary" : "default"}>
                        {expired ? "Expired" : "Active"}
                      </Badge>
                      <Badge variant="outline">{link.accessLevel === "view" ? "View only" : "Download"}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{link.recipientEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {format(new Date(link.expiresAt), "dd MMM yyyy 'at' HH:mm")}
                      {" · "}{link.accessCount} access{link.accessCount === 1 ? "" : "es"}
                    </p>
                  </div>
                  {!expired && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={revokeMutation.isPending}
                      onClick={() => {
                        if (window.confirm("Revoke this share link immediately? The recipient will lose further access.")) {
                          revokeMutation.mutate(link.id);
                        }
                      }}
                      data-testid={`button-revoke-share-link-${link.id}`}
                    >
                      <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
