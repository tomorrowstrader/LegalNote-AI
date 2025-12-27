import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, FileSearch, CheckCircle, Lock, Unlock, AlertCircle, Edit, Save, CloudUpload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { exportToPDF, exportToWord } from "@/lib/documentExport";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { FirmProfile } from "@shared/schema";
import DownloadModal from "@/components/DownloadModal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RichTextEditor } from "@/components/RichTextEditor";
import DiarizedTranscriptViewer, { type SpeakerUtterance, type Redaction } from "@/components/DiarizedTranscriptViewer";

interface Document {
  id: string;
  caseId: string;
  type: 'attendance_note' | 'summary' | 'transcript';
  content: string;
  version: number;
  createdAt: string;
  status: 'draft' | 'approved';
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalComment?: string | null;
}

interface DocumentViewerProps {
  caseId: string;
  documents: Document[];
  transcript?: string;
  transcriptUtterances?: SpeakerUtterance[];
  speakerCount?: number;
  transcriptRedactions?: Redaction[];
  textNotes?: string;
  status: string;
  caseTitle: string;
  clientName: string;
  matterReference?: string;
  createdAt: string;
  onTranscriptTimestampClick?: (timestampMs: number) => void;
}

// Helper component for editable document content - single panel with inline editing
function EditableDocumentContent({ 
  document,
  isEditing,
  editContent,
  onEditContentChange,
  onStartEditing,
  onCancelEditing,
  onSaveEdits,
  isSaving,
  autoSaveStatus,
}: { 
  document: Document;
  isEditing: boolean;
  editContent: string;
  onEditContentChange: (value: string) => void;
  onStartEditing: (doc: Document) => void;
  onCancelEditing: () => void;
  onSaveEdits: (documentId: string) => void;
  isSaving: boolean;
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
}) {
  const isDraft = document.status === 'draft';

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {isEditing ? (
          <>
            <Button
              size="sm"
              onClick={() => onSaveEdits(document.id)}
              disabled={isSaving}
              data-testid="button-save-edits"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancelEditing}
              disabled={isSaving}
              data-testid="button-cancel-edits"
            >
              Cancel
            </Button>
            {autoSaveStatus !== 'idle' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="indicator-autosave">
                {autoSaveStatus === 'saving' && (
                  <>
                    <CloudUpload className="w-3 h-3 animate-pulse text-blue-500" />
                    <span>Auto-saving...</span>
                  </>
                )}
                {autoSaveStatus === 'saved' && (
                  <>
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">Saved</span>
                  </>
                )}
                {autoSaveStatus === 'error' && (
                  <>
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">Auto-save failed</span>
                  </>
                )}
              </div>
            )}
          </>
        ) : isDraft ? (
          <Button
            size="sm"
            variant="default"
            onClick={() => onStartEditing(document)}
            className="gap-1"
            data-testid="button-edit-document"
          >
            <Edit className="w-3 h-3" />
            Edit Document
          </Button>
        ) : null}
      </div>

      {/* Single panel: RichTextEditor handles both viewing and editing */}
      <RichTextEditor
        content={isEditing ? editContent : document.content}
        onChange={onEditContentChange}
        disabled={!isEditing}
        placeholder="Document content..."
      />
    </div>
  );
}

export default function DocumentViewer({
  caseId,
  documents,
  transcript,
  transcriptUtterances,
  speakerCount,
  transcriptRedactions,
  textNotes,
  status,
  caseTitle,
  clientName,
  matterReference,
  createdAt,
  onTranscriptTimestampClick,
}: DocumentViewerProps) {
  const { toast } = useToast();
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [lastSavedContent, setLastSavedContent] = useState<string>("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

  // Fetch firm profile for exports
  const { data: firmProfile } = useQuery<FirmProfile>({
    queryKey: ['/api/firm-profile'],
  });

  const handleExport = () => {
    setShowDownloadModal(true);
  };

  const handleDownload = async (selectedDocs: string[], format: 'pdf' | 'word') => {
    if (selectedDocs.length === 0) {
      toast({
        title: "No Documents Selected",
        description: "Please select at least one document to export",
        variant: "destructive",
        duration: 6000,
      });
      return;
    }

    try {
      const attendanceNote = documents.find(d => d.type === 'attendance_note');
      const summary = documents.find(d => d.type === 'summary');

      const content: any = {
        caseTitle,
        clientName,
        matterReference,
        createdAt,
        documentType: selectedDocs.length === 1 ? selectedDocs[0] as any : 'full_case',
        firmProfile: firmProfile || undefined,
      };

      if (selectedDocs.includes('attendance_note')) {
        if (attendanceNote?.content) {
          content.attendanceNote = attendanceNote.content;
        }
      }

      if (selectedDocs.includes('summary')) {
        const summaryContent = summary?.content || textNotes;
        if (summaryContent) {
          content.summary = summaryContent;
        }
      }

      if (selectedDocs.includes('transcript')) {
        if (transcriptContent) {
          content.transcript = transcriptContent;
        }
      }

      const hasAnyContent = content.attendanceNote || content.summary || content.transcript;
      if (!hasAnyContent) {
        toast({
          title: "No Content Available",
          description: "The selected documents don't have any content to export",
          variant: "destructive",
          duration: 6000,
        });
        setShowDownloadModal(false);
        return;
      }

      if (format === 'pdf') {
        await exportToPDF(content);
        toast({
          title: "Download Ready",
          description: "Your PDF is ready. Choose where to save it in the dialog.",
          duration: 6000,
        });
      } else {
        await exportToWord(content);
        toast({
          title: "Download Ready",
          description: "Your Word document is ready. Choose where to save it in the dialog.",
          duration: 6000,
        });
      }

      // Log export audit event
      try {
        await fetch(`/api/cases/${caseId}/audit/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ format, documents: selectedDocs }),
        });
      } catch (auditError) {
        console.error('Failed to log export audit event:', auditError);
      }

      setShowDownloadModal(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export documents. Please try again.",
        variant: "destructive",
        duration: 6000,
      });
    }
  };

  // Document approval mutations
  const approveMutation = useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      return await apiRequest('POST', `/api/documents/${documentId}/approve`, { comment: '' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
      setEditingDocId(null);
      setEditContent("");
      toast({
        title: "Document Approved",
        description: "Document has been marked as final and is now locked",
        duration: 6000,
      });
    },
    onError: () => {
      toast({
        title: "Approval Failed",
        description: "Failed to approve document. Please try again.",
        variant: "destructive",
        duration: 6000,
      });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      return await apiRequest('POST', `/api/documents/${documentId}/unlock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
      toast({
        title: "Document Unlocked",
        description: "Document returned to draft status for editing",
        duration: 6000,
      });
    },
    onError: () => {
      toast({
        title: "Unlock Failed",
        description: "Failed to unlock document. Please try again.",
        variant: "destructive",
        duration: 6000,
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ documentId, content }: { documentId: string; content: string }) => {
      console.log('[EDIT] Attempting to save document:', { documentId, contentLength: content.length, contentPreview: content.substring(0, 100) });
      
      try {
        const result = await apiRequest('PATCH', `/api/documents/${documentId}`, { content });
        console.log('[EDIT] Save successful:', result);
        return result;
      } catch (error: any) {
        console.error('[EDIT] Save failed:', {
          error,
          message: error?.message,
          body: error?.body,
          status: error?.status,
        });
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
      localStorage.removeItem(`legalnote_draft_${variables.documentId}`);
      setEditingDocId(null);
      setEditContent("");
      setLastSavedContent("");
      setAutoSaveStatus('idle');
      toast({
        title: "Document Updated",
        description: "Your changes have been saved successfully",
        duration: 3000,
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  // Redaction mutations
  const addRedactionMutation = useMutation({
    mutationFn: async ({ start, end, reason, textStart, textEnd, selectedText }: { 
      start: number; 
      end: number; 
      reason: string;
      textStart?: number;
      textEnd?: number;
      selectedText?: string;
    }) => {
      return await apiRequest('POST', `/api/cases/${caseId}/transcript/redact`, { 
        start, end, reason, textStart, textEnd, selectedText 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/transcript`] });
      toast({
        title: "Text Redacted",
        description: "The selected text has been redacted and will be hidden in exports",
        duration: 4000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Redaction Failed",
        description: error.message || "Failed to redact text. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const removeRedactionMutation = useMutation({
    mutationFn: async ({ start, end, textStart, textEnd }: { 
      start: number; 
      end: number;
      textStart?: number;
      textEnd?: number;
    }) => {
      return await apiRequest('DELETE', `/api/cases/${caseId}/transcript/redact`, { 
        start, end, textStart, textEnd 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/transcript`] });
      toast({
        title: "Redaction Removed",
        description: "The text is now visible again",
        duration: 4000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Removal Failed",
        description: error.message || "Failed to remove redaction. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const handleRedact = (redaction: { 
    start: number; 
    end: number; 
    reason: string;
    textStart?: number;
    textEnd?: number;
    selectedText?: string;
  }) => {
    addRedactionMutation.mutate(redaction);
  };

  const handleRemoveRedaction = (start: number, end: number, textStart?: number, textEnd?: number) => {
    removeRedactionMutation.mutate({ start, end, textStart, textEnd });
  };

  const DRAFT_STORAGE_KEY = `legalnote_draft_`;

  const startEditing = (document: Document) => {
    const savedDraft = localStorage.getItem(`${DRAFT_STORAGE_KEY}${document.id}`);
    const contentToLoad = savedDraft ? JSON.parse(savedDraft).content : document.content;
    
    setEditingDocId(document.id);
    setEditContent(contentToLoad);
    setLastSavedContent(document.content);
    setAutoSaveStatus('idle');

    if (savedDraft) {
      const savedData = JSON.parse(savedDraft);
      const savedTime = new Date(savedData.timestamp).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      toast({
        title: "Draft Recovered",
        description: `Unsaved changes from ${savedTime} have been restored`,
        duration: 5000,
      });
    }
  };

  const cancelEditing = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    if (editingDocId) {
      localStorage.removeItem(`${DRAFT_STORAGE_KEY}${editingDocId}`);
    }
    setEditingDocId(null);
    setEditContent("");
    setLastSavedContent("");
    setAutoSaveStatus('idle');
  };

  const saveEdits = (documentId: string) => {
    if (!editContent.trim()) {
      toast({
        title: "Invalid Content",
        description: "Document content cannot be empty",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    editMutation.mutate({ documentId, content: editContent });
  };

  const autoSaveDocument = useCallback(async (documentId: string, content: string) => {
    if (!content.trim() || content === lastSavedContent) {
      return;
    }

    setAutoSaveStatus('saving');
    try {
      await apiRequest('PATCH', `/api/documents/${documentId}`, { content });
      setLastSavedContent(content);
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('[AUTO-SAVE] Failed:', error);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus('idle'), 5000);
    }
  }, [caseId, lastSavedContent]);

  useEffect(() => {
    if (!editingDocId || !editContent) return;

    localStorage.setItem(`${DRAFT_STORAGE_KEY}${editingDocId}`, JSON.stringify({
      content: editContent,
      timestamp: new Date().toISOString(),
    }));

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveDocument(editingDocId, editContent);
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [editingDocId, editContent, autoSaveDocument, DRAFT_STORAGE_KEY]);

  const attendanceNote = documents.find(d => d.type === 'attendance_note');
  const summary = documents.find(d => d.type === 'summary');
  const transcriptDoc = documents.find(d => d.type === 'transcript');
  
  const transcriptContent = transcriptDoc?.content ?? transcript;

  // Helper component for document status and actions
  const DocumentStatusActions = ({ document }: { document?: Document }) => {
    if (!document) return null;

    const isApproved = document.status === 'approved';
    const isApproving = approveMutation.isPending;
    const isUnlocking = unlockMutation.isPending;
    const isEditing = editMutation.isPending;

    const formatApprovalDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-version">
            Version {document.version}
          </Badge>
          {isApproved ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="default" className="gap-1" data-testid="badge-status-approved">
                    <Lock className="w-3 h-3" data-testid="icon-lock" />
                    Approved
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className="font-semibold">Document Locked</p>
                    <p className="text-muted-foreground">This document is final and cannot be edited</p>
                  </div>
                </TooltipContent>
              </Tooltip>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => unlockMutation.mutate({ documentId: document.id })}
                disabled={isUnlocking}
                className="gap-1"
                data-testid="button-unlock-document"
              >
                <Unlock className="w-3 h-3" />
                Edit Final Document
              </Button>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="gap-1" data-testid="badge-status-draft">
                    <AlertCircle className="w-3 h-3" data-testid="icon-awaiting-review" />
                    Awaiting Review
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className="font-semibold">Review Required</p>
                    <p className="text-muted-foreground">This AI-generated document needs your professional review and approval</p>
                  </div>
                </TooltipContent>
              </Tooltip>
              <Button
                size="sm"
                variant="default"
                onClick={() => approveMutation.mutate({ documentId: document.id })}
                disabled={isApproving || isEditing}
                className="gap-1"
                data-testid="button-approve-document"
              >
                <CheckCircle className="w-3 h-3" />
                Mark as Final
              </Button>
            </>
          )}
        </div>
        {isApproved && document.approvedAt && (
          <div className="text-xs text-muted-foreground" data-testid="text-approval-metadata">
            Approved {formatApprovalDate(document.approvedAt)}
            {document.approvalComment && (
              <span className="ml-1">• {document.approvalComment}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const hasAnyDocument = documents.length > 0 || transcriptContent || textNotes;

  // If case is still pending and no documents, show placeholder
  if (status === 'pending' && !hasAnyDocument) {
    return (
      <div className="space-y-6" data-testid="container-document-viewer">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSearch className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Documents Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {textNotes 
                ? 'Meeting-to-Matter™ AI Engine will generate documents from your meeting notes.' 
                : 'Record audio and use Meeting-to-Matter™ AI Engine to generate legal documents automatically.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="container-document-viewer">
      <div className="sticky top-16 z-40 bg-background py-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold">Generated Documentation</h2>
            <p className="text-xs text-muted-foreground mt-1 sm:hidden">Export documents below</p>
          </div>
          {hasAnyDocument && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground hidden sm:block">Export documents:</p>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="gap-2 flex-1 sm:flex-initial"
                  data-testid="button-export"
                >
                  <FileDown className="w-4 h-4" />
                  Export Documents
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="attendance" data-testid="tab-attendance" disabled={!attendanceNote} className="text-xs sm:text-sm px-2 py-2.5 h-auto">
            <span className="hidden sm:inline">Attendance Note</span>
            <span className="sm:hidden">Att. Note</span>
          </TabsTrigger>
          <TabsTrigger value="summary" data-testid="tab-summary" disabled={!summary && !textNotes} className="text-xs sm:text-sm px-2 py-2.5 h-auto">
            Summary
          </TabsTrigger>
          <TabsTrigger value="transcript" data-testid="tab-transcript" disabled={!transcriptContent} className="text-xs sm:text-sm px-2 py-2.5 h-auto">
            <span className="hidden sm:inline">Transcript</span>
            <span className="sm:hidden">Script</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle>Attendance Note</CardTitle>
                <DocumentStatusActions document={attendanceNote} />
              </div>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              {attendanceNote ? (
                <EditableDocumentContent 
                  document={attendanceNote}
                  isEditing={editingDocId === attendanceNote.id}
                  editContent={editContent}
                  onEditContentChange={setEditContent}
                  onStartEditing={startEditing}
                  onCancelEditing={cancelEditing}
                  onSaveEdits={saveEdits}
                  isSaving={editMutation.isPending}
                  autoSaveStatus={editingDocId === attendanceNote.id ? autoSaveStatus : 'idle'}
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No attendance note available yet. Documents will be generated automatically.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle>Case Summary</CardTitle>
                <DocumentStatusActions document={summary} />
              </div>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              {summary ? (
                <EditableDocumentContent 
                  document={summary}
                  isEditing={editingDocId === summary.id}
                  editContent={editContent}
                  onEditContentChange={setEditContent}
                  onStartEditing={startEditing}
                  onCancelEditing={cancelEditing}
                  onSaveEdits={saveEdits}
                  isSaving={editMutation.isPending}
                  autoSaveStatus={editingDocId === summary.id ? autoSaveStatus : 'idle'}
                />
              ) : textNotes ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-4 italic">
                    Meeting notes (AI-generated summary will appear here once processed)
                  </p>
                  <p className="text-foreground whitespace-pre-wrap">{textNotes}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No summary available yet. Documents will be generated automatically.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle>Full Transcript</CardTitle>
                <div className="flex gap-2">
                  {transcriptUtterances && transcriptUtterances.length > 0 && (
                    <Badge variant="default" data-testid="badge-diarized">
                      Speaker Diarization
                    </Badge>
                  )}
                  <Badge variant="outline" data-testid="badge-ai-generated">AI Generated</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transcriptUtterances && transcriptUtterances.length > 0 ? (
                <DiarizedTranscriptViewer
                  utterances={transcriptUtterances}
                  speakerCount={speakerCount}
                  fallbackContent={transcriptContent}
                  onTimestampClick={onTranscriptTimestampClick}
                  redactions={transcriptRedactions}
                  onRedact={handleRedact}
                  onRemoveRedaction={handleRemoveRedaction}
                  canRedact={true}
                />
              ) : transcriptContent ? (
                <p className="text-foreground whitespace-pre-wrap">{transcriptContent}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Transcript not yet available. Process this case with AI to generate a transcript.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <DownloadModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        availableDocuments={{
          hasAttendanceNote: !!attendanceNote,
          hasSummary: !!summary || !!textNotes,
          hasTranscript: !!transcriptContent,
        }}
        sharedDocuments={['attendance_note', 'summary', 'transcript']}
        onDownload={handleDownload}
      />
    </div>
  );
}
