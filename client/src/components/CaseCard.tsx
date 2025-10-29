import { useState } from "react";
import { FileText, Calendar, User, CheckCircle2, Clock, MoreVertical, Mail, Download, UserPlus, Eye, Headphones, MessageSquarePlus, AlertCircle, Archive, Share2, Loader2 } from "lucide-react";
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
import EmailToClientModal from "@/components/EmailToClientModal";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF } from "@/lib/documentExport";

interface CaseCardProps {
  id: string;
  title: string;
  clientName: string;
  meetingDate: string;
  status: "completed" | "processing" | "pending" | "review_required" | "failed";
  createdBy: string;
  priority?: "urgent" | "deadline-soon" | "normal";
  audioExpiresIn?: number;
}

export default function CaseCard({ 
  id, 
  title, 
  clientName, 
  meetingDate, 
  status, 
  createdBy,
  priority = "normal",
  audioExpiresIn
}: CaseCardProps) {
  const [, setLocation] = useLocation();
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const { toast } = useToast();

  const markReviewedMutation = useMutation({
    mutationFn: async (reviewed: boolean) => {
      return await apiRequest('POST', `/api/cases/${id}/review`, { reviewed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', id] });
      toast({
        title: "Case updated",
        description: "Case marked as reviewed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark case as reviewed",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (archived: boolean) => {
      return await apiRequest('POST', `/api/cases/${id}/archive`, { archived });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', id] });
      toast({
        title: "Case archived",
        description: "Case has been archived successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to archive case",
        variant: "destructive",
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (assignedToUserId: string | null) => {
      return await apiRequest('POST', `/api/cases/${id}/assign`, { assignedToUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', id] });
      toast({
        title: "Case assigned",
        description: "Case has been assigned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign case",
        variant: "destructive",
      });
    },
  });

  const downloadPDFMutation = useMutation({
    mutationFn: async () => {
      // Fetch all case data in parallel
      const [caseData, documents, transcript, firmProfile] = await Promise.all([
        fetch(`/api/cases/${id}`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/cases/${id}/documents`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/cases/${id}/transcript`, { credentials: 'include' }).then(r => r.json()).catch(() => null),
        fetch(`/api/firm-profile`, { credentials: 'include' }).then(r => r.json()).catch(() => null),
      ]);

      // Find active documents by type
      const activeDocuments = documents.filter((doc: any) => doc.isActive);
      const attendanceNote = activeDocuments.find((doc: any) => doc.type === 'attendance_note');
      const legalOpinion = activeDocuments.find((doc: any) => doc.type === 'legal_opinion');

      // Generate comprehensive PDF
      await exportToPDF({
        caseTitle: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference,
        createdAt: caseData.createdAt,
        attendanceNote: attendanceNote?.content,
        legalOpinion: legalOpinion?.content,
        transcript: transcript?.content,
        documentType: 'full_case',
        firmProfile: firmProfile,
      });
    },
    onSuccess: () => {
      toast({
        title: "PDF downloaded",
        description: "Comprehensive case PDF has been generated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ email, message }: { email: string; message: string }) => {
      return await apiRequest('POST', `/api/cases/${id}/email`, {
        recipientEmail: email,
        customMessage: message || undefined,
      });
    },
    onSuccess: () => {
      setShowEmailModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/cases', id] });
      toast({
        title: "Email sent",
        description: "Case documents have been emailed to the client successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const statusConfig = {
    completed: { icon: CheckCircle2, label: "Completed", variant: "default" as const },
    processing: { icon: Loader2, label: "Processing", variant: "secondary" as const },
    pending: { icon: Clock, label: "Pending", variant: "outline" as const },
    review_required: { icon: Eye, label: "Review Required", variant: "secondary" as const },
    failed: { icon: AlertCircle, label: "Failed", variant: "destructive" as const },
  };

  const priorityConfig = {
    urgent: { color: "bg-destructive", label: "Action Required" },
    "deadline-soon": { color: "bg-amber-500", label: "Deadline Approaching" },
    normal: { color: "bg-green-500", label: "Completed" },
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
      markReviewedMutation.mutate(true);
    } else if (action === 'archive') {
      archiveMutation.mutate(true);
    } else if (action === 'assign') {
      // TODO: Show assign dialog with user selection
      toast({
        title: "Coming soon",
        description: "Team member assignment will be available soon",
      });
    } else if (action === 'email') {
      setShowEmailModal(true);
    } else if (action === 'download') {
      downloadPDFMutation.mutate();
    }
  };

  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer" 
      data-testid={`card-case-${id}`}
      onClick={() => setLocation(`/case/${id}`)}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              {priority !== "normal" && (
                <Badge className={`${priorityConfig[priority].color} text-xs px-2 py-0.5 flex-shrink-0`}>
                  {priorityConfig[priority].label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-muted-foreground">{clientName}</p>
              {(status === "pending" || status === "processing") && (
                <Badge variant={config.variant} className="gap-1">
                  <StatusIcon className="w-3 h-3" />
                  {config.label}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" data-testid={`button-actions-${id}`}>
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
                <DropdownMenuItem onClick={(e) => handleAction('email', e)} data-testid={`action-email-${id}`}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email to Client
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleAction('review', e)} data-testid={`action-review-${id}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  Mark as Reviewed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleAction('download', e)} data-testid={`action-download-${id}`}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => handleAction('assign', e)} data-testid={`action-assign-${id}`}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign to Team Member
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleAction('share', e)} data-testid={`action-share-${id}`}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleAction('archive', e)} data-testid={`action-archive-${id}`}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Case
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{meetingDate}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
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
      />

      <ShareLinkModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        caseId={id}
        caseTitle={title}
        userRole="Partner"
      />

      <EmailToClientModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        onSend={(email, message) => sendEmailMutation.mutate({ email, message })}
        isPending={sendEmailMutation.isPending}
        caseTitle={title}
        clientName={clientName}
      />
    </Card>
  );
}
