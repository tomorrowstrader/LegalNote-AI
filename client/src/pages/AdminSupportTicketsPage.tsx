import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, LifeBuoy, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiRequest, getApiErrorMessage, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SupportTicket } from "@shared/schema";
import {
  supportCategoryLabel,
  supportSeverityLabel,
  supportStatusLabel,
  SUPPORT_TICKET_STATUSES,
} from "@shared/supportTickets";
import { cn } from "@/lib/utils";

type EnrichedTicket = SupportTicket & {
  userEmail: string | null;
  userName: string | null;
  firmName: string | null;
};

function severityBadgeClass(severity: string): string {
  if (severity === "blocked") return "bg-red-500/10 text-red-700 border-red-200";
  if (severity === "annoying") return "bg-amber-500/10 text-amber-800 border-amber-200";
  return "bg-slate-500/10 text-slate-700 border-slate-200";
}

function ticketScreenshotPaths(ticket: SupportTicket): string[] {
  const meta = ticket.contextMetadata as { screenshotPaths?: string[] } | null;
  if (meta?.screenshotPaths?.length) return meta.screenshotPaths;
  return ticket.screenshotPath ? [ticket.screenshotPath] : [];
}

export default function AdminSupportTicketsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState<string>("open");
  const [notifyUser, setNotifyUser] = useState(true);

  const queryKey = useMemo(
    () =>
      statusFilter === "all"
        ? ["/api/admin/support/tickets"]
        : [`/api/admin/support/tickets?status=${statusFilter}`],
    [statusFilter],
  );

  const { data: tickets = [], isLoading, error } = useQuery<EnrichedTicket[]>({
    queryKey,
    queryFn: async () => {
      const url =
        statusFilter === "all"
          ? "/api/admin/support/tickets"
          : `/api/admin/support/tickets?status=${encodeURIComponent(statusFilter)}`;
      return apiRequest<EnrichedTicket[]>("GET", url);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("ticket");
    if (fromUrl) setSelectedId(fromUrl);
  }, []);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setAdminNotes(selected.adminNotes ?? "");
      setNewStatus(selected.status);
    }
  }, [selected?.id, selected?.adminNotes, selected?.status]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("No ticket selected");
      return apiRequest<SupportTicket>("PATCH", `/api/admin/support/tickets/${selected.id}`, {
        status: newStatus,
        adminNotes: adminNotes.trim() || null,
        notifyUser,
      });
    },
    onSuccess: () => {
      toast({ title: "Ticket updated" });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Update failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="admin-support-tickets">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LifeBuoy className="h-6 w-6" />
              Support queue
            </h1>
            <p className="text-sm text-muted-foreground">In-app tickets from evaluation firms</p>
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="admin-support-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SUPPORT_TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {supportStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Failed to load tickets. Admin access required.
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tickets</CardTitle>
              <CardDescription>{tickets.length} shown</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No tickets yet.</p>
              ) : (
                <ul className="divide-y max-h-[70vh] overflow-y-auto">
                  {tickets.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors",
                          selectedId === t.id && "bg-muted",
                        )}
                        data-testid={`admin-support-ticket-${t.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm line-clamp-2">{t.title}</span>
                          <Badge variant="outline" className={severityBadgeClass(t.severity)}>
                            {supportSeverityLabel(t.severity)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t.ticketRef} · {t.userName || t.userEmail}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {supportStatusLabel(t.status)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(t.createdAt), "dd MMM HH:mm")}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            {!selected ? (
              <CardContent className="py-16 text-center text-muted-foreground text-sm">
                Select a ticket to view details
              </CardContent>
            ) : (
              <>
                <CardHeader>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="outline">{supportCategoryLabel(selected.category)}</Badge>
                    <Badge variant="outline" className={severityBadgeClass(selected.severity)}>
                      {supportSeverityLabel(selected.severity)}
                    </Badge>
                    <Badge>{supportStatusLabel(selected.status)}</Badge>
                  </div>
                  <CardTitle>{selected.title}</CardTitle>
                  <CardDescription>
                    {selected.ticketRef} · {selected.userName} &lt;{selected.userEmail}&gt;
                    {selected.firmName ? ` · ${selected.firmName}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selected.aiSummary && (
                    <div className="rounded-md bg-muted p-3 text-sm">
                      <strong>AI summary:</strong> {selected.aiSummary}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{selected.description}</p>

                  {ticketScreenshotPaths(selected).length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Screenshots</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {ticketScreenshotPaths(selected).map((_, i) => (
                          <a
                            key={i}
                            href={`/api/admin/support/tickets/${selected.id}/screenshots/${i}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={`/api/admin/support/tickets/${selected.id}/screenshots/${i}`}
                              alt={`Screenshot ${i + 1}`}
                              className="h-24 w-24 rounded border object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.contextMetadata && Object.keys(selected.contextMetadata as object).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground font-medium">
                        Safe technical context
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-[11px]">
                        {JSON.stringify(selected.contextMetadata, null, 2)}
                      </pre>
                    </details>
                  )}

                  <div className="grid gap-3 pt-2 border-t">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger data-testid="admin-support-new-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORT_TICKET_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {supportStatusLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Internal / user-visible notes</Label>
                      <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={3}
                        placeholder="Optional note included in status emails to the user"
                        data-testid="admin-support-notes"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={notifyUser} onCheckedChange={setNotifyUser} id="notify-user" />
                      <Label htmlFor="notify-user" className="text-sm font-normal">
                        Email user when status changes
                      </Label>
                    </div>
                    <Button
                      onClick={() => updateMutation.mutate()}
                      disabled={updateMutation.isPending}
                      data-testid="admin-support-save"
                    >
                      {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save changes
                    </Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        <Link href="/admin" className="underline inline-flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> Back to admin dashboard
        </Link>
      </p>
    </div>
  );
}
