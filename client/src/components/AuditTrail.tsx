import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Shield, Eye, FileText, Download, Send, Clock, User, Search, ChevronDown, ChevronRight, Settings } from "lucide-react";
import type { AuditTrail as AuditTrailType } from "@shared/schema";

interface AuditTrailProps {
  caseId: string;
  limit?: number;
}

const EVENT_ICONS: Record<string, any> = {
  case_viewed: Eye,
  case_created: FileText,
  case_updated: FileText,
  case_archived: FileText,
  case_unarchived: FileText,
  case_email_sent: Send,
  case_link_shared: Send,
  recording_started: FileText,
  consent_given: Shield,
  consent_declined: Shield,
  consent_timestamp_marked: Shield,
  consent_segment_accessed: Shield,
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
  document_edited: FileText,
  document_unlocked: FileText,
  document_approved: Shield,
  document_generated: FileText,
  document_exported_pdf: Download,
  document_exported_word: Download,
  document_shared_with_client: Send,
  documents_exported: Download,
  transcript_viewed: Eye,
  transcript_redacted: Shield,
  audit_exported_csv: Download,
  pre_meeting_briefing_generated: FileText,
  ai_processing_started: FileText,
  ai_processing_completed: FileText,
  transcription_completed: FileText,
  quick_note_added: FileText,
  share_link_created: Send,
  share_link_accessed: Eye,
  action_item_created: FileText,
  action_item_approved: Shield,
  action_item_updated: FileText,
  action_items_bulk_approved: Shield,
  action_item_created_manual: FileText,
  action_items_extracted: FileText,
  deadline_changed: Clock,
  priority_changed: FileText,
  litigation_hold_applied: Shield,
  litigation_hold_released: Shield,
  calendar_synced: FileText,
  calendar_sync_failed: FileText,
};

const EVENT_LABELS: Record<string, string> = {
  case_viewed: "Case Viewed",
  case_created: "Case Created",
  case_updated: "Case Updated",
  case_archived: "Case Archived",
  case_unarchived: "Case Unarchived",
  case_email_sent: "Email Sent",
  case_link_shared: "Link Shared",
  recording_started: "Recording Started",
  consent_given: "Consent Given",
  consent_declined: "Consent Declined",
  consent_timestamp_marked: "Consent Timestamp Marked",
  consent_segment_accessed: "Consent Segment Accessed",
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
  document_edited: "Document Edited",
  document_unlocked: "Document Unlocked",
  document_approved: "Document Approved",
  document_generated: "Document Generated",
  document_exported_pdf: "Document Exported (PDF)",
  document_exported_word: "Document Exported (Word)",
  document_shared_with_client: "Document Shared with Client",
  documents_exported: "Documents Exported",
  transcript_viewed: "Transcript Viewed",
  transcript_redacted: "Transcript Redacted",
  audit_exported_csv: "Audit Exported (CSV)",
  pre_meeting_briefing_generated: "Meeting Briefing Generated",
  ai_processing_started: "AI Processing Started",
  ai_processing_completed: "AI Processing Completed",
  transcription_completed: "Transcription Completed",
  quick_note_added: "Quick Note Added",
  share_link_created: "Share Link Created",
  share_link_accessed: "Share Link Accessed",
  action_item_created: "Action Item Created",
  action_item_approved: "Action Item Approved",
  action_item_updated: "Action Item Updated",
  action_items_bulk_approved: "Action Items Bulk Approved",
  action_item_created_manual: "Manual Action Item Created",
  action_items_extracted: "Action Items Extracted",
  deadline_changed: "Deadline Changed",
  priority_changed: "Priority Changed",
  litigation_hold_applied: "Litigation Hold Applied",
  litigation_hold_released: "Litigation Hold Released",
  calendar_synced: "Calendar Synced",
  calendar_sync_failed: "Calendar Sync Failed",
};

// Helper function to format event type if not in labels
function formatEventType(eventType: string): string {
  if (EVENT_LABELS[eventType]) return EVENT_LABELS[eventType];
  // Convert snake_case to Title Case
  return eventType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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
    
    case "pre_meeting_briefing_generated":
      return metadata.sourceMeetingCount 
        ? `Prepared briefing from ${metadata.sourceMeetingCount} previous meeting${metadata.sourceMeetingCount > 1 ? 's' : ''}`
        : "Meeting briefing prepared";
    
    case "ai_processing_started":
      return "AI document generation initiated";
    
    case "ai_processing_completed":
      return "AI document generation completed successfully";
    
    case "transcription_completed":
      return metadata.duration 
        ? `Audio transcribed (${Math.round(metadata.duration / 60)} minutes)`
        : "Audio transcription completed";
    
    default:
      // Filter out technical fields that aren't meaningful to solicitors
      const technicalFields = ['userId', 'caseId', 'timestamp', 'cost', 'inputTokens', 'outputTokens', 
        'totalTokens', 'briefingId', 'transcriptId', 'documentId', 'recordingId', 'processingTime',
        'model', 'apiVersion', 'requestId', 'sessionId', 'jobId', 'queuePosition'];
      
      const entries = Object.entries(metadata)
        .filter(([key]) => !technicalFields.includes(key))
        .map(([key, value]) => {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase();
          return `${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}`;
        });
      return entries.length > 0 ? entries.join(", ") : "";
  }
}

// Extract technical details from metadata for optional display
function extractTechnicalDetails(metadata: Record<string, any>): { key: string; value: string }[] {
  const technicalFields = ['cost', 'inputTokens', 'outputTokens', 'totalTokens', 'briefingId', 
    'transcriptId', 'documentId', 'recordingId', 'processingTime', 'model', 'sourceMeetingCount'];
  
  return Object.entries(metadata)
    .filter(([key]) => technicalFields.includes(key))
    .map(([key, value]) => {
      // Format the key nicely
      const formattedKey = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, str => str.toUpperCase())
        .trim();
      
      // Format specific values
      let formattedValue = String(value);
      if (key === 'cost') {
        formattedValue = `$${Number(value).toFixed(4)}`;
      } else if (key.includes('Tokens')) {
        formattedValue = Number(value).toLocaleString();
      }
      
      return { key: formattedKey, value: formattedValue };
    });
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
                          {formatEventType(log.eventType)}
                        </span>
                        {log.severity !== 'info' && (
                          <Badge
                            variant="outline"
                            className={SEVERITY_COLORS[log.severity]}
                            data-testid={`badge-severity-${log.severity}`}
                          >
                            {log.severity}
                          </Badge>
                        )}
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
                        const technicalDetails = metadata ? extractTechnicalDetails(metadata) : [];
                        
                        return (
                          <>
                            {formattedDetails && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                <span className="font-medium">Details:</span>{" "}
                                <span>{formattedDetails}</span>
                              </div>
                            )}
                            {technicalDetails.length > 0 && (
                              <Collapsible className="mt-2">
                                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid={`trigger-technical-${log.id}`}>
                                  <Settings className="w-3 h-3" />
                                  <span>Technical details</span>
                                  <ChevronDown className="w-3 h-3 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1.5 pl-4 border-l-2 border-muted">
                                  <div className="space-y-0.5 text-xs text-muted-foreground">
                                    {technicalDetails.map(({ key, value }) => (
                                      <div key={key} className="flex gap-2">
                                        <span className="text-muted-foreground/70">{key}:</span>
                                        <span className="font-mono">{value}</span>
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                          </>
                        );
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
