import { useMutation, useQuery } from "@tanstack/react-query";
import { differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { ChevronDown, ChevronUp, Clock, Link2, ShieldOff } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const INITIAL_VISIBLE = 4;

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

function getExpiryCountdown(expiresAt: Date): { timeString: string; isUrgent: boolean } {
  const now = new Date();
  const days = differenceInDays(expiresAt, now);
  const hours = differenceInHours(expiresAt, now) % 24;
  const minutes = differenceInMinutes(expiresAt, now) % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);

  return {
    timeString: parts.join(" ") || "less than 1 minute",
    isUrgent: days === 0 && hours < 24,
  };
}

export default function ActiveShareLinks({ caseId }: { caseId: string }) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
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
  const displayedLinks = isExpanded ? links : links.slice(0, INITIAL_VISIBLE);
  const hasMore = links.length > INITIAL_VISIBLE;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Share Links
          </CardTitle>
          {links.length > 0 && (
            <Badge variant="secondary" data-testid="badge-share-link-count">
              {links.length} link{links.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading share links...</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No share links have been created for this matter.</p>
        ) : (
          <div className="space-y-3">
            {displayedLinks.map((link) => {
              const expiryDate = new Date(link.expiresAt);
              const expired = expiryDate.getTime() <= now;
              const countdown = !expired ? getExpiryCountdown(expiryDate) : null;

              return (
                <div
                  key={link.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
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
                      {link.accessCount} access{link.accessCount === 1 ? "" : "es"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {countdown && (
                      <div
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border whitespace-nowrap ${
                          countdown.isUrgent
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-muted/40 text-muted-foreground border-border/40"
                        }`}
                        data-testid={`share-link-expiry-countdown-${link.id}`}
                      >
                        <Clock className="h-3 w-3" />
                        <span>
                          Expires: <strong>{countdown.timeString}</strong>
                        </span>
                      </div>
                    )}
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
                </div>
              );
            })}

            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full text-muted-foreground"
                data-testid="button-toggle-share-links"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Show {links.length - INITIAL_VISIBLE} more
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
