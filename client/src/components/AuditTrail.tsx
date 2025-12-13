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

function formatMetadata(eventType: string, metadata: Record<string, any>): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  
  switch (eventType) {
    case "case_viewed":
      return metadata.source ? `Viewed from ${metadata.source}` : "Case accessed";
    
    case "case_created":
      return metadata.clientName 
        ? `New case for client "${metadata.clientName}"`
        : "New case created";
    
    case "case_updated":
      if (metadata.fields && Array.isArray(metadata.fields)) {
        return `Updated: ${metadata.fields.join(", ")}`;
      }
      if (metadata.field) {
        return `Updated ${metadata.field}${metadata.oldValue ? ` from "${metadata.oldValue}"` : ""}${metadata.newValue ? ` to "${metadata.newValue}"` : ""}`;
      }
      return "Case details updated";
    
    case "recording_started":
      return metadata.duration 
        ? `Recording duration: ${Math.round(metadata.duration / 60)} minutes`
        : "Audio recording initiated";
    
    case "consent_given":
      return metadata.method 
        ? `Consent captured via ${metadata.method}`
        : "Client provided consent";
    
    case "consent_declined":
      return metadata.reason 
        ? `Declined: ${metadata.reason}`
        : "Client declined consent";
    
    case "audio_uploaded":
      if (metadata.filename && metadata.size) {
        const sizeMB = (metadata.size / (1024 * 1024)).toFixed(1);
        return `Uploaded "${metadata.filename}" (${sizeMB} MB)`;
      }
      return metadata.filename ? `Uploaded "${metadata.filename}"` : "Audio file uploaded";
    
    case "audio_playback_started":
      return metadata.position 
        ? `Playback started at ${Math.floor(metadata.position / 60)}:${String(Math.floor(metadata.position % 60)).padStart(2, '0')}`
        : "Audio playback started";
    
    case "audio_playback_paused":
      return metadata.position 
        ? `Paused at ${Math.floor(metadata.position / 60)}:${String(Math.floor(metadata.position % 60)).padStart(2, '0')}`
        : "Audio playback paused";
    
    case "audio_seeked":
      if (metadata.from !== undefined && metadata.to !== undefined) {
        const fromTime = `${Math.floor(metadata.from / 60)}:${String(Math.floor(metadata.from % 60)).padStart(2, '0')}`;
        const toTime = `${Math.floor(metadata.to / 60)}:${String(Math.floor(metadata.to % 60)).padStart(2, '0')}`;
        return `Jumped from ${fromTime} to ${toTime}`;
      }
      return "Audio position changed";
    
    case "audio_deleted":
      return metadata.reason 
        ? `Audio removed: ${metadata.reason}`
        : "Audio recording deleted";
    
    case "document_viewed":
      return metadata.documentType 
        ? `Viewed ${metadata.documentType}`
        : "Document accessed";
    
    case "document_created":
      return metadata.documentType 
        ? `Created ${metadata.documentType}`
        : "New document generated";
    
    case "document_updated":
      return metadata.documentType 
        ? `Updated ${metadata.documentType}${metadata.version ? ` (v${metadata.version})` : ""}`
        : "Document modified";
    
    case "document_deleted":
      return metadata.documentType 
        ? `Deleted ${metadata.documentType}`
        : "Document removed";
    
    case "document_downloaded":
      return metadata.format 
        ? `Downloaded as ${metadata.format.toUpperCase()}`
        : "Document downloaded";
    
    case "document_sent":
      if (metadata.recipient && metadata.method) {
        return `Sent to ${metadata.recipient} via ${metadata.method}`;
      }
      return metadata.recipient 
        ? `Sent to ${metadata.recipient}`
        : "Document sent";
    
    case "transcript_viewed":
      return metadata.section 
        ? `Viewed ${metadata.section} section`
        : "Transcript accessed";
    
    case "transcript_redacted":
      if (metadata.redactionCount) {
        return `${metadata.redactionCount} redaction${metadata.redactionCount > 1 ? 's' : ''} applied`;
      }
      return metadata.reason 
        ? `Redacted: ${metadata.reason}`
        : "Content redacted for privacy";
    
    case "audit_exported_csv":
      return metadata.recordCount 
        ? `Exported ${metadata.recordCount} records`
        : "Audit trail exported";
    
    default:
      const entries = Object.entries(metadata)
        .filter(([key]) => !['userId', 'caseId', 'timestamp'].includes(key))
        .map(([key, value]) => {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase();
          return `${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}`;
        });
      return entries.length > 0 ? entries.join(", ") : "";
  }
}

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
                        const formattedDetails = formatMetadata(log.eventType, metadata || {});
                        if (formattedDetails) {
                          return (
                            <div className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium">Details:</span>{" "}
                              <span>{formattedDetails}</span>
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
