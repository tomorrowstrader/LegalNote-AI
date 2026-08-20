import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, MessageSquareWarning, RotateCcw } from "lucide-react";
import type { ShareFeedback } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function categoryLabel(category: string | null | undefined): string {
  switch (category) {
    case "clarification":
      return "Clarification";
    case "other":
      return "Other";
    case "correction":
    default:
      return "Correction";
  }
}

function documentLabel(type: string | null | undefined): string {
  switch (type) {
    case "attendance_note":
    case "meeting_notes":
      return "Attendance Note";
    case "summary":
    case "client_letter":
      return "Client Letter";
    case "client_care_letter":
      return "Client Care Letter";
    case "transcript":
      return "Transcript";
    default:
      return type || "Document";
  }
}

export default function ClientFeedbackPanel({ caseId }: { caseId: string }) {
  const { toast } = useToast();
  const [showResolved, setShowResolved] = useState(false);

  const { data: items = [], isLoading } = useQuery<ShareFeedback[]>({
    queryKey: [`/api/cases/${caseId}/share-feedback`],
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      return apiRequest("PATCH", `/api/cases/${caseId}/share-feedback/${id}`, { resolved });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/share-feedback`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/audit`] });
      toast({
        title: vars.resolved ? "Marked as acknowledged" : "Reopened",
        description: vars.resolved
          ? "This client flag is cleared from your open list."
          : "This client flag is open again.",
        duration: 3500,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openItems = useMemo(() => items.filter((i) => !i.resolved), [items]);
  const resolvedItems = useMemo(() => items.filter((i) => i.resolved), [items]);
  const visible = showResolved ? items : openItems;

  return (
    <Card className="h-full lg:col-span-2" data-testid="panel-client-feedback">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquareWarning className="w-4 h-4" />
            Client feedback
            {openItems.length > 0 && (
              <Badge variant="destructive" className="text-[10px]" data-testid="badge-feedback-open-count">
                {openItems.length} open
              </Badge>
            )}
          </CardTitle>
          {resolvedItems.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowResolved((v) => !v)}
              data-testid="button-toggle-resolved-feedback"
            >
              {showResolved ? "Hide acknowledged" : `Show acknowledged (${resolvedItems.length})`}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Corrections flagged by recipients on secure share links. The adopted note is not changed automatically.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-client-feedback">
            {items.length === 0
              ? "No client corrections yet."
              : "No open corrections. Toggle above to see acknowledged items."}
          </p>
        ) : (
          visible.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2"
              data-testid={`client-feedback-item-${item.id}`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {categoryLabel(item.category)}
                    </Badge>
                    {item.documentType && (
                      <Badge variant="secondary" className="text-[10px]">
                        {documentLabel(item.documentType)}
                      </Badge>
                    )}
                    {item.resolved && (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        Acknowledged
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(item.recipientName || item.recipientEmail || "Recipient").trim()}
                    {" · "}
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={item.resolved ? "outline" : "default"}
                  className="h-8 gap-1.5 shrink-0"
                  disabled={resolveMutation.isPending}
                  onClick={() =>
                    resolveMutation.mutate({ id: item.id, resolved: !item.resolved })
                  }
                  data-testid={`button-resolve-feedback-${item.id}`}
                >
                  {item.resolved ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reopen
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Acknowledge
                    </>
                  )}
                </Button>
              </div>
              {item.selectedText && (
                <blockquote className="text-xs border-l-2 border-amber-500/60 pl-3 text-muted-foreground italic leading-relaxed">
                  “{item.selectedText}”
                </blockquote>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.message}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
