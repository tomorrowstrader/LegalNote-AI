import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Send, 
  FileText, 
  Clock, 
  AlertTriangle, 
  Download, 
  Mail, 
  Link2, 
  History,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SharedHistoryRecord {
  id: string;
  documentId: string;
  sentToClient: boolean;
  sentAt: string | null;
  sentBy: string | null;
  sentMethod: string | null;
  amendmentReason: string | null;
  versionChangeWarned: boolean;
  document: {
    id: string;
    caseId: string;
    type: string;
    content: string;
    version: number;
    createdAt: string;
    status: string;
  };
}

interface SharedHistoryViewerProps {
  caseId: string;
}

function getMethodIcon(method: string | null) {
  switch (method) {
    case 'email':
      return <Mail className="w-4 h-4" />;
    case 'download':
      return <Download className="w-4 h-4" />;
    case 'share_link':
    default:
      return <Link2 className="w-4 h-4" />;
  }
}

function getMethodLabel(method: string | null): string {
  switch (method) {
    case 'email':
      return 'Emailed';
    case 'download':
      return 'Downloaded';
    case 'share_link':
      return 'Share Link';
    case 'sms_2fa':
      return 'SMS 2FA Link';
    default:
      return method || 'Shared';
  }
}

function getDocumentTypeLabel(type: string): string {
  switch (type) {
    case 'attendance_note':
      return 'Attendance Note';
    case 'summary':
      return 'Summary';
    case 'transcript':
      return 'Transcript';
    default:
      return type;
  }
}

export default function SharedHistoryViewer({ caseId }: SharedHistoryViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { data: history, isLoading } = useQuery<SharedHistoryRecord[]>({
    queryKey: [`/api/cases/${caseId}/shared-history`],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" />
            Client Sharing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-pulse text-sm text-muted-foreground">Loading history...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" />
            Client Sharing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No versioned documents have been shared with the client yet.</p>
            <p className="text-xs mt-1">Tracks Attendance Notes and Summaries shared via link or download.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedHistory = isExpanded ? history : history.slice(0, 3);
  const hasMoreRecords = history.length > 3;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" />
            Client Sharing History
          </CardTitle>
          <Badge variant="secondary" data-testid="badge-share-count">
            {history.length} share{history.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayedHistory.map((record, idx) => (
          <div 
            key={record.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border bg-card",
              record.versionChangeWarned && "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
            )}
            data-testid={`shared-history-item-${idx}`}
          >
            <div className="flex-shrink-0 mt-0.5">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                record.versionChangeWarned 
                  ? "bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-300"
                  : "bg-primary/10 text-primary"
              )}>
                {getMethodIcon(record.sentMethod)}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">
                  {getDocumentTypeLabel(record.document.type)}
                </span>
                <Badge variant="outline" className="text-xs">
                  v{record.document.version}
                </Badge>
                <Badge 
                  variant={record.document.status === 'approved' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {record.document.status === 'approved' ? 'Approved' : 'Draft'}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {record.sentAt ? format(new Date(record.sentAt), "dd MMM yyyy 'at' HH:mm") : 'Unknown date'}
                <span className="text-muted-foreground/50">•</span>
                <span>{getMethodLabel(record.sentMethod)}</span>
              </div>
              
              {record.versionChangeWarned && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Different version from previous share</span>
                </div>
              )}
              
              {record.amendmentReason && (
                <div className="mt-2 text-xs bg-muted p-2 rounded">
                  <span className="font-medium">Amendment reason: </span>
                  {record.amendmentReason}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {hasMoreRecords && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full text-muted-foreground"
            data-testid="button-toggle-history"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Show {history.length - 3} More
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
