import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Eye, FileText, Download, Send, Clock, User, Search } from "lucide-react";
import type { AuditTrail as AuditTrailType } from "@shared/schema";

interface AuditTrailProps {
  caseId: string;
  limit?: number;
}

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

export function AuditTrail({ caseId, limit = 20 }: AuditTrailProps) {
  const { data: auditLogs, isLoading } = useQuery<AuditTrailType[]>({
    queryKey: ["/api/audit/case", caseId],
    queryFn: async () => {
      const response = await fetch(`/api/audit/case/${caseId}?limit=${limit}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Card data-testid="card-audit-trail">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Audit Trail
          </CardTitle>
          <CardDescription>Loading compliance logs...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card data-testid="card-audit-trail">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Audit Trail
        </CardTitle>
        <CardDescription>
          Complete access and modification history for compliance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!auditLogs || auditLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-audit-logs">
            No audit logs available
          </p>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
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
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(log.timestamp), "dd MMM yyyy HH:mm:ss")}
                        </span>
                        {log.ipAddress && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
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
  );
}
