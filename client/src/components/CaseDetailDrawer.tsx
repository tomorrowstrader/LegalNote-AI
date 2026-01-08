import { useState } from "react";
import { format, isPast } from "date-fns";
import { 
  FileText, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle2, 
  Eye, 
  Download, 
  Share2, 
  Archive, 
  MessageSquarePlus, 
  AlertCircle,
  ExternalLink,
  Loader2
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Case } from "@shared/schema";
import { useLocation } from "wouter";
import { useCaseActions } from "@/hooks/useCaseActions";
import { useCaseExport } from "@/hooks/useCaseExport";
import AddQuickNoteModal from "@/components/AddQuickNoteModal";
import SetPriorityDeadlineModal from "@/components/SetPriorityDeadlineModal";
import ShareLinkModal from "@/components/ShareLinkModal";
import DownloadModal from "@/components/DownloadModal";
import { cn } from "@/lib/utils";

interface CaseDetailDrawerProps {
  caseItem: Case | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CaseDetailDrawer({ caseItem, open, onOpenChange }: CaseDetailDrawerProps) {
  const [, setLocation] = useLocation();
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const caseId = caseItem?.id || "";
  const hasCaseId = !!caseItem?.id;

  const { markReviewedMutation, archiveMutation } = useCaseActions({ 
    caseId
  });
  
  const { documents, caseData, transcript, handleDownload } = useCaseExport({ 
    caseId, 
    enabled: showDownloadModal && hasCaseId
  });

  if (!caseItem) return null;

  const isOverdue = caseItem.deadline && isPast(new Date(caseItem.deadline)) && !caseItem.reviewed;
  const isProcessing = caseItem.status === "processing";

  const getStatusBadge = () => {
    if (caseItem.reviewed) {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Reviewed
        </Badge>
      );
    }

    if (isOverdue) {
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-500/30">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    }

    if (caseItem.priority === "urgent") {
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-500/30">
          <AlertCircle className="w-3 h-3 mr-1" />
          Action Required
        </Badge>
      );
    }

    if (caseItem.priority === "deadline-soon") {
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30">
          <Clock className="w-3 h-3 mr-1" />
          Deadline Approaching
        </Badge>
      );
    }

    if (isProcessing) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </Badge>
      );
    }

    if (caseItem.status === "completed") {
      return (
        <Badge variant="secondary">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    }

    return (
      <Badge variant="outline">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const handleViewDetails = () => {
    onOpenChange(false);
    setLocation(`/case/${caseItem.id}`);
  };

  const handleMarkReviewed = () => {
    markReviewedMutation.mutate(!caseItem.reviewed);
  };

  const handleArchive = () => {
    archiveMutation.mutate(true);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-md overflow-y-auto"
        >
          <SheetHeader className="text-left pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg font-semibold leading-tight mb-1">
                  {caseItem.clientName}
                </SheetTitle>
                <SheetDescription className="text-sm">
                  {caseItem.title}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {getStatusBadge()}
            </div>
          </SheetHeader>

          <Separator className="my-4" />

          {/* Case Details */}
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-medium">{format(new Date(caseItem.createdAt), "d MMMM yyyy, h:mm a")}</p>
                </div>
              </div>

              {caseItem.deadline && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className={cn(
                    "w-4 h-4 flex-shrink-0",
                    isOverdue ? "text-red-500" : "text-muted-foreground"
                  )} />
                  <div>
                    <p className="text-muted-foreground text-xs">Deadline</p>
                    <p className={cn(
                      "font-medium",
                      isOverdue && "text-red-600 dark:text-red-400"
                    )}>
                      {format(new Date(caseItem.deadline), "d MMMM yyyy")}
                      {isOverdue && " (Overdue)"}
                    </p>
                  </div>
                </div>
              )}

              {caseItem.matterReference && (
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Matter Reference</p>
                    <p className="font-medium font-mono text-xs">{caseItem.matterReference}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</p>
              
              <Button 
                variant="default" 
                className="w-full justify-start gap-2" 
                onClick={handleViewDetails}
                data-testid="drawer-view-details"
              >
                <ExternalLink className="w-4 h-4" />
                View Full Details
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start gap-2"
                  onClick={handleMarkReviewed}
                  disabled={markReviewedMutation.isPending}
                  data-testid="drawer-mark-reviewed"
                >
                  <Eye className="w-4 h-4" />
                  {caseItem.reviewed ? "Unmark" : "Reviewed"}
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start gap-2"
                  onClick={() => setShowDownloadModal(true)}
                  data-testid="drawer-download"
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start gap-2"
                  onClick={() => setShowShareModal(true)}
                  data-testid="drawer-share"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start gap-2"
                  onClick={() => setShowAddNoteModal(true)}
                  data-testid="drawer-add-note"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  Note
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start gap-2"
                  onClick={() => setShowPriorityModal(true)}
                  data-testid="drawer-set-priority"
                >
                  <AlertCircle className="w-4 h-4" />
                  Priority
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                  onClick={handleArchive}
                  disabled={archiveMutation.isPending}
                  data-testid="drawer-archive"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </Button>
              </div>
            </div>

            {/* Text Notes Preview */}
            {caseItem.textNotes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes Preview</p>
                  <p className="text-sm text-muted-foreground line-clamp-4 bg-muted/50 rounded-md p-3">
                    {caseItem.textNotes}
                  </p>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Modals */}
      <AddQuickNoteModal
        open={showAddNoteModal}
        onOpenChange={setShowAddNoteModal}
        caseId={caseItem.id}
      />

      <SetPriorityDeadlineModal
        open={showPriorityModal}
        onOpenChange={setShowPriorityModal}
        caseId={caseItem.id}
        caseTitle={caseItem.title}
        currentPriority={caseItem.priority as "urgent" | "deadline-soon" | "normal" | undefined}
        currentDeadline={caseItem.deadline}
        currentDeadlineIsAllDay={caseItem.deadlineIsAllDay || false}
      />

      <ShareLinkModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        caseId={caseItem.id}
        caseTitle={caseItem.title}
        userRole="Partner"
      />

      <DownloadModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        availableDocuments={{
          hasAttendanceNote: !!documents?.find((d: any) => d.isActive && d.type === 'attendance_note'),
          hasSummary: !!documents?.find((d: any) => d.isActive && d.type === 'summary') || !!caseData?.textNotes,
          hasTranscript: !!documents?.find((d: any) => d.isActive && d.type === 'transcript') || !!transcript?.content,
        }}
        sharedDocuments={['attendance_note', 'summary', 'transcript']}
        onDownload={handleDownload}
      />
    </>
  );
}
