import { useState } from "react";
import { FileText, Calendar, User, CheckCircle2, Clock, MoreVertical, Download, Eye, Headphones, MessageSquarePlus, AlertCircle, Archive, Share2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AddQuickNoteModal from "@/components/AddQuickNoteModal";
import SetPriorityDeadlineModal from "@/components/SetPriorityDeadlineModal";
import ShareLinkModal from "@/components/ShareLinkModal";
import DownloadModal from "@/components/DownloadModal";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useCaseActions } from "@/hooks/useCaseActions";
import { useCaseExport } from "@/hooks/useCaseExport";

interface CaseCardProps {
  id: string;
  title: string;
  clientName: string;
  meetingDate: string;
  status: "completed" | "processing" | "pending" | "review_required" | "failed";
  createdBy: string;
  priority?: "urgent" | "deadline-soon" | "normal";
  audioExpiresIn?: number;
  deadline?: string | null;
  deadlineIsAllDay?: boolean;
  reviewed?: boolean;
}

export default function CaseCard({ 
  id, 
  title, 
  clientName, 
  meetingDate, 
  status, 
  createdBy,
  priority = "normal",
  audioExpiresIn,
  deadline = null,
  deadlineIsAllDay = false,
  reviewed = false
}: CaseCardProps) {
  const [, setLocation] = useLocation();
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const { toast } = useToast();

  const { markReviewedMutation, archiveMutation, assignMutation } = useCaseActions({ caseId: id });
  const { documents, caseData, transcript, handleDownload } = useCaseExport({ caseId: id, enabled: showDownloadModal || showShareModal });

  const statusConfig = {
    completed: { icon: CheckCircle2, label: "Completed", variant: "default" as const },
    processing: { icon: Loader2, label: "Processing", variant: "secondary" as const },
    pending: { icon: Clock, label: "Pending", variant: "outline" as const },
    review_required: { icon: Eye, label: "Review Required", variant: "secondary" as const },
    failed: { icon: AlertCircle, label: "Failed", variant: "destructive" as const },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const getAudioBadgeColor = () => {
    if (!audioExpiresIn) return "";
    if (audioExpiresIn <= 2) return "bg-destructive";
    if (audioExpiresIn <= 6) return "bg-amber-500";
    return "bg-primary";
  };

  const handleAction = (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (action === 'add-note') {
      setShowAddNoteModal(true);
    } else if (action === 'set-priority') {
      setShowPriorityModal(true);
    } else if (action === 'share') {
      setShowShareModal(true);
    } else if (action === 'review') {
      markReviewedMutation.mutate(!reviewed);
    } else if (action === 'archive') {
      archiveMutation.mutate(true);
    } else if (action === 'assign') {
      toast({
        title: "Coming soon",
        description: "Team member assignment will be available soon",
      });
    } else if (action === 'download') {
      setShowDownloadModal(true);
    }
  };

  const getPriorityBadge = () => {
    if (reviewed) {
      return (
        <Badge 
          className="bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-500/30 text-xs font-medium px-2.5 py-0.5"
          data-testid={`badge-reviewed-${id}`}
        >
          Reviewed
        </Badge>
      );
    }
    
    if (priority === "urgent") {
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-500/30 text-xs font-medium px-2.5 py-0.5">
          Action Required
        </Badge>
      );
    }
    
    if (priority === "deadline-soon") {
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30 text-xs font-medium px-2.5 py-0.5">
          Deadline Approaching
        </Badge>
      );
    }
    
    return null;
  };

  return (
    <Card 
      className="group relative overflow-visible transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer dark:border-[hsl(220,60%,18%)] dark:shadow-[0_4px_20px_rgba(0,0,20,0.4),inset_0_1px_0_rgba(100,150,255,0.05)]" 
      data-testid={`card-case-${id}`}
      onClick={() => setLocation(`/case/${id}`)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              Details
            </span>
            {getPriorityBadge()}
            {(status === "pending" || status === "processing") && (
              <Badge variant={config.variant} className="gap-1 text-xs">
                <StatusIcon className="w-3 h-3" />
                {config.label}
              </Badge>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground" data-testid={`button-actions-${id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/case/${id}`); }} data-testid={`action-view-${id}`}>
                <FileText className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => handleAction('set-priority', e)} data-testid={`action-set-priority-${id}`}>
                <AlertCircle className="w-4 h-4 mr-2" />
                Set Priority/Deadline
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleAction('add-note', e)} data-testid={`action-add-note-${id}`}>
                <MessageSquarePlus className="w-4 h-4 mr-2" />
                Add Quick Note
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => handleAction('share', e)} data-testid={`action-share-${id}`}>
                <Share2 className="w-4 h-4 mr-2" />
                Secure Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleAction('review', e)} data-testid={`action-review-${id}`}>
                <Eye className="w-4 h-4 mr-2" />
                {reviewed ? "Unmark as Reviewed" : "Mark as Reviewed"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleAction('download', e)} data-testid={`action-download-${id}`}>
                <Download className="w-4 h-4 mr-2" />
                Download Document
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => handleAction('archive', e)} data-testid={`action-archive-${id}`}>
                <Archive className="w-4 h-4 mr-2" />
                Archive Case
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground leading-tight mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{clientName}</p>
        </div>
        
        <div className="space-y-2 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span>{meetingDate}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span>{createdBy}</span>
          </div>
          {audioExpiresIn !== undefined && (
            <div className="flex items-center gap-2">
              <Badge className={`${getAudioBadgeColor()} gap-1 text-xs`} data-testid={`badge-audio-${id}`}>
                <Headphones className="w-3 h-3" />
                Audio expires in {audioExpiresIn}h
              </Badge>
            </div>
          )}
        </div>
      </CardContent>

      <AddQuickNoteModal
        open={showAddNoteModal}
        onOpenChange={setShowAddNoteModal}
        caseId={id}
      />

      <SetPriorityDeadlineModal
        open={showPriorityModal}
        onOpenChange={setShowPriorityModal}
        caseId={id}
        caseTitle={title}
        currentPriority={priority}
        currentDeadline={deadline}
        currentDeadlineIsAllDay={deadlineIsAllDay}
      />

      <ShareLinkModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        caseId={id}
        caseTitle={title}
        userRole="Partner"
        recipientName={clientName}
        litigationHold={!!caseData?.litigationHold}
        documents={documents.map((d: any) => ({
          type: d.type,
          status: d.status,
          isActive: d.isActive,
        }))}
        availableDocuments={{
          hasAttendanceNote: !!documents.find((d: any) => d.isActive && (d.type === 'attendance_note' || d.type === 'meeting_notes')),
          hasSummary: !!documents.find((d: any) => d.isActive && (d.type === 'summary' || d.type === 'client_letter')) || !!caseData?.textNotes,
          hasTranscript: !!documents.find((d: any) => d.isActive && d.type === 'transcript') || !!transcript?.content,
        }}
      />

      <DownloadModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        availableDocuments={{
          hasAttendanceNote: !!documents.find((d: any) => d.isActive && (d.type === 'attendance_note' || d.type === 'meeting_notes')),
          hasSummary: !!documents.find((d: any) => d.isActive && (d.type === 'summary' || d.type === 'client_letter')) || !!caseData?.textNotes,
          hasTranscript: !!documents.find((d: any) => d.isActive && d.type === 'transcript') || !!transcript?.content,
        }}
        sharedDocuments={['attendance_note', 'summary', 'transcript']}
        onDownload={handleDownload}
      />
    </Card>
  );
}
