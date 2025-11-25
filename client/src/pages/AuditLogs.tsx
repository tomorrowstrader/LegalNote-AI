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
import { Shield, Download, Search, Filter, Clock, User, Eye, FileText, Send, Loader2, FileCheck } from "lucide-react";
import type { AuditTrail as AuditTrailType } from "@shared/schema";
import { logAuditEvent } from "@/lib/auditLogger";
import { useToast } from "@/hooks/use-toast";

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
  calendar_connected: Shield,
  calendar_disconnected: Shield,
  calendar_synced: Send,
  calendar_sync_failed: Shield,
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
  calendar_connected: "Calendar Connected",
  calendar_disconnected: "Calendar Disconnected",
  calendar_synced: "Calendar Synced",
  calendar_sync_failed: "Calendar Sync Failed",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
};

// Helper function to format metadata in a readable way
function formatMetadata(eventType: string, metadata: Record<string, any> | null): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;

  const parts: string[] = [];

  // Calendar events
  if (eventType === 'calendar_connected' && metadata.provider) {
    parts.push(`Provider: ${metadata.provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook'}`);
    if (metadata.email) parts.push(`Email: ${metadata.email}`);
  } else if (eventType === 'calendar_disconnected' && metadata.provider) {
    parts.push(`Provider: ${metadata.provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook'}`);
  } else if (eventType === 'calendar_synced' && metadata.provider) {
    parts.push(`Synced to: ${metadata.provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook'}`);
  } else if (eventType === 'case_email_sent') {
    if (metadata.recipient) parts.push(`To: ${metadata.recipient}`);
    if (metadata.messageLength) parts.push(`Message: ${metadata.messageLength} characters`);
  } else if (eventType === 'document_sent') {
    if (metadata.recipient) parts.push(`To: ${metadata.recipient}`);
  } else if (eventType === 'audio_deleted') {
    if (metadata.reason) parts.push(`Reason: ${metadata.reason.replace(/_/g, ' ')}`);
  } else if (metadata.documentType) {
    parts.push(`Type: ${metadata.documentType.replace(/_/g, ' ')}`);
  }

  return parts.length > 0 ? parts.join(' • ') : null;
}

// NOTE: This page should be restricted to admin users only once role-based access control is implemented
// Currently accessible to all authenticated users - implement role check before production deployment
export default function AuditLogs() {
  const { toast } = useToast();
  const [caseIdFilter, setCaseIdFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [limit, setLimit] = useState(100);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

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

    setIsExporting(true);
    try {
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
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSignedPDF = async () => {
    if (!auditLogs || auditLogs.length === 0) return;

    setIsExportingPDF(true);
    try {
      const response = await fetch("/api/audit/export/signed-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          caseId: caseIdFilter || undefined,
          eventType: eventTypeFilter || undefined,
          limit,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate signed PDF");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-trail-signed-${format(new Date(), "yyyy-MM-dd-HHmmss")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Signed PDF Generated",
        description: "Your digitally signed audit trail has been downloaded",
        duration: 5000,
      });
    } catch (error) {
      console.error("Failed to export signed PDF:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate signed PDF. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsExportingPDF(false);
    }
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
                disabled={!auditLogs || auditLogs.length === 0 || isExporting}
                data-testid="button-export-csv"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </>
                )}
              </Button>
              <Button
                onClick={handleExportSignedPDF}
                variant="default"
                disabled={!auditLogs || auditLogs.length === 0 || isExportingPDF}
                data-testid="button-export-signed-pdf"
              >
                {isExportingPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 mr-2" />
                    Signed PDF
                  </>
                )}
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
                            const formattedMetadata = formatMetadata(log.eventType, metadata);
                            if (formattedMetadata) {
                              return (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  {formattedMetadata}
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
