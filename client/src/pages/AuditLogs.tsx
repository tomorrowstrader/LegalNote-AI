import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Download, Search, Filter, Clock, User, Eye, FileText, Send } from "lucide-react";
import type { AuditTrail as AuditTrailType } from "@shared/schema";
import { logAuditEvent } from "@/lib/auditLogger";

const EVENT_ICONS: Record<string, any> = {
  case_viewed: Eye,
  case_created: FileText,
  case_updated: FileText,
  recording_started: FileText,
  consent_given: Shield,
  consent_declined: Shield,
  audio_uploaded: Download,
  audio_playback_started: Eye,
  audio_playback_paused: Eye,
  audio_seeked: Search,
  audio_deleted: Shield,
  document_viewed: Eye,
  document_created: FileText,
  document_updated: FileText,
  document_deleted: FileText,
  document_downloaded: Download,
  document_sent: Send,
  transcript_viewed: Eye,
  transcript_redacted: Shield,
  audit_exported_csv: Download,
};

const EVENT_LABELS: Record<string, string> = {
  case_viewed: "Case Viewed",
  case_created: "Case Created",
  case_updated: "Case Updated",
  recording_started: "Recording Started",
  consent_given: "Consent Given",
  consent_declined: "Consent Declined",
  audio_uploaded: "Audio Uploaded",
  audio_playback_started: "Audio Playback Started",
  audio_playback_paused: "Audio Playback Paused",
  audio_seeked: "Audio Seeked",
  audio_deleted: "Audio Deleted",
  document_viewed: "Document Viewed",
  document_created: "Document Created",
  document_updated: "Document Updated",
  document_deleted: "Document Deleted",
  document_downloaded: "Document Downloaded",
  document_sent: "Document Sent",
  transcript_viewed: "Transcript Viewed",
  transcript_redacted: "Transcript Redacted",
  audit_exported_csv: "Audit Exported (CSV)",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
};

// NOTE: This page should be restricted to admin users only once role-based access control is implemented
// Currently accessible to all authenticated users - implement role check before production deployment
export default function AuditLogs() {
  const [caseIdFilter, setCaseIdFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [limit, setLimit] = useState(100);

  const queryParams = new URLSearchParams();
  if (caseIdFilter) queryParams.append("caseId", caseIdFilter);
  if (eventTypeFilter) queryParams.append("eventType", eventTypeFilter);
  queryParams.append("limit", limit.toString());

  const { data: auditLogs, isLoading, refetch } = useQuery<AuditTrailType[]>({
    queryKey: ["/api/audit/logs", caseIdFilter, eventTypeFilter, limit],
    queryFn: async () => {
      const response = await fetch(`/api/audit/logs?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return response.json();
    },
  });

  const handleExportCSV = async () => {
    if (!auditLogs || auditLogs.length === 0) return;

    const headers = ["Timestamp", "Event Type", "User ID", "Case ID", "Document ID", "IP Address", "Severity", "Metadata"];
    const rows = auditLogs.map(log => [
      format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss"),
      log.eventType,
      log.userId,
      log.caseId || "",
      log.documentId || "",
      log.ipAddress || "",
      log.severity,
      JSON.stringify(log.metadata || {}),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    // Log CSV export event
    await logAuditEvent({
      eventType: "audit_exported_csv",
      metadata: { 
        recordCount: auditLogs.length,
        filters: {
          caseId: caseIdFilter || null,
          eventType: eventTypeFilter || null,
          limit,
        },
      },
      severity: "warning",
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">Audit Logs</h1>
          <p className="text-muted-foreground">
            Complete compliance trail of all system access and modifications
          </p>
        </div>

        <Card className="mb-6" data-testid="card-filters">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
            <CardDescription>Filter audit logs by case, event type, or date range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="caseId">Case ID</Label>
                <Input
                  id="caseId"
                  placeholder="Enter case UUID..."
                  value={caseIdFilter}
                  onChange={(e) => setCaseIdFilter(e.target.value)}
                  data-testid="input-case-id-filter"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventType">Event Type</Label>
                <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                  <SelectTrigger id="eventType" data-testid="select-event-type-filter">
                    <SelectValue placeholder="All events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All events</SelectItem>
                    <SelectItem value="case_viewed">Case Viewed</SelectItem>
                    <SelectItem value="case_created">Case Created</SelectItem>
                    <SelectItem value="case_updated">Case Updated</SelectItem>
                    <SelectItem value="document_viewed">Document Viewed</SelectItem>
                    <SelectItem value="document_created">Document Created</SelectItem>
                    <SelectItem value="document_updated">Document Updated</SelectItem>
                    <SelectItem value="document_deleted">Document Deleted</SelectItem>
                    <SelectItem value="document_downloaded">Document Downloaded</SelectItem>
                    <SelectItem value="document_sent">Document Sent</SelectItem>
                    <SelectItem value="transcript_viewed">Transcript Viewed</SelectItem>
                    <SelectItem value="transcript_redacted">Transcript Redacted</SelectItem>
                    <SelectItem value="audio_accessed">Audio Accessed</SelectItem>
                    <SelectItem value="audio_deleted">Audio Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit">Results Limit</Label>
                <Select value={limit.toString()} onValueChange={(val) => setLimit(parseInt(val, 10))}>
                  <SelectTrigger id="limit" data-testid="select-limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 results</SelectItem>
                    <SelectItem value="100">100 results</SelectItem>
                    <SelectItem value="500">500 results</SelectItem>
                    <SelectItem value="1000">1000 results</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => refetch()} variant="default" data-testid="button-apply-filters">
                <Search className="w-4 h-4 mr-2" />
                Apply Filters
              </Button>
              <Button
                onClick={() => {
                  setCaseIdFilter("");
                  setEventTypeFilter("");
                  setLimit(100);
                }}
                variant="outline"
                data-testid="button-reset-filters"
              >
                Reset
              </Button>
              <Button
                onClick={handleExportCSV}
                variant="outline"
                disabled={!auditLogs || auditLogs.length === 0}
                data-testid="button-export-csv"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-audit-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Audit Trail
              {auditLogs && <Badge variant="outline">{auditLogs.length} records</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading audit logs...</p>
            ) : !auditLogs || auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-results">
                No audit logs found matching your filters
              </p>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-3">
                  {auditLogs.map((log) => {
                    const Icon = EVENT_ICONS[log.eventType] || FileText;
                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-3 rounded-md border bg-card"
                        data-testid={`audit-log-${log.id}`}
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {EVENT_LABELS[log.eventType] || log.eventType}
                            </span>
                            <Badge
                              variant="outline"
                              className={SEVERITY_COLORS[log.severity]}
                              data-testid={`badge-severity-${log.severity}`}
                            >
                              {log.severity}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(log.timestamp), "dd MMM yyyy HH:mm:ss")}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {log.userId.slice(0, 8)}...
                            </span>
                            {log.caseId && (
                              <span className="flex items-center gap-1">
                                Case: {log.caseId.slice(0, 8)}...
                              </span>
                            )}
                            {log.ipAddress && (
                              <span className="flex items-center gap-1">
                                IP: {log.ipAddress}
                              </span>
                            )}
                          </div>
                          {(() => {
                            const metadata = log.metadata as Record<string, any> | null;
                            if (metadata && Object.keys(metadata).length > 0) {
                              return (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <span className="font-medium">Details:</span>{" "}
                                  <code className="text-xs">{JSON.stringify(metadata)}</code>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
