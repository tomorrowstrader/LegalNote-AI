import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast, isFuture, isToday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Calendar,
  Clock,
  FileText,
  Shield,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Filter,
  Mic,
  Bot,
  Send,
  Eye,
  ListChecks,
  CalendarClock,
  Circle,
  Download,
} from "lucide-react";

interface CaseTimelineProps {
  caseId: string;
}

interface CaseData {
  id: string;
  title: string;
  clientName: string;
  createdAt: string;
  deadline?: string | null;
  priority?: string;
  status?: string;
}

interface DocumentData {
  id: string;
  type: string;
  version: number;
  status?: string;
  createdAt: string;
  isActive?: boolean;
}

interface ActionItemData {
  id: string;
  description: string;
  assignee?: string | null;
  dueDate?: string | null;
  priority?: string;
  status?: string;
  completed?: boolean;
}

interface AuditLogData {
  id: string;
  eventType: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ConsentLogData {
  id: string;
  consentGiven: boolean;
  consentTimestamp: string;
  consentModality?: string;
}

interface AudioRecordingData {
  id: string;
  recordedAt: string;
  duration?: number | null;
  expiresAt: string;
  deletedAt?: string | null;
}

type TimelineEventType = 
  | "case_created"
  | "consent"
  | "recording"
  | "processing"
  | "document"
  | "action_item"
  | "deadline"
  | "share"
  | "export"
  | "audit";

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  timestamp: Date;
  isDeadline?: boolean;
  isPast?: boolean;
  isFuture?: boolean;
  status?: "completed" | "pending" | "overdue" | "upcoming";
  metadata?: Record<string, any>;
}

const EVENT_ICONS: Record<TimelineEventType, any> = {
  case_created: FileText,
  consent: Shield,
  recording: Mic,
  processing: Bot,
  document: FileText,
  action_item: ListChecks,
  deadline: CalendarClock,
  share: Send,
  export: Download,
  audit: Eye,
};

const EVENT_COLORS: Record<TimelineEventType, string> = {
  case_created: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  consent: "bg-green-500/10 text-green-500 border-green-500/30",
  recording: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  processing: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  document: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
  action_item: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  deadline: "bg-red-500/10 text-red-500 border-red-500/30",
  share: "bg-pink-500/10 text-pink-500 border-pink-500/30",
  export: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30",
  audit: "bg-slate-500/10 text-slate-500 border-slate-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/10 text-green-500",
  pending: "bg-amber-500/10 text-amber-500",
  overdue: "bg-red-500/10 text-red-500",
  upcoming: "bg-blue-500/10 text-blue-500",
};

const FILTER_OPTIONS: { value: TimelineEventType | "all"; label: string }[] = [
  { value: "all", label: "All Events" },
  { value: "deadline", label: "Deadlines" },
  { value: "document", label: "Documents" },
  { value: "export", label: "Exports" },
  { value: "action_item", label: "Action Items" },
  { value: "consent", label: "Consent" },
  { value: "processing", label: "AI Processing" },
];

export function CaseTimeline({ caseId }: CaseTimelineProps) {
  const [filter, setFilter] = useState<TimelineEventType | "all">("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["upcoming", "recent"]));

  const { data: caseData } = useQuery<CaseData>({
    queryKey: [`/api/cases/${caseId}`],
  });

  const { data: documents = [] } = useQuery<DocumentData[]>({
    queryKey: [`/api/cases/${caseId}/documents`],
    enabled: !!caseId,
  });

  const { data: actionItems = [] } = useQuery<ActionItemData[]>({
    queryKey: [`/api/cases/${caseId}/action-items`],
    enabled: !!caseId,
  });

  const { data: auditLogs = [] } = useQuery<AuditLogData[]>({
    queryKey: [`/api/cases/${caseId}/audit`],
    enabled: !!caseId,
  });

  const { data: consentLogs = [] } = useQuery<ConsentLogData[]>({
    queryKey: [`/api/consent/by-case/${caseId}`],
    enabled: !!caseId,
  });

  const { data: audioData } = useQuery<AudioRecordingData>({
    queryKey: [`/api/audio/by-case/${caseId}`],
    enabled: !!caseId,
  });

  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    if (caseData) {
      events.push({
        id: `case-created-${caseData.id}`,
        type: "case_created",
        title: "Case Created",
        description: `${caseData.title} - ${caseData.clientName}`,
        timestamp: new Date(caseData.createdAt),
        status: "completed",
      });

      if (caseData.deadline) {
        const deadlineDate = new Date(caseData.deadline);
        const isOverdue = isPast(deadlineDate) && !isToday(deadlineDate);
        const isUpcoming = isFuture(deadlineDate) || isToday(deadlineDate);
        
        events.push({
          id: `deadline-${caseData.id}`,
          type: "deadline",
          title: "Case Deadline",
          description: caseData.title,
          timestamp: deadlineDate,
          isDeadline: true,
          isFuture: isUpcoming,
          isPast: isOverdue,
          status: isOverdue ? "overdue" : isUpcoming ? "upcoming" : "completed",
        });
      }
    }

    consentLogs.forEach((log) => {
      events.push({
        id: `consent-${log.id}`,
        type: "consent",
        title: log.consentGiven ? "Consent Recorded" : "Consent Declined",
        description: log.consentModality ? `Method: ${log.consentModality.replace(/_/g, " ")}` : undefined,
        timestamp: new Date(log.consentTimestamp),
        status: "completed",
        metadata: { consentGiven: log.consentGiven },
      });
    });

    if (audioData) {
      events.push({
        id: `recording-${audioData.id}`,
        type: "recording",
        title: "Audio Recording",
        description: audioData.duration 
          ? `Duration: ${Math.floor(audioData.duration / 60)}m ${audioData.duration % 60}s`
          : "Recording uploaded",
        timestamp: new Date(audioData.recordedAt),
        status: "completed",
      });

      if (audioData.expiresAt && !audioData.deletedAt) {
        const expiryDate = new Date(audioData.expiresAt);
        const isExpired = isPast(expiryDate);
        events.push({
          id: `audio-expiry-${audioData.id}`,
          type: "deadline",
          title: isExpired ? "Audio Expired" : "Audio Expires",
          description: "GDPR retention limit",
          timestamp: expiryDate,
          isDeadline: true,
          isFuture: !isExpired,
          isPast: isExpired,
          status: isExpired ? "completed" : "upcoming",
        });
      }
    }

    documents.forEach((doc) => {
      const docStatus = doc.status || "draft";
      const docVersion = doc.version ?? 1;
      events.push({
        id: `document-${doc.id}`,
        type: "document",
        title: doc.type === "attendance_note" ? "Attendance Note Created" : "Summary Created",
        description: `Version ${docVersion}${docStatus === "approved" ? " (Approved)" : " (Draft)"}`,
        timestamp: new Date(doc.createdAt),
        status: docStatus === "approved" ? "completed" : "pending",
        metadata: { documentType: doc.type, version: docVersion },
      });
    });

    actionItems.forEach((item) => {
      if (item.dueDate) {
        const dueDate = new Date(item.dueDate);
        const isCompleted = item.completed === true;
        const isOverdue = isPast(dueDate) && !isCompleted;
        const isUpcoming = isFuture(dueDate) && !isCompleted;
        const descText = item.description || "Action item";
        
        events.push({
          id: `action-due-${item.id}`,
          type: "action_item",
          title: isCompleted ? "Action Item Completed" : "Action Item Due",
          description: descText.length > 100 ? descText.substring(0, 100) + "..." : descText,
          timestamp: dueDate,
          isDeadline: !isCompleted,
          isFuture: isUpcoming,
          isPast: isOverdue,
          status: isCompleted ? "completed" : isOverdue ? "overdue" : "upcoming",
          metadata: item.assignee || item.priority ? { assignee: item.assignee, priority: item.priority } : undefined,
        });
      }
    });

    const significantAuditEvents = auditLogs.filter(log => 
      ["ai_processing_started", "ai_processing_completed", "transcription_completed", 
       "share_link_created", "document_sent", "document_approved",
       "document_exported_pdf", "document_exported_word", "document_exported",
       "audio_permanently_deleted", "case_handover", "external_document_referenced"].includes(log.eventType)
    );

    significantAuditEvents.forEach((log) => {
      let title = log.eventType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      let type: TimelineEventType = "audit";
      let description: string | undefined;
      
      if (log.eventType.includes("processing") || log.eventType.includes("transcription")) {
        type = "processing";
        title = log.eventType === "ai_processing_started" ? "AI Processing Started" :
                log.eventType === "ai_processing_completed" ? "AI Processing Completed" :
                "Transcription Completed";
      } else if (log.eventType === "case_handover") {
        type = "audit";
        title = "Case Handover";
        const meta = log.metadata;
        description = meta?.incomingSolicitorName 
          ? `Transferred to ${String(meta.incomingSolicitorName)}` 
          : "Case transferred to new fee earner";
        if (meta?.handoverNote) {
          description += ` - ${String(meta.handoverNote)}`;
        }
      } else if (log.eventType === "external_document_referenced") {
        type = "document";
        title = "External Document Referenced";
        const meta = log.metadata;
        description = meta?.description
          ? `${String(meta.documentType || "Document")}: ${String(meta.description)}`
          : "External document reference logged";
      } else if (log.eventType === "audio_permanently_deleted") {
        type = "consent";
        title = "Audio Permanently Deleted (GDPR)";
        const meta = log.metadata;
        description = meta?.matterReference
          ? `Matter: ${String(meta.matterReference)} - Retention period expired`
          : "Audio deleted per GDPR retention policy";
      } else if (log.eventType.includes("share") || log.eventType.includes("sent")) {
        type = "share";
      } else if (log.eventType.includes("exported")) {
        type = "export";
        const format = log.eventType === "document_exported_pdf" ? "PDF" :
                       log.eventType === "document_exported_word" ? "Word" : "document";
        title = `Working Copy Downloaded (${format})`;
        const docs = log.metadata?.documents;
        if (Array.isArray(docs) && docs.length > 0) {
          description = `Exported: ${docs.map((d: string) => d.replace(/_/g, ' ')).join(', ')}`;
        }
      }

      events.push({
        id: `audit-${log.id}`,
        type,
        title,
        description,
        timestamp: new Date(log.timestamp),
        status: "completed",
      });
    });

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [caseData, documents, actionItems, auditLogs, consentLogs, audioData]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return timelineEvents;
    return timelineEvents.filter(event => event.type === filter);
  }, [timelineEvents, filter]);

  const groupedEvents = useMemo(() => {
    const now = new Date();
    const groups: Record<string, TimelineEvent[]> = {
      overdue: [],
      upcoming: [],
      recent: [],
      older: [],
    };

    filteredEvents.forEach(event => {
      if (event.status === "overdue") {
        groups.overdue.push(event);
      } else if (event.isFuture || event.status === "upcoming") {
        groups.upcoming.push(event);
      } else {
        const daysDiff = Math.floor((now.getTime() - event.timestamp.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 7) {
          groups.recent.push(event);
        } else {
          groups.older.push(event);
        }
      }
    });

    groups.upcoming.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return groups;
  }, [filteredEvents]);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const renderEvent = (event: TimelineEvent) => {
    const Icon = EVENT_ICONS[event.type];
    const colorClass = EVENT_COLORS[event.type];
    const statusColor = event.status ? STATUS_COLORS[event.status] : "";

    const isExportEvent = event.type === "export";

    return (
      <div 
        key={event.id} 
        className={`flex gap-3 py-3 border-b border-border/50 last:border-0 ${isExportEvent ? 'bg-indigo-50/50 dark:bg-indigo-950/20 -mx-3 px-3 rounded-md' : ''}`}
        data-testid={`timeline-event-${event.id}`}
      >
        <div className={`flex-shrink-0 ${isExportEvent ? 'w-9 h-9' : 'w-8 h-8'} rounded-full flex items-center justify-center ${colorClass} border ${isExportEvent ? 'border-2 ring-2 ring-indigo-500/20' : ''}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground">{event.title}</span>
                {event.status && (
                  <Badge variant="outline" className={`text-xs ${statusColor}`}>
                    {event.status === "overdue" && <AlertCircle className="w-3 h-3 mr-1" />}
                    {event.status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {event.status === "upcoming" && <Clock className="w-3 h-3 mr-1" />}
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </Badge>
                )}
              </div>
              {event.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-xs text-muted-foreground">
                {format(event.timestamp, "dd MMM yyyy")}
              </div>
              <div className="text-xs text-muted-foreground/70">
                {formatDistanceToNow(event.timestamp, { addSuffix: true })}
              </div>
            </div>
          </div>
          {event.metadata?.assignee && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span>Assignee: {event.metadata.assignee}</span>
              {event.metadata.priority && (
                <Badge variant="outline" className="text-xs ml-2">
                  {event.metadata.priority}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGroup = (title: string, events: TimelineEvent[], groupKey: string, icon: any) => {
    if (events.length === 0) return null;
    
    const GroupIcon = icon;
    const isExpanded = expandedGroups.has(groupKey);

    return (
      <Collapsible 
        open={isExpanded} 
        onOpenChange={() => toggleGroup(groupKey)}
        className="mb-2"
      >
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between px-3 py-2 h-auto hover-elevate"
            data-testid={`timeline-group-${groupKey}`}
          >
            <div className="flex items-center gap-2">
              <GroupIcon className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">{title}</span>
              <Badge variant="secondary" className="text-xs">
                {events.length}
              </Badge>
            </div>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3">
          {events.map(renderEvent)}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Card data-testid="card-case-timeline">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Case Timeline
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as TimelineEventType | "all")}
              className="text-sm bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="select-timeline-filter"
            >
              {FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[400px] pr-4">
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No timeline events found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {renderGroup("Overdue", groupedEvents.overdue, "overdue", AlertCircle)}
              {renderGroup("Upcoming", groupedEvents.upcoming, "upcoming", Clock)}
              {renderGroup("Recent (Last 7 Days)", groupedEvents.recent, "recent", Circle)}
              {renderGroup("Older", groupedEvents.older, "older", Calendar)}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default CaseTimeline;
