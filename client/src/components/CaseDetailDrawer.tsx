import { useState, useEffect } from "react";
import { format, isPast, differenceInCalendarDays } from "date-fns";
import { 
  FileText, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Eye, 
  Download, 
  Share2, 
  Archive, 
  MessageSquarePlus, 
  AlertCircle,
  ExternalLink,
  Loader2,
  Mic,
  Timer,
  Briefcase,
  FileCheck2,
  ListChecks,
  Lock,
  AudioLines,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PRACTICE_AREA_LABELS, type PracticeArea } from "@shared/schema";
import { formatDuration, type CaseSummary } from "@shared/caseSummary";
import { parseInstructionStatus } from "@shared/instructionStatus";
import { isClientMatterKind } from "@shared/matterKinds";
import { Skeleton } from "@/components/ui/skeleton";
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

const COMPACT_BREAKPOINT = 1024;

function useIsCompactLayout() {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < COMPACT_BREAKPOINT : true,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT - 1}px)`);
    const onChange = () => setCompact(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return compact;
}

interface CaseDetailDrawerProps {
  caseItem: Case | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CaseDetailDrawer({ caseItem, open, onOpenChange }: CaseDetailDrawerProps) {
  const [, setLocation] = useLocation();
  const isCompact = useIsCompactLayout();
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
    enabled: (showDownloadModal || showShareModal) && hasCaseId
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<CaseSummary>({
    queryKey: ["/api/cases", caseId, "summary"],
    enabled: open && hasCaseId,
    staleTime: 30_000,
  });

  if (!caseItem) return null;

  const matterStatusLabel = !isClientMatterKind(caseItem.matterKind)
    ? "Non-client meeting"
    : parseInstructionStatus(caseItem.instructionStatus) === "enquiry"
      ? "Enquiry"
      : "Instructed";

  const attendanceNoteLabel = (() => {
    if (!summary) return "—";
    const { status, total, approved } = summary.attendanceNote;
    if (status === "none") return "Not yet produced";
    if (status === "approved") return total > 1 ? `All ${total} approved` : "Approved";
    return total > 1 ? `${approved} of ${total} approved` : "Draft, awaiting review";
  })();

  const audioDaysLeft = summary?.audio.expiresAt
    ? differenceInCalendarDays(new Date(summary.audio.expiresAt), new Date())
    : null;
  const audioExpiresSoon = !caseItem.litigationHold && audioDaysLeft !== null && audioDaysLeft <= 1;
  const audioLabel = (() => {
    if (caseItem.litigationHold) return "Kept: litigation hold";
    if (!summary) return "—";
    if (!summary.audio.hasAudio) return "No audio";
    if (summary.audio.allDeleted) return "Deleted";
    if (summary.audio.expiresAt) {
      return `Deletes ${format(new Date(summary.audio.expiresAt), "d MMM")}`;
    }
    return "Kept";
  })();

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
          side={isCompact ? "bottom" : "right"}
          className={cn(
            "overflow-y-auto",
            isCompact
              ? "h-auto max-h-[min(88dvh,calc(100dvh-1rem))] w-full rounded-t-2xl px-5 pt-5"
              : "w-full sm:max-w-md",
          )}
        >
          {isCompact && (
            <div
              className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
              aria-hidden
            />
          )}
          <SheetHeader className="text-left pb-4 pr-8">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg font-semibold leading-tight mb-1 truncate">
                  {caseItem.clientName}
                </SheetTitle>
                <SheetDescription className="text-sm truncate">
                  {caseItem.title}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {getStatusBadge()}
            </div>
          </SheetHeader>

          <Separator className="my-4" />

          {/* Case Summary */}
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Summary</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3" data-testid="drawer-summary">
              <SummaryFact
                icon={Mic}
                label={summary && summary.meetingCount > 1 ? "Latest meeting" : "Meeting"}
                loading={summaryLoading}
                value={
                  summary?.latestMeetingAt
                    ? `${format(new Date(summary.latestMeetingAt), "d MMM yyyy, HH:mm")}`
                    : "Not recorded yet"
                }
                sub={summary?.latestMeetingTypeLabel ?? undefined}
              />
              <SummaryFact
                icon={Timer}
                label="Duration"
                loading={summaryLoading}
                value={
                  summary?.totalDurationSeconds != null
                    ? formatDuration(summary.totalDurationSeconds)
                    : "Not known"
                }
                sub={
                  summary && summary.meetingCount > 1
                    ? `Across ${summary.meetingCount} meetings`
                    : undefined
                }
              />
              <SummaryFact
                icon={Briefcase}
                label="Practice area"
                value={
                  caseItem.practiceArea
                    ? PRACTICE_AREA_LABELS[caseItem.practiceArea as PracticeArea] ?? caseItem.practiceArea
                    : "Not set"
                }
                sub={matterStatusLabel}
              />
              <SummaryFact
                icon={FileCheck2}
                label="Attendance note"
                loading={summaryLoading}
                value={attendanceNoteLabel}
                tone={summary?.attendanceNote.status === "draft" ? "warn" : undefined}
              />
              <SummaryFact
                icon={ListChecks}
                label="Action items"
                loading={summaryLoading}
                value={
                  summary
                    ? summary.openActionItems === 0
                      ? "None open"
                      : `${summary.openActionItems} open`
                    : "—"
                }
              />
              <SummaryFact
                icon={caseItem.litigationHold ? Lock : AudioLines}
                label="Audio"
                loading={summaryLoading}
                value={audioLabel}
                tone={audioExpiresSoon ? "warn" : undefined}
              />
              {caseItem.deadline && (
                <SummaryFact
                  icon={Clock}
                  label="Deadline"
                  value={`${format(new Date(caseItem.deadline), "d MMM yyyy")}${isOverdue ? " (Overdue)" : ""}`}
                  tone={isOverdue ? "danger" : undefined}
                />
              )}
              {caseItem.supervisorName && (
                <SummaryFact icon={UserCheck} label="Supervisor" value={caseItem.supervisorName} />
              )}
              <SummaryFact
                icon={Calendar}
                label="Created"
                value={format(new Date(caseItem.createdAt), "d MMM yyyy, HH:mm")}
              />
              {caseItem.matterReference && (
                <SummaryFact
                  icon={FileText}
                  label="Matter reference"
                  value={caseItem.matterReference}
                  mono
                />
              )}
            </dl>

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</p>
              
              <Button 
                variant="default" 
                className="w-full justify-start gap-2 rounded-xl" 
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
        recipientName={caseItem.clientName}
        litigationHold={!!caseItem.litigationHold}
        documents={(documents ?? []).map((d: any) => ({
          type: d.type,
          status: d.status,
          isActive: d.isActive,
        }))}
        availableDocuments={{
          hasAttendanceNote: !!documents?.find((d: any) => d.isActive && (d.type === 'attendance_note' || d.type === 'meeting_notes')),
          hasSummary: !!documents?.find((d: any) => d.isActive && (d.type === 'summary' || d.type === 'client_letter')) || !!caseData?.textNotes,
          hasTranscript: !!documents?.find((d: any) => d.isActive && d.type === 'transcript') || !!transcript?.content,
        }}
      />

      <DownloadModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        availableDocuments={{
          hasAttendanceNote: !!documents?.find((d: any) => d.isActive && (d.type === 'attendance_note' || d.type === 'meeting_notes')),
          hasSummary: !!documents?.find((d: any) => d.isActive && (d.type === 'summary' || d.type === 'client_letter')) || !!caseData?.textNotes,
          hasTranscript: !!documents?.find((d: any) => d.isActive && d.type === 'transcript') || !!transcript?.content,
        }}
        sharedDocuments={['attendance_note', 'summary', 'transcript']}
        onDownload={handleDownload}
      />
    </>
  );
}

function SummaryFact({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  mono,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: "warn" | "danger";
  mono?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon
        className={cn(
          "w-4 h-4 mt-0.5 flex-shrink-0",
          tone === "danger" ? "text-red-500" : tone === "warn" ? "text-amber-500" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd
          className={cn(
            "text-sm font-medium break-words",
            mono && "font-mono text-xs",
            tone === "danger" && "text-red-600 dark:text-red-400",
            tone === "warn" && "text-amber-700 dark:text-amber-400",
          )}
        >
          {loading ? <Skeleton className="h-4 w-20 mt-0.5" /> : value}
        </dd>
        {sub && !loading && <dd className="text-xs text-muted-foreground">{sub}</dd>}
      </div>
    </div>
  );
}
