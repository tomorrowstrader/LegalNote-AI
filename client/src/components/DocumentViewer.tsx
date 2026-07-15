import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, FileSearch, FileText, CheckCircle, Lock, Unlock, AlertCircle, Edit, Save, CloudUpload, Shield, ZoomIn, ZoomOut, Maximize2, Minimize2, Printer, MessageSquare, MessageSquarePlus, Check, Eye, EyeOff, X, GitCompareArrows, ChevronDown, ChevronUp, Mail, MailCheck, BookOpen, Pencil, AlertTriangle, PenLine } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToPDF, exportToWord } from "@/lib/documentExport";
import { extractLetterhead, formatLetterheadAddress } from "@shared/letterhead";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { FirmProfile, DocumentComment } from "@shared/schema";
import { RECORDING_TYPE_LABELS, type RecordingType } from "@shared/schema";
import DownloadModal from "@/components/DownloadModal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { RichTextEditor, type TrackedChange, type TrackChangeAuditRecord } from "@/components/RichTextEditor";
import { PageView } from "@/components/PageView";
import DiarizedTranscriptViewer, { type SpeakerUtterance, type Redaction } from "@/components/DiarizedTranscriptViewer";
import { debugClientLog } from "@/lib/debugClientLog";

function markdownToPlainText(md: string): string {
  if (!md) return '';
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\|.*\|$/gm, (line) => {
      if (/^[\s|:-]+$/.test(line)) return '';
      return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()).join('  ');
    })
    .replace(/^[-*+]\s+/gm, '  ')
    .replace(/^\d+\.\s+/gm, '  ')
    .replace(/^>\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\\\\/g, '')
    .replace(/\\([#*_~`|>])/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import DiffMatchPatch from 'diff-match-patch';

interface DocumentVersion {
  id: string;
  version: number;
  versionType: string;
  content: string;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
  status: string;
  wordCount: number;
}

function VersionDiffViewer({
  caseId,
  documentType,
  onClose,
}: {
  caseId: string;
  documentType: string;
  onClose: () => void;
}) {
  const [leftVersion, setLeftVersion] = useState<string>('');
  const [rightVersion, setRightVersion] = useState<string>('');

  const { data: versions = [], isLoading } = useQuery<DocumentVersion[]>({
    queryKey: ['/api/cases', caseId, 'document-versions', documentType],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/document-versions/${documentType}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (versions.length >= 2 && !leftVersion && !rightVersion) {
      setLeftVersion(versions[versions.length - 2].id);
      setRightVersion(versions[versions.length - 1].id);
    } else if (versions.length === 1 && !rightVersion) {
      setRightVersion(versions[0].id);
    }
  }, [versions, leftVersion, rightVersion]);

  const diffHtml = useMemo(() => {
    const left = versions.find(v => v.id === leftVersion);
    const right = versions.find(v => v.id === rightVersion);
    if (!left || !right) return '';

    const dmp = new DiffMatchPatch();
    const leftText = markdownToPlainText(left.content);
    const rightText = markdownToPlainText(right.content);
    const diffs = dmp.diff_main(leftText, rightText);
    dmp.diff_cleanupSemantic(diffs);

    return diffs.map(([op, text]: [number, string]) => {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
      if (op === 1) {
        return `<span class="diff-added">${escaped}</span>`;
      } else if (op === -1) {
        return `<span class="diff-removed">${escaped}</span>`;
      }
      return escaped;
    }).join('');
  }, [versions, leftVersion, rightVersion]);

  const leftVer = versions.find(v => v.id === leftVersion);
  const rightVer = versions.find(v => v.id === rightVersion);
  const wordCountDiff = leftVer && rightVer ? rightVer.wordCount - leftVer.wordCount : 0;

  const formatVersionLabel = (v: DocumentVersion) => {
    const date = new Date(v.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const typeLabel = v.versionType === 'ai_generated' ? 'Generated' : v.versionType === 'ai_regenerated' ? 'Regenerated' : 'Edited';
    return `v${v.version} · ${typeLabel} · ${date}`;
  };

  if (isLoading) {
    return (
      <Card data-testid="panel-version-diff">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading versions...
        </CardContent>
      </Card>
    );
  }

  if (versions.length < 2) {
    return (
      <Card data-testid="panel-version-diff">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Compare Versions</CardTitle>
            <Button size="sm" variant="ghost" onClick={onClose} data-testid="button-close-diff">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground italic text-center py-6">
          At least two versions are needed to compare. Edit the document to create additional versions.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="panel-version-diff">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompareArrows className="w-4 h-4" />
            Compare Versions
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={onClose} data-testid="button-close-diff">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 min-w-0">
            <label className="text-xs text-muted-foreground mb-1 block">From (older)</label>
            <Select value={leftVersion} onValueChange={setLeftVersion}>
              <SelectTrigger data-testid="select-left-version" className="text-xs">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id} data-testid={`option-left-v${v.version}`}>
                    {formatVersionLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-muted-foreground text-sm hidden sm:block pt-4">vs</span>
          <div className="flex-1 min-w-0">
            <label className="text-xs text-muted-foreground mb-1 block">To (newer)</label>
            <Select value={rightVersion} onValueChange={setRightVersion}>
              <SelectTrigger data-testid="select-right-version" className="text-xs">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id} data-testid={`option-right-v${v.version}`}>
                    {formatVersionLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {leftVer && rightVer && (
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <span>v{leftVer.version} ({leftVer.wordCount} words)</span>
            <span>→</span>
            <span>v{rightVer.version} ({rightVer.wordCount} words)</span>
            <Badge variant="outline" className="text-xs" data-testid="badge-word-count-diff">
              {wordCountDiff > 0 ? `+${wordCountDiff}` : wordCountDiff} words
            </Badge>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700" />
            <span className="text-muted-foreground">Added</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700" />
            <span className="text-muted-foreground">Removed</span>
          </div>
        </div>

        <div className="border border-border rounded-md p-4 max-h-[500px] overflow-auto">
          <div
            className="prose prose-sm max-w-none text-sm leading-relaxed version-diff-content"
            dangerouslySetInnerHTML={{ __html: diffHtml }}
            data-testid="container-diff-output"
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Version History</p>
          <div className="space-y-1">
            {versions.map(v => (
              <div
                key={v.id}
                className={`flex items-center justify-between gap-2 text-xs p-2 rounded-md ${
                  v.id === leftVersion || v.id === rightVersion ? 'bg-muted/50' : ''
                }`}
                data-testid={`version-entry-${v.version}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={v.isActive ? 'default' : 'outline'} className="text-[10px]">
                    v{v.version}
                  </Badge>
                  <span className="text-muted-foreground">
                    {v.versionType === 'ai_generated' ? 'Produced' : v.versionType === 'ai_regenerated' ? 'Revised' : 'Manually Edited'}
                  </span>
                  {v.isActive && <Badge variant="outline" className="text-[10px]">Current</Badge>}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{v.wordCount} words</span>
                  <span>{new Date(v.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Document {
  id: string;
  caseId: string;
  type: 'attendance_note' | 'meeting_notes' | 'summary' | 'transcript' | 'client_care_letter';
  content: string;
  version: number;
  createdAt: string;
  status: 'draft' | 'approved';
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalComment?: string | null;
  meetingSessionId?: string | null;
  verificationWarnings?: string[] | null;
  solicitorReasoningNote?: string | null;
  reasoningGapsReviewed?: boolean | null;
  reasoningGapsIdentified?: number | null;
  reasoningGapsFilled?: number | null;
}

interface SessionInfo {
  id: string;
  sessionTitle: string | null;
  recordingType: string;
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
  initialTab?: 'attendance' | 'summary' | 'transcript';
  initialTimestamp?: number;
  sessions?: SessionInfo[];
  focusSessionId?: string | null;
  hasAmlFlag?: boolean;
  litigationHold?: boolean;
}

function parseReasoningGaps(content: string | null | undefined): string[] {
  if (!content) return [];
  const regex = /<!--\s*REASONING_GAP:\s*(.+?)\s*-->/g;
  const gaps: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    gaps.push(match[1].trim());
  }
  return gaps;
}

/** Strip gap HTML comments for display — do not inject markdown (breaks TipTap in production). */
function stripReasoningGapMarkers(content: string | null | undefined): string {
  if (!content) return '';
  return content.replace(/<!--\s*REASONING_GAP:\s*.+?\s*-->/g, '');
}

function findElementContainingText(root: ParentNode, text: string): HTMLElement | null {
  if (!text) return null;
  const needle = text.trim().toLowerCase();
  if (!needle) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent?.toLowerCase().includes(needle)) {
      return (node.parentElement as HTMLElement | null);
    }
  }
  return null;
}

function scrollToReasoningGap(sectionName: string) {
  // Markers are stripped from the view, so jump to the related section heading / label text.
  const primary = sectionName.split(':')[0]?.trim() || sectionName;
  const candidates = [primary, sectionName].filter(Boolean);
  const roots = document.querySelectorAll(".ProseMirror, .page-view-content, [data-testid='attendance-note-card']");
  let el: HTMLElement | null = null;
  for (const candidate of candidates) {
    for (const root of Array.from(roots)) {
      el = findElementContainingText(root, candidate);
      if (el) break;
    }
    if (el) break;
  }
  if (!el) {
    for (const candidate of candidates) {
      el = findElementContainingText(document.body, candidate);
      if (el) break;
    }
  }
  if (!el) return;

  const target = el.closest("p, li, h1, h2, h3, h4, h5, blockquote, div") as HTMLElement | null ?? el;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add(
    "ring-2",
    "ring-amber-500",
    "ring-offset-2",
    "dark:ring-offset-background",
    "bg-amber-50",
    "dark:bg-amber-950/40",
    "rounded-sm",
    "transition-shadow",
    "duration-300",
  );
  window.setTimeout(() => {
    target.classList.remove(
      "ring-2",
      "ring-amber-500",
      "ring-offset-2",
      "dark:ring-offset-background",
      "bg-amber-50",
      "dark:bg-amber-950/40",
      "rounded-sm",
      "transition-shadow",
      "duration-300",
    );
  }, 2200);
}

// Replace the nth (0-indexed) occurrence of any REASONING_GAP marker with the given text.
// Works even when multiple markers share the same section name.
function replaceMarkerAtIndex(content: string, targetIdx: number, replacement: string): string {
  const markerRegex = /<!--\s*REASONING_GAP:\s*.+?\s*-->/g;
  let count = 0;
  let result = '';
  let lastIndex = 0;
  let match;
  while ((match = markerRegex.exec(content)) !== null) {
    if (count === targetIdx) {
      result += content.slice(lastIndex, match.index) + replacement;
      lastIndex = match.index + match[0].length;
      result += content.slice(lastIndex);
      return result;
    }
    count++;
  }
  return content;
}

function CommentsPanel({ 
  documentId,
  comments,
  showResolved,
  onToggleResolved,
  onResolve,
  onDelete,
  onHighlightText,
  highlightedCommentId,
}: {
  documentId: string;
  comments: DocumentComment[];
  showResolved: boolean;
  onToggleResolved: () => void;
  onResolve: (commentId: string, resolved: boolean) => void;
  onDelete: (commentId: string) => void;
  onHighlightText: (selectedText: string, commentId: string) => void;
  highlightedCommentId: string | null;
}) {
  const filteredComments = showResolved ? comments : comments.filter(c => !c.resolved);
  const activeCount = comments.filter(c => !c.resolved).length;
  const resolvedCount = comments.filter(c => c.resolved).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{activeCount} comment{activeCount !== 1 ? 's' : ''}</span>
          {resolvedCount > 0 && (
            <Badge variant="outline" className="text-xs">{resolvedCount} resolved</Badge>
          )}
        </div>
        {resolvedCount > 0 && (
          <Button size="sm" variant="ghost" onClick={onToggleResolved} className="gap-1 text-xs" data-testid="button-toggle-resolved">
            {showResolved ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showResolved ? 'Hide resolved' : 'Show resolved'}
          </Button>
        )}
      </div>

      {filteredComments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-4 text-center">
          {comments.length === 0 ? 'No comments yet. Select text in the document and click "Add Comment" to get started.' : 'All comments resolved.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredComments.map(comment => (
            <Card 
              key={comment.id}
              className={`cursor-pointer transition-colors ${highlightedCommentId === comment.id ? 'ring-2 ring-primary' : ''} ${comment.resolved ? 'opacity-60' : ''}`}
              onClick={() => onHighlightText(comment.selectedText, comment.id)}
              data-testid={`comment-card-${comment.id}`}
            >
              <CardContent className="p-3 space-y-2">
                <div className="text-xs bg-muted/50 rounded px-2 py-1 font-mono truncate" data-testid={`comment-anchor-${comment.id}`}>
                  "{comment.selectedText.length > 80 ? comment.selectedText.substring(0, 80) + '...' : comment.selectedText}"
                </div>
                <p className="text-sm" data-testid={`comment-text-${comment.id}`}>{comment.commentText}</p>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={(e) => { e.stopPropagation(); onResolve(comment.id, !comment.resolved); }}
                          data-testid={`button-resolve-${comment.id}`}
                        >
                          <Check className={`w-3.5 h-3.5 ${comment.resolved ? 'text-green-500' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{comment.resolved ? 'Reopen' : 'Resolve'}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={(e) => { e.stopPropagation(); onDelete(comment.id); }}
                          data-testid={`button-delete-comment-${comment.id}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LetterheadPreview({ firmProfile }: { firmProfile?: FirmProfile | null }) {
  const lh = extractLetterhead(firmProfile);
  if (!lh) return null;
  const addressLines = formatLetterheadAddress(lh);
  return (
    <div className="mb-4 px-6 pt-6 pb-4 border-b border-border" data-testid="letterhead-preview">
      {lh.logoUrl && (
        <img
          src={lh.logoUrl}
          alt={`${lh.firmName} logo`}
          className="h-10 mb-3 object-contain object-left"
          data-testid="letterhead-logo"
        />
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <p className="text-base font-bold text-foreground leading-tight" data-testid="letterhead-firm-name">{lh.firmName}</p>
          {addressLines.map((line, i) => (
            <p key={i} className="text-xs text-muted-foreground">{line}</p>
          ))}
        </div>
        <div className="text-xs text-muted-foreground sm:text-right space-y-0.5">
          {lh.phone && <p data-testid="letterhead-phone">Tel: {lh.phone}</p>}
          {lh.email && <p data-testid="letterhead-email">Email: {lh.email}</p>}
          {lh.website && <p data-testid="letterhead-website">{lh.website}</p>}
          {lh.sraNumber && (
            <p className="font-medium" data-testid="letterhead-sra">SRA No: {lh.sraNumber}</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
  zoom,
  focusMode,
  onFocusModeToggle,
  onAddComment,
  trackChangesEnabled,
  onTrackChangesToggle,
  onTrackChangeAction,
  onRedact,
  legalContext,
  pageViewMode,
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
  zoom?: number;
  focusMode?: boolean;
  onFocusModeToggle?: () => void;
  onAddComment?: (selectedText: string) => void;
  trackChangesEnabled?: boolean;
  onTrackChangesToggle?: (enabled: boolean) => void;
  onTrackChangeAction?: (action: 'accept' | 'reject' | 'accept_all' | 'reject_all', changes: TrackChangeAuditRecord[]) => void;
  onRedact?: (redactedText: string) => void;
  legalContext?: { clientName?: string; matterRef?: string; solicitorName?: string; firmName?: string };
  pageViewMode?: boolean;
}) {
  const isDraft = document.status === 'draft';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap px-6">
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

      {/* Page View: accurate multi-page layout renderer */}
      {pageViewMode && !isEditing ? (
        <PageView content={stripReasoningGapMarkers(document.content)} legalContext={legalContext} />
      ) : (
        <RichTextEditor
          content={isEditing ? editContent : stripReasoningGapMarkers(document.content)}
          onChange={onEditContentChange}
          disabled={!isEditing}
          placeholder="Document content..."
          zoom={zoom}
          focusMode={focusMode}
          onFocusModeToggle={onFocusModeToggle}
          onAddComment={onAddComment}
          trackChangesEnabled={isEditing ? trackChangesEnabled : false}
          onTrackChangesToggle={isEditing ? onTrackChangesToggle : undefined}
          onTrackChangeAction={isEditing ? onTrackChangeAction : undefined}
          onRedact={isEditing ? onRedact : undefined}
          legalContext={legalContext}
        />
      )}
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
  initialTab,
  initialTimestamp,
  sessions,
  focusSessionId,
  hasAmlFlag,
  litigationHold,
}: DocumentViewerProps) {
  const { toast } = useToast();

  // #region agent log
  useEffect(() => {
    const docs = documents || [];
    debugClientLog({
      location: "DocumentViewer.tsx:mount",
      message: "DocumentViewer mounted",
      hypothesisId: "B",
      data: {
        caseId,
        docCount: docs.length,
        types: docs.map((d: any) => d?.type),
        contentLens: docs.map((d: any) => (d?.content == null ? -1 : String(d.content).length)),
        pageW: typeof window !== "undefined" ? window.innerWidth : 0,
      },
    });
  }, [caseId, documents]);
  // #endregion

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [pageViewMode, setPageViewMode] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const editContentRef = useRef<string>("");
  const [lastSavedContent, setLastSavedContent] = useState<string>("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dismissedReviewBanners, setDismissedReviewBanners] = useState<Set<string>>(new Set());
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editingDocIdRef = useRef<string | null>(null);
  const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
  
  const [trackChangesEnabled, setTrackChangesEnabled] = useState(false);
  
  const [showVersionDiff, setShowVersionDiff] = useState<string | null>(null);
  
  const [showComments, setShowComments] = useState(false);
  const [showResolvedComments, setShowResolvedComments] = useState(false);
  const [commentDocId, setCommentDocId] = useState<string | null>(null);
  const [addCommentText, setAddCommentText] = useState('');
  const [addCommentSelectedText, setAddCommentSelectedText] = useState('');
  const [showAddCommentForm, setShowAddCommentForm] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // Demo mode: compliance signals are hidden when viewing the public demo path
  const isDemoMode = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo/');

  // Reasoning gap state
  const [showGapPanel, setShowGapPanel] = useState<string | null>(null); // document ID
  const [gapInputs, setGapInputs] = useState<Record<string, Record<string, string>>>({}); // docId -> sectionName -> text
  const [reasoningNoteInputs, setReasoningNoteInputs] = useState<Record<string, string>>({}); // docId -> note text
  const [showRationaleSection, setShowRationaleSection] = useState<Record<string, boolean>>({}); // docId -> expanded
  const [pendingApprovalDocId, setPendingApprovalDocId] = useState<string | null>(null); // doc waiting for soft gate confirm
  const [amlAcknowledged, setAmlAcknowledged] = useState<Record<string, boolean>>({}); // docId -> confirmed AML consideration
  
  // Controlled tab state with support for initial tab from URL
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'attendance');
  
  // Update tab when initialTab changes (e.g., from search navigation)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const { data: firmProfile } = useQuery<FirmProfile>({
    queryKey: ['/api/firm-profile'],
  });

  const hasMeetingNotesDoc = !documents.some(d => d.type === 'attendance_note') && documents.some(d => d.type === 'meeting_notes');
  const activeDocForComments = commentDocId || documents.find(d => d.type === (activeTab === 'summary' ? 'summary' : hasMeetingNotesDoc ? 'meeting_notes' : 'attendance_note'))?.id;
  
  const { data: commentsData = [] } = useQuery<DocumentComment[]>({
    queryKey: ['/api/documents', activeDocForComments, 'comments'],
    queryFn: async () => {
      if (!activeDocForComments) return [];
      const res = await fetch(`/api/documents/${activeDocForComments}/comments`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeDocForComments,
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ documentId, selectedText, commentText }: { documentId: string; selectedText: string; commentText: string }) => {
      return await apiRequest('POST', `/api/documents/${documentId}/comments`, { selectedText, commentText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', activeDocForComments, 'comments'] });
      setShowAddCommentForm(false);
      setAddCommentText('');
      setAddCommentSelectedText('');
      toast({ title: "Comment Added", description: "Your comment has been saved", duration: 3000 });
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not add comment", variant: "destructive", duration: 5000 });
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: async ({ documentId, commentId, resolved }: { documentId: string; commentId: string; resolved: boolean }) => {
      return await apiRequest('PATCH', `/api/documents/${documentId}/comments/${commentId}`, { resolved });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', activeDocForComments, 'comments'] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ documentId, commentId }: { documentId: string; commentId: string }) => {
      return await apiRequest('DELETE', `/api/documents/${documentId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', activeDocForComments, 'comments'] });
      toast({ title: "Comment Deleted", duration: 3000 });
    },
  });

  const handleAddComment = useCallback((selectedText: string) => {
    if (!selectedText.trim()) return;
    setAddCommentSelectedText(selectedText);
    setShowAddCommentForm(true);
    setShowComments(true);
  }, []);

  const handleSubmitComment = useCallback(() => {
    if (!activeDocForComments || !addCommentText.trim() || !addCommentSelectedText.trim()) return;
    addCommentMutation.mutate({ documentId: activeDocForComments, selectedText: addCommentSelectedText, commentText: addCommentText });
  }, [activeDocForComments, addCommentText, addCommentSelectedText, addCommentMutation]);

  const handleResolveComment = useCallback((commentId: string, resolved: boolean) => {
    if (!activeDocForComments) return;
    resolveCommentMutation.mutate({ documentId: activeDocForComments, commentId, resolved });
  }, [activeDocForComments, resolveCommentMutation]);

  const handleDeleteComment = useCallback((commentId: string) => {
    if (!activeDocForComments) return;
    deleteCommentMutation.mutate({ documentId: activeDocForComments, commentId });
  }, [activeDocForComments, deleteCommentMutation]);

  const handleHighlightText = useCallback((_selectedText: string, commentId: string) => {
    setHighlightedCommentId(prev => prev === commentId ? null : commentId);
  }, []);

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
      const attendanceNote = documents.find(d => d.type === 'attendance_note') ?? documents.find(d => d.type === 'meeting_notes');
      const summary = documents.find(d => d.type === 'summary');

      const exportingAttendance = selectedDocs.includes('attendance_note') || selectedDocs.includes('meeting_notes');
      const exportingSummary = selectedDocs.includes('summary');
      const primaryDoc = exportingAttendance ? attendanceNote : exportingSummary ? summary : undefined;
      // Only include solicitorReasoningNote for attendance note or summary exports — never leak into transcript/client-care-letter exports
      const exportReasoningNote = exportingAttendance
        ? (attendanceNote?.solicitorReasoningNote ?? null)
        : exportingSummary
        ? (summary?.solicitorReasoningNote ?? null)
        : null;
      const content: any = {
        caseTitle,
        clientName,
        matterReference,
        createdAt,
        documentType: selectedDocs.length === 1 ? selectedDocs[0] as any : 'full_case',
        firmProfile: firmProfile || undefined,
        documentId: primaryDoc?.id,
        solicitorReasoningNote: exportReasoningNote,
      };

      if (selectedDocs.includes('attendance_note') || selectedDocs.includes('meeting_notes')) {
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

      if (selectedDocs.includes('client_care_letter')) {
        if (clientCareLetter?.content) {
          content.clientCareLetter = clientCareLetter.content;
        }
      }

      if (selectedDocs.includes('transcript')) {
        if (transcriptContent) {
          content.transcript = transcriptContent;
        }
      }

      const hasAnyContent = content.attendanceNote || content.summary || content.clientCareLetter || content.transcript;
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
    mutationFn: async ({ documentId, reasoningGapsReviewed }: { documentId: string; reasoningGapsReviewed?: boolean }) => {
      return await apiRequest('POST', `/api/documents/${documentId}/approve`, { comment: '', reasoningGapsReviewed: reasoningGapsReviewed ?? false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
      setEditingDocId(null);
      setEditContent("");
      setPendingApprovalDocId(null);
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

  // Reasoning note mutation
  const updateReasoningNoteMutation = useMutation({
    mutationFn: async ({ documentId, note }: { documentId: string; note: string | null }) => {
      return await apiRequest('PATCH', `/api/documents/${documentId}/reasoning-note`, { note });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
      toast({ title: "Rationale Saved", description: "Your reasoning note has been saved", duration: 3000 });
    },
    onError: () => {
      toast({ title: "Save Failed", description: "Could not save reasoning note", variant: "destructive", duration: 5000 });
    },
  });

  // Gap content update mutation (replaces gap markers with solicitor text, keyed by marker index)
  const saveGapMutation = useMutation({
    mutationFn: async ({ documentId, gaps, amlConfirmed }: { documentId: string; gaps: Record<string, string>; amlConfirmed?: boolean }) => {
      const doc = documents.find(d => d.id === documentId);
      if (!doc) throw new Error('Document not found');
      const gapsBefore = parseReasoningGaps(doc.content);
      let updatedContent = doc.content;
      let filledCount = 0;
      // Sort descending by index so earlier markers aren't displaced when replacing later ones
      const sortedEntries = Object.entries(gaps)
        .filter(([, text]) => text.trim())
        .map(([idxStr, text]) => ({ idx: parseInt(idxStr, 10), text: text.trim() }))
        .sort((a, b) => b.idx - a.idx);
      for (const { idx, text } of sortedEntries) {
        const replaced = replaceMarkerAtIndex(updatedContent, idx, text);
        if (replaced !== updatedContent) {
          updatedContent = replaced;
          filledCount++;
        }
      }
      const remainingGaps = parseReasoningGaps(updatedContent);
      // Cumulative metrics: preserve original identified count; increment total filled
      const identifiedCount = doc.reasoningGapsIdentified ?? gapsBefore.length;
      const totalFilled = (doc.reasoningGapsFilled ?? 0) + filledCount;
      await apiRequest('PATCH', `/api/documents/${documentId}`, { content: updatedContent });
      await apiRequest('PATCH', `/api/documents/${documentId}/reasoning-note`, {
        note: doc.solicitorReasoningNote ?? null,
        reasoningGapsIdentified: identifiedCount,
        reasoningGapsFilled: totalFilled,
        ...(amlConfirmed !== undefined ? { amlConfirmed } : {}),
      });
      return { remainingGaps };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
      const { remainingGaps } = data;
      if (remainingGaps.length === 0) {
        setShowGapPanel(null);
        toast({ title: "All gaps resolved", description: "Reasoning gaps have been filled", duration: 3000 });
      } else {
        toast({ title: "Gaps updated", description: `${remainingGaps.length} gap(s) remain`, duration: 3000 });
      }
      setGapInputs(prev => ({ ...prev, [variables.documentId]: {} }));
    },
    onError: () => {
      toast({ title: "Save Failed", description: "Could not save reasoning gaps", variant: "destructive", duration: 5000 });
    },
  });

  const requestAcknowledgementMutation = useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      return await apiRequest('POST', `/api/documents/${documentId}/request-acknowledgement`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
      toast({
        title: "Acknowledgement request sent",
        description: `An email has been sent to ${data.sentTo || 'the client'} with a secure link to read and acknowledge the letter.`,
        duration: 8000,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to send request",
        description: err.message || "Could not send the acknowledgement request. Check that the client record has an email address.",
        variant: "destructive",
        duration: 8000,
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
      console.log('[EDIT] Attempting to save document:', { documentId, contentLength: content.length });
      
      try {
        const result = await apiRequest('PATCH', `/api/documents/${documentId}`, { content });
        console.log('[EDIT] Save successful:', { documentId });
        return result;
      } catch (error: any) {
        console.error('[EDIT] Save failed:', {
          message: error?.message,
          status: error?.status,
        });
        throw error;
      }
    },
    onSuccess: async (updatedDocument, variables) => {
      queryClient.setQueryData(
        [`/api/cases/${caseId}/documents`],
        (oldDocs: Document[] | undefined) => {
          if (!oldDocs) return oldDocs;
          return oldDocs.map((doc) =>
            doc.id === variables.documentId ? { ...doc, ...(updatedDocument as Document) } : doc
          );
        }
      );

      localStorage.removeItem(`legalnote_draft_${variables.documentId}`);
      setEditingDocId(null);
      editingDocIdRef.current = null;
      editContentRef.current = "";
      setEditContent("");
      setLastSavedContent("");
      setAutoSaveStatus('idle');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] }),
      ]);

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

  const [pendingRedactionData, setPendingRedactionData] = useState<{
    start: number;
    end: number;
    textStart?: number;
    textEnd?: number;
    selectedText?: string;
  } | null>(null);
  const [redactionReasonType, setRedactionReasonType] = useState<string>('redaction_gdpr');
  const [redactionReasonNotes, setRedactionReasonNotes] = useState<string>('');
  const [permanenceConfirmed, setPermanenceConfirmed] = useState(false);

  // Redaction mutations
  const addRedactionMutation = useMutation({
    mutationFn: async ({ start, end, textStart, textEnd, selectedText, reasonType, reasonNotes }: {
      start: number;
      end: number;
      textStart?: number;
      textEnd?: number;
      selectedText?: string;
      reasonType: string;
      reasonNotes?: string;
    }) => {
      return await apiRequest('POST', `/api/cases/${caseId}/transcript/redact`, {
        start, end, textStart, textEnd, selectedText, reasonType, reasonNotes
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
      const message = error.message || "Failed to redact text. Please try again.";
      const isLitigationHold = message.includes('litigation hold');
      toast({
        title: isLitigationHold ? "Matter Under Litigation Hold" : "Redaction Failed",
        description: message,
        variant: "destructive",
        duration: isLitigationHold ? 8000 : 5000,
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
      const message = error.message || "Failed to remove redaction. Please try again.";
      const isLitigationHold = message.includes('litigation hold');
      toast({
        title: isLitigationHold ? "Matter Under Litigation Hold" : "Removal Failed",
        description: message,
        variant: "destructive",
        duration: isLitigationHold ? 8000 : 5000,
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
    const { reason: _reason, ...data } = redaction;
    setPendingRedactionData(data);
    setRedactionReasonType('redaction_gdpr');
    setPermanenceConfirmed(false);
    setRedactionReasonNotes('');
  };

  const confirmRedaction = () => {
    const isPermanent = redactionReasonType !== 'redaction_privilege';
    if (isPermanent && !permanenceConfirmed) return;
    if (!pendingRedactionData) return;
    addRedactionMutation.mutate({
      ...pendingRedactionData,
      reason: '',
      reasonType: redactionReasonType,
      reasonNotes: redactionReasonNotes.trim() || undefined,
    });
    setPendingRedactionData(null);
    setRedactionReasonType('redaction_gdpr');
    setRedactionReasonNotes('');
  };

  const handleRemoveRedaction = (start: number, end: number, textStart?: number, textEnd?: number) => {
    removeRedactionMutation.mutate({ start, end, textStart, textEnd });
  };

  const DRAFT_STORAGE_KEY = `legalnote_draft_`;

  const startEditing = (document: Document) => {
    const savedDraft = localStorage.getItem(`${DRAFT_STORAGE_KEY}${document.id}`);
    const contentToLoad = savedDraft ? JSON.parse(savedDraft).content : document.content;
    
    setEditingDocId(document.id);
    editingDocIdRef.current = document.id;
    editContentRef.current = contentToLoad;
    setEditContent(contentToLoad);
    setLastSavedContent(document.content);
    setAutoSaveStatus('idle');
    setTrackChangesEnabled(true);

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
      autoSaveTimeoutRef.current = null;
    }
    if (editingDocId) {
      localStorage.removeItem(`${DRAFT_STORAGE_KEY}${editingDocId}`);
    }
    setEditingDocId(null);
    editingDocIdRef.current = null;
    editContentRef.current = "";
    setEditContent("");
    setLastSavedContent("");
    setAutoSaveStatus('idle');
    setTrackChangesEnabled(false);
  };

  const handleTrackChangeAction = useCallback((action: 'accept' | 'reject' | 'accept_all' | 'reject_all', changes: TrackChangeAuditRecord[]) => {
    if (!changes.length) return;
    try {
      fetch(`/api/cases/${caseId}/audit/track-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          documentId: editingDocIdRef.current,
          changes,
        }),
      });
    } catch (auditError) {
      console.error('Failed to log track change audit event:', auditError);
    }
  }, [caseId]);

  const handleEditContentChange = useCallback((value: string) => {
    editContentRef.current = value;
    setEditContent(value);
  }, []);

  const handleDocumentRedact = useCallback((redactedText: string) => {
    try {
      fetch(`/api/cases/${caseId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventType: 'document_redacted', redactedText: redactedText.substring(0, 100) }),
      });
    } catch (auditError) {
      console.error('Failed to log redaction audit event:', auditError);
    }
  }, [caseId]);

  const saveEdits = (documentId: string) => {
    const contentToSave = editContentRef.current || editContent;
    if (!contentToSave.trim()) {
      toast({
        title: "Invalid Content",
        description: "Document content cannot be empty",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    editMutation.mutate({ documentId, content: contentToSave });
  };

  const autoSaveDocument = useCallback(async (documentId: string, content: string) => {
    if (!content.trim() || content === lastSavedContent) {
      return;
    }

    if (editingDocIdRef.current !== documentId) {
      return;
    }

    setAutoSaveStatus('saving');
    try {
      await apiRequest('PATCH', `/api/documents/${documentId}`, { content, silent: true });

      if (editingDocIdRef.current !== documentId) {
        return;
      }

      setLastSavedContent(content);
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('[AUTO-SAVE] Failed:', error);
      if (editingDocIdRef.current === documentId) {
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus('idle'), 5000);
      }
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

  // When focusSessionId is set, prefer the document tied to that session; fall back to latest
  const findDoc = (type: Document['type']) => {
    if (focusSessionId) {
      return documents.find(d => d.type === type && d.meetingSessionId === focusSessionId)
        ?? documents.find(d => d.type === type);
    }
    return documents.find(d => d.type === type);
  };

  const attendanceNote = findDoc('attendance_note') ?? findDoc('meeting_notes');
  const isMeetingNotes = !findDoc('attendance_note') && !!findDoc('meeting_notes');
  const summary = findDoc('summary');
  const transcriptDoc = findDoc('transcript');
  const clientCareLetter = findDoc('client_care_letter');

  const getSessionLabel = (doc: Document | undefined): string | null => {
    if (!doc?.meetingSessionId || !sessions || sessions.length === 0) return null;
    const session = sessions.find(s => s.id === doc.meetingSessionId);
    if (!session) return null;
    return session.sessionTitle || RECORDING_TYPE_LABELS[session.recordingType as RecordingType] || session.recordingType;
  };

  const attendanceNoteSessionLabel = getSessionLabel(attendanceNote);
  const summarySessionLabel = getSessionLabel(summary);
  
  const transcriptContent = transcriptDoc?.content ?? transcript;

  // Collapsible verification warning panel — collapsed by default
  const VerificationWarningPanel = ({ warnings, testIdPrefix }: { warnings: string[]; testIdPrefix: string }) => {
    const [expanded, setExpanded] = useState(false);
    const count = warnings.length;
    return (
      <div className="mx-6 mb-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md" data-testid={`panel-verification-warning-${testIdPrefix}`}>
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Solicitor Review Required</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
              {count} statement{count !== 1 ? 's' : ''} could not be directly traced to the transcript.{' '}
              <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="underline hover:no-underline"
                data-testid={`button-toggle-verification-warnings-${testIdPrefix}`}
              >
                {expanded ? 'Hide details' : 'Show details'}
              </button>
            </p>
            {expanded && (
              <ul className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 list-disc pl-4 space-y-0.5">
                {warnings.map((w: string, i: number) => (
                  <li key={i} data-testid={`text-verification-warning-${testIdPrefix}-${i}`}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Helper component for document status and actions
  const DocumentStatusActions = ({ document }: { document?: Document }) => {
    if (!document) return null;

    const isApproved = document.status === 'approved';
    const isApproving = approveMutation.isPending;
    const isUnlocking = unlockMutation.isPending;
    const isEditing = editMutation.isPending;
    const docGaps = parseReasoningGaps(document.content);
    const gapCount = docGaps.length;
    const isGapPanelOpen = showGapPanel === document.id;

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

    const handleApproveClick = () => {
      if (gapCount > 0) {
        setPendingApprovalDocId(document.id);
      } else {
        // reviewed=true only when solicitor previously filled reasoning gaps (went through review panel)
        const wasReviewed = (document.reasoningGapsFilled ?? 0) > 0;
        approveMutation.mutate({ documentId: document.id, reasoningGapsReviewed: wasReviewed });
      }
    };

    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-version">
            Version {document.version}
          </Badge>
          {document.version > 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowVersionDiff(prev => prev === document.type ? null : document.type)}
                  className="gap-1"
                  data-testid="button-compare-versions"
                >
                  <GitCompareArrows className="w-3 h-3" />
                  Compare Versions
                </Button>
              </TooltipTrigger>
              <TooltipContent>Compare different versions of this document</TooltipContent>
            </Tooltip>
          )}
          {/* Gap indicator — hidden in demo mode */}
          {gapCount > 0 && !isDemoMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowGapPanel(prev => prev === document.id ? null : document.id)}
                  className={cn(
                    "gap-1.5 border-amber-500/70 bg-amber-50 text-amber-800 shadow-sm",
                    "hover:bg-amber-100 hover:text-amber-900",
                    "dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-600 dark:hover:bg-amber-950/70",
                    isGapPanelOpen && "ring-2 ring-amber-500/50",
                  )}
                  data-testid="button-gap-indicator"
                  aria-pressed={isGapPanelOpen}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {gapCount} reasoning gap{gapCount !== 1 ? 's' : ''}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open the reasoning gaps panel to review and fill each gap</TooltipContent>
            </Tooltip>
          )}
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
                    <p className="text-muted-foreground">This document needs your professional review and approval</p>
                  </div>
                </TooltipContent>
              </Tooltip>
              <Button
                size="sm"
                variant="default"
                onClick={handleApproveClick}
                disabled={isApproving || isEditing}
                className="gap-1"
                data-testid="button-approve-document"
              >
                <CheckCircle className="w-3 h-3" />
                I Adopt
              </Button>
            </>
          )}
        </div>
        {/* Soft approval gate banner — hidden in demo mode */}
        {pendingApprovalDocId === document.id && !isApproved && !isDemoMode && (
          <div className="w-full mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-md" data-testid="banner-approval-gap-gate">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
              {gapCount} reasoning gap{gapCount !== 1 ? 's' : ''} not yet reviewed
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
              You may adopt as-is or review the gaps first.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowGapPanel(document.id);
                  setPendingApprovalDocId(null);
                }}
                data-testid="button-review-gaps-now"
              >
                Review now
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  // false = gaps were NOT reviewed before adoption (compliance record of bypass)
                  approveMutation.mutate({ documentId: document.id, reasoningGapsReviewed: false });
                }}
                disabled={isApproving}
                data-testid="button-approve-anyway"
              >
                Adopt anyway
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPendingApprovalDocId(null)}
                data-testid="button-cancel-approval-gate"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
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
                ? 'Meeting-to-Matter™ Engine will produce documents from your meeting notes.' 
                : 'Record audio and use Meeting-to-Matter™ Engine to produce legal documents automatically.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Focus mode: exit with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) setFocusMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusMode]);

  const handlePrint = () => {
    window.print();
  };

  const zoomLevels = [75, 100, 125, 150];

  // Measure sticky header height for nested sticky elements using ResizeObserver
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(80);
  
  useEffect(() => {
    const element = stickyHeaderRef.current;
    if (!element) return;
    
    const observer = new ResizeObserver(() => {
      // Use getBoundingClientRect for accurate height including padding
      const rect = element.getBoundingClientRect();
      setHeaderHeight(rect.height);
    });
    
    observer.observe(element);
    // Initial measurement
    setHeaderHeight(element.getBoundingClientRect().height);
    
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      className={`space-y-6 ${focusMode ? 'fixed inset-0 z-[100] bg-background overflow-auto p-8 print:p-0' : ''}`}
      data-testid="container-document-viewer"
      style={{ '--doc-header-height': `${headerHeight}px` } as CSSProperties}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div ref={stickyHeaderRef} className={`sticky top-0 z-40 bg-card/95 backdrop-blur-sm pt-4 pb-3 border-b ${focusMode ? 'print:hidden' : ''}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 px-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-semibold">Documents</h2>
                {/* Master Record badge */}
                {(attendanceNote?.status === 'approved' || summary?.status === 'approved') && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" data-testid="badge-master-record">
                        <Shield className="w-3 h-3" />
                        Master Record
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs font-semibold">LegalNote is the Master Record</p>
                      <p className="text-xs text-muted-foreground mt-1">This document has been approved and locked. All exports are working copies only. The authoritative version and full audit trail are held here.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 sm:hidden">Export documents below</p>
            </div>
            {hasAnyDocument && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-shrink-0 justify-end">
                  {/* Zoom controls */}
                  <div className="hidden sm:flex items-center gap-1 border border-border rounded-md px-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(75, z - 25))} disabled={zoom <= 75}>
                          <ZoomOut className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Zoom out</TooltipContent>
                    </Tooltip>
                    <span className="text-xs text-muted-foreground w-8 text-center">{zoom}%</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(150, z + 25))} disabled={zoom >= 150}>
                          <ZoomIn className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Zoom in</TooltipContent>
                    </Tooltip>
                  </div>
                  {activeTab !== 'transcript' && activeDocForComments && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="icon" 
                          variant={showComments ? 'secondary' : 'ghost'} 
                          onClick={() => setShowComments(s => !s)} 
                          data-testid="button-toggle-comments"
                          className="hidden sm:flex relative"
                        >
                          <MessageSquare className="w-4 h-4" />
                          {commentsData.filter(c => !c.resolved).length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                              {commentsData.filter(c => !c.resolved).length}
                            </span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Comments</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={handlePrint} data-testid="button-print" className="hidden sm:flex">
                        <Printer className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Print (Cmd+P)</TooltipContent>
                  </Tooltip>
                  {/* Page View / Draft toggle — only visible outside transcript and edit modes */}
                  {activeTab !== 'transcript' && !editingDocId && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant={pageViewMode ? 'secondary' : 'ghost'}
                          onClick={() => setPageViewMode(m => !m)}
                          data-testid="button-page-view-toggle"
                          className="hidden sm:flex"
                        >
                          {pageViewMode ? <Pencil className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{pageViewMode ? 'Switch to Draft View' : 'Page View'}</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={() => setFocusMode(f => !f)} data-testid="button-focus-mode" className="hidden sm:flex">
                        {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{focusMode ? 'Exit Focus Mode (Esc)' : 'Focus Mode'}</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="outline"
                    onClick={handleExport}
                    className="gap-2 flex-1 sm:flex-initial"
                    data-testid="button-export"
                  >
                    <FileDown className="w-4 h-4" />
                    <span className="hidden sm:inline">Download Working Copy</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
          <TabsList className={`grid w-full h-auto ${clientCareLetter ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <TabsTrigger value="attendance" data-testid="tab-attendance" disabled={!attendanceNote} className="text-xs sm:text-sm px-2 py-2.5 h-auto">
              {isMeetingNotes ? (
                <>
                  <span className="hidden sm:inline">Meeting Notes</span>
                  <span className="sm:hidden">Notes</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Attendance Note</span>
                  <span className="sm:hidden">Att. Note</span>
                </>
              )}
            </TabsTrigger>
            <TabsTrigger value="summary" data-testid="tab-summary" className="text-xs sm:text-sm px-2 py-2.5 h-auto">
              Matter Record
            </TabsTrigger>
            <TabsTrigger value="transcript" data-testid="tab-transcript" disabled={!transcriptContent} className="text-xs sm:text-sm px-2 py-2.5 h-auto">
              <span className="hidden sm:inline">Transcript</span>
              <span className="sm:hidden">Script</span>
            </TabsTrigger>
            {clientCareLetter && (
              <TabsTrigger value="care_letter" data-testid="tab-care-letter" className="text-xs sm:text-sm px-2 py-2.5 h-auto">
                <span className="hidden sm:inline">Care Letter</span>
                <span className="sm:hidden">Letter</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="attendance" className="mt-6 overflow-x-clip overscroll-x-none touch-pan-y">
          {attendanceNote?.status === 'draft' && !dismissedReviewBanners.has('attendance') && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-md" data-testid="banner-review-required-attendance">
              <div className="flex items-start gap-3">
                <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Review Required</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">This document has been produced and requires your professional review before it can be approved or shared with clients.</p>
                </div>
                <Button size="icon" variant="ghost" className="flex-shrink-0 h-6 w-6" onClick={() => setDismissedReviewBanners(prev => new Set(prev).add('attendance'))} data-testid="button-dismiss-review-attendance">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
          {showVersionDiff === 'attendance_note' && (
            <div className="mb-4">
              <VersionDiffViewer
                caseId={caseId}
                documentType="attendance_note"
                onClose={() => setShowVersionDiff(null)}
              />
            </div>
          )}
          <div className={`flex gap-4 items-start ${showComments || (attendanceNote && showGapPanel === attendanceNote.id) ? 'flex-col lg:flex-row' : ''}`}>
            <Card className={showComments || (attendanceNote && showGapPanel === attendanceNote.id) ? 'flex-1 min-w-0' : 'w-full'} data-testid="attendance-note-card">
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle>{isMeetingNotes ? 'Meeting Notes' : 'Attendance Note'}</CardTitle>
                    {attendanceNoteSessionLabel && (
                      <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate" data-testid="badge-doc-session-attendance">
                        {attendanceNoteSessionLabel}
                      </Badge>
                    )}
                  </div>
                  <DocumentStatusActions document={attendanceNote} />
                </div>
              </CardHeader>
              {attendanceNote?.verificationWarnings && attendanceNote.verificationWarnings.length > 0 && (
                <VerificationWarningPanel
                  warnings={attendanceNote.verificationWarnings}
                  testIdPrefix="attendance"
                />
              )}
              {attendanceNote && <LetterheadPreview firmProfile={firmProfile} />}
              <CardContent className="p-0">
                {attendanceNote ? (
                  <EditableDocumentContent 
                    document={attendanceNote}
                    isEditing={editingDocId === attendanceNote.id}
                    editContent={editContent}
                    onEditContentChange={handleEditContentChange}
                    onStartEditing={startEditing}
                    onCancelEditing={cancelEditing}
                    onSaveEdits={saveEdits}
                    isSaving={editMutation.isPending}
                    autoSaveStatus={editingDocId === attendanceNote.id ? autoSaveStatus : 'idle'}
                    zoom={zoom}
                    focusMode={focusMode}
                    onFocusModeToggle={() => setFocusMode(f => !f)}
                    onAddComment={handleAddComment}
                    trackChangesEnabled={editingDocId === attendanceNote.id ? trackChangesEnabled : false}
                    onTrackChangesToggle={setTrackChangesEnabled}
                    onTrackChangeAction={handleTrackChangeAction}
                    pageViewMode={pageViewMode}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic p-6">
                    {isMeetingNotes ? "No meeting notes available yet. Documents will be produced automatically." : "No attendance note available yet. Documents will be produced automatically."}
                  </p>
                )}
              </CardContent>
              {/* Advice Rationale section — hidden in demo mode */}
              {attendanceNote && !isDemoMode && (
                <div className="border-t border-border" data-testid="section-advice-rationale-attendance">
                  <button
                    className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium text-foreground hover-elevate"
                    onClick={() => setShowRationaleSection(prev => ({ ...prev, [attendanceNote.id]: !prev[attendanceNote.id] }))}
                    data-testid="button-toggle-rationale-attendance"
                  >
                    <div className="flex items-center gap-2">
                      <PenLine className="w-4 h-4 text-muted-foreground" />
                      <span>Advice Rationale — Solicitor's Record</span>
                      {attendanceNote.solicitorReasoningNote && (
                        <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate" data-testid="badge-solicitor-authored-attendance">
                          Solicitor-authored
                        </Badge>
                      )}
                    </div>
                    {showRationaleSection[attendanceNote.id] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {showRationaleSection[attendanceNote.id] && (
                    <div className="px-6 pb-4 space-y-3" data-testid="panel-rationale-attendance">
                      <p className="text-xs text-muted-foreground">
                        This section is for your professional record of the reasoning behind advice given. It is stored separately from the produced attendance note and will be included in exports only when completed.
                      </p>
                      <Textarea
                        placeholder="Record the reasoning and thinking behind the advice given — factors considered, legal position, client circumstances that informed the advice..."
                        value={reasoningNoteInputs[attendanceNote.id] ?? (attendanceNote.solicitorReasoningNote ?? '')}
                        onChange={e => setReasoningNoteInputs(prev => ({ ...prev, [attendanceNote.id]: e.target.value }))}
                        className="text-sm resize-none"
                        rows={5}
                        data-testid="input-rationale-attendance"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateReasoningNoteMutation.mutate({ documentId: attendanceNote.id, note: reasoningNoteInputs[attendanceNote.id] ?? attendanceNote.solicitorReasoningNote ?? null })}
                          disabled={updateReasoningNoteMutation.isPending}
                          data-testid="button-save-rationale-attendance"
                        >
                          {updateReasoningNoteMutation.isPending ? 'Saving...' : 'Save Rationale'}
                        </Button>
                        {attendanceNote.solicitorReasoningNote && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReasoningNoteInputs(prev => ({ ...prev, [attendanceNote.id]: '' }));
                              updateReasoningNoteMutation.mutate({ documentId: attendanceNote.id, note: null });
                            }}
                            data-testid="button-clear-rationale-attendance"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
            {showComments && attendanceNote && (
              <Card className="lg:w-80 flex-shrink-0" data-testid="panel-comments">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Comments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {showAddCommentForm && (
                    <div className="space-y-2 border-b border-border pb-3" data-testid="form-add-comment">
                      <div className="text-xs bg-muted/50 rounded px-2 py-1 font-mono truncate">
                        "{addCommentSelectedText.length > 60 ? addCommentSelectedText.substring(0, 60) + '...' : addCommentSelectedText}"
                      </div>
                      <Textarea
                        placeholder="Add your comment..."
                        value={addCommentText}
                        onChange={e => setAddCommentText(e.target.value)}
                        className="text-sm resize-none"
                        rows={3}
                        data-testid="input-comment-text"
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handleSubmitComment} disabled={addCommentMutation.isPending || !addCommentText.trim()} data-testid="button-submit-comment">
                          {addCommentMutation.isPending ? 'Saving...' : 'Add'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowAddCommentForm(false); setAddCommentText(''); setAddCommentSelectedText(''); }} data-testid="button-cancel-comment">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  <CommentsPanel
                    documentId={attendanceNote.id}
                    comments={commentsData}
                    showResolved={showResolvedComments}
                    onToggleResolved={() => setShowResolvedComments(s => !s)}
                    onResolve={handleResolveComment}
                    onDelete={handleDeleteComment}
                    onHighlightText={handleHighlightText}
                    highlightedCommentId={highlightedCommentId}
                  />
                </CardContent>
              </Card>
            )}
            {/* Gap review panel for attendance note */}
            {attendanceNote && showGapPanel === attendanceNote.id && !isDemoMode && (
              <Card className="lg:w-80 w-full flex-shrink-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden" data-testid="panel-gap-review-attendance">
                <CardHeader className="pb-2 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Reasoning Gaps
                    </CardTitle>
                    <Button size="icon" variant="ghost" onClick={() => setShowGapPanel(null)} data-testid="button-close-gap-panel-attendance">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tap a heading to jump to it in the note. Add your reasoning for each gap.
                  </p>
                  {hasAmlFlag && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-md" data-testid="banner-aml-gap-attendance">
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                        AML risk flag active — an AML decision record with documented reasoning is required for this matter
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 overflow-y-auto flex-1 min-h-0">
                  {parseReasoningGaps(attendanceNote.content).map((sectionName, idx) => (
                    <div key={idx} className="space-y-2" data-testid={`gap-item-attendance-${idx}`}>
                      <button
                        type="button"
                        onClick={() => scrollToReasoningGap(sectionName)}
                        className="text-left text-xs font-semibold text-foreground hover:text-amber-800 dark:hover:text-amber-300 underline-offset-2 hover:underline w-full"
                        data-testid={`button-gap-heading-attendance-${idx}`}
                      >
                        {sectionName}
                      </button>
                      <Textarea
                        placeholder={`Enter reasoning for "${sectionName}"...`}
                        value={gapInputs[attendanceNote.id]?.[String(idx)] ?? ''}
                        onChange={e => setGapInputs(prev => ({
                          ...prev,
                          [attendanceNote.id]: { ...(prev[attendanceNote.id] ?? {}), [String(idx)]: e.target.value }
                        }))}
                        className="text-xs resize-none"
                        rows={3}
                        data-testid={`input-gap-attendance-${idx}`}
                      />
                    </div>
                  ))}
                  {hasAmlFlag && (
                    <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md" data-testid="container-aml-confirm-attendance">
                      <input
                        type="checkbox"
                        id={`aml-confirm-attendance-${attendanceNote.id}`}
                        checked={amlAcknowledged[attendanceNote.id] ?? false}
                        onChange={e => setAmlAcknowledged(prev => ({ ...prev, [attendanceNote.id]: e.target.checked }))}
                        className="mt-0.5"
                        data-testid="checkbox-aml-confirm-attendance"
                      />
                      <label htmlFor={`aml-confirm-attendance-${attendanceNote.id}`} className="text-xs text-amber-700 dark:text-amber-400 cursor-pointer">
                        I confirm an AML decision record with documented reasoning has been filed for this matter
                      </label>
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => saveGapMutation.mutate({
                      documentId: attendanceNote.id,
                      gaps: gapInputs[attendanceNote.id] ?? {},
                      amlConfirmed: hasAmlFlag ? (amlAcknowledged[attendanceNote.id] ?? false) : undefined,
                    })}
                    disabled={
                      saveGapMutation.isPending ||
                      !Object.values(gapInputs[attendanceNote.id] ?? {}).some(v => v.trim()) ||
                      (hasAmlFlag === true && !(amlAcknowledged[attendanceNote.id]))
                    }
                    data-testid="button-save-gaps-attendance"
                  >
                    {saveGapMutation.isPending ? 'Saving...' : 'Fill Selected Gaps'}
                  </Button>
                  {hasAmlFlag && !amlAcknowledged[attendanceNote.id] && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400" data-testid="text-aml-required-attendance">
                      AML confirmation required before saving
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="summary" className="mt-6 overflow-x-clip">
          {summary?.status === 'draft' && !dismissedReviewBanners.has('summary') && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-md" data-testid="banner-review-required-summary">
              <div className="flex items-start gap-3">
                <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Review Required</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">This document has been produced and requires your professional review before it can be approved or shared with clients.</p>
                </div>
                <Button size="icon" variant="ghost" className="flex-shrink-0 h-6 w-6" onClick={() => setDismissedReviewBanners(prev => new Set(prev).add('summary'))} data-testid="button-dismiss-review-summary">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
          {showVersionDiff === 'summary' && (
            <div className="mb-4">
              <VersionDiffViewer
                caseId={caseId}
                documentType="summary"
                onClose={() => setShowVersionDiff(null)}
              />
            </div>
          )}
          <div className={`flex gap-4 items-start ${showComments || (summary && showGapPanel === summary.id) ? 'flex-col lg:flex-row' : ''}`}>
            <Card className={showComments || (summary && showGapPanel === summary.id) ? 'flex-1 min-w-0' : 'w-full'}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle>Matter Record</CardTitle>
                    {summarySessionLabel && (
                      <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate" data-testid="badge-doc-session-summary">
                        {summarySessionLabel}
                      </Badge>
                    )}
                  </div>
                  <DocumentStatusActions document={summary} />
                </div>
              </CardHeader>
              {summary?.verificationWarnings && summary.verificationWarnings.length > 0 && (
                <VerificationWarningPanel
                  warnings={summary.verificationWarnings}
                  testIdPrefix="summary"
                />
              )}
              {summary && <LetterheadPreview firmProfile={firmProfile} />}
              <CardContent className="p-0">
                {summary ? (
                  <EditableDocumentContent 
                    document={summary}
                    isEditing={editingDocId === summary.id}
                    editContent={editContent}
                    onEditContentChange={handleEditContentChange}
                    onStartEditing={startEditing}
                    onCancelEditing={cancelEditing}
                    onSaveEdits={saveEdits}
                    isSaving={editMutation.isPending}
                    autoSaveStatus={editingDocId === summary.id ? autoSaveStatus : 'idle'}
                    zoom={zoom}
                    focusMode={focusMode}
                    onFocusModeToggle={() => setFocusMode(f => !f)}
                    onAddComment={handleAddComment}
                    trackChangesEnabled={editingDocId === summary.id ? trackChangesEnabled : false}
                    onTrackChangesToggle={setTrackChangesEnabled}
                    onTrackChangeAction={handleTrackChangeAction}
                    pageViewMode={pageViewMode}
                  />
                ) : textNotes ? (
                  <div className="p-6">
                    <p className="text-sm text-muted-foreground mb-4 italic">
                      Meeting notes (matter record will be produced once processing is complete)
                    </p>
                    <p className="text-foreground whitespace-pre-wrap">{textNotes}</p>
                  </div>
                ) : (
                  <div className="text-center p-6 py-8 space-y-3" data-testid="placeholder-matter-record">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
                    <div>
                      <p className="font-medium text-sm text-foreground">Matter Record</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        The matter record will appear here once the session is processed.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
              {/* Advice Rationale section for summary — hidden in demo mode */}
              {summary && !isDemoMode && (
                <div className="border-t border-border" data-testid="section-advice-rationale-summary">
                  <button
                    className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium text-foreground hover-elevate"
                    onClick={() => setShowRationaleSection(prev => ({ ...prev, [summary.id]: !prev[summary.id] }))}
                    data-testid="button-toggle-rationale-summary"
                  >
                    <div className="flex items-center gap-2">
                      <PenLine className="w-4 h-4 text-muted-foreground" />
                      <span>Advice Rationale — Solicitor's Record</span>
                      {summary.solicitorReasoningNote && (
                        <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate" data-testid="badge-solicitor-authored-summary">
                          Solicitor-authored
                        </Badge>
                      )}
                    </div>
                    {showRationaleSection[summary.id] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {showRationaleSection[summary.id] && (
                    <div className="px-6 pb-4 space-y-3" data-testid="panel-rationale-summary">
                      <p className="text-xs text-muted-foreground">
                        This section is for your professional record of the reasoning behind advice given. It is stored separately from the produced attendance note and will be included in exports only when completed.
                      </p>
                      <Textarea
                        placeholder="Record the reasoning and thinking behind the advice given — factors considered, legal position, client circumstances that informed the advice..."
                        value={reasoningNoteInputs[summary.id] ?? (summary.solicitorReasoningNote ?? '')}
                        onChange={e => setReasoningNoteInputs(prev => ({ ...prev, [summary.id]: e.target.value }))}
                        className="text-sm resize-none"
                        rows={5}
                        data-testid="input-rationale-summary"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateReasoningNoteMutation.mutate({ documentId: summary.id, note: reasoningNoteInputs[summary.id] ?? summary.solicitorReasoningNote ?? null })}
                          disabled={updateReasoningNoteMutation.isPending}
                          data-testid="button-save-rationale-summary"
                        >
                          {updateReasoningNoteMutation.isPending ? 'Saving...' : 'Save Rationale'}
                        </Button>
                        {summary.solicitorReasoningNote && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReasoningNoteInputs(prev => ({ ...prev, [summary.id]: '' }));
                              updateReasoningNoteMutation.mutate({ documentId: summary.id, note: null });
                            }}
                            data-testid="button-clear-rationale-summary"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
            {showComments && summary && (
              <Card className="lg:w-80 flex-shrink-0" data-testid="panel-comments">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Comments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {showAddCommentForm && (
                    <div className="space-y-2 border-b border-border pb-3" data-testid="form-add-comment">
                      <div className="text-xs bg-muted/50 rounded px-2 py-1 font-mono truncate">
                        "{addCommentSelectedText.length > 60 ? addCommentSelectedText.substring(0, 60) + '...' : addCommentSelectedText}"
                      </div>
                      <Textarea
                        placeholder="Add your comment..."
                        value={addCommentText}
                        onChange={e => setAddCommentText(e.target.value)}
                        className="text-sm resize-none"
                        rows={3}
                        data-testid="input-comment-text"
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handleSubmitComment} disabled={addCommentMutation.isPending || !addCommentText.trim()} data-testid="button-submit-comment">
                          {addCommentMutation.isPending ? 'Saving...' : 'Add'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowAddCommentForm(false); setAddCommentText(''); setAddCommentSelectedText(''); }} data-testid="button-cancel-comment">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  <CommentsPanel
                    documentId={summary.id}
                    comments={commentsData}
                    showResolved={showResolvedComments}
                    onToggleResolved={() => setShowResolvedComments(s => !s)}
                    onResolve={handleResolveComment}
                    onDelete={handleDeleteComment}
                    onHighlightText={handleHighlightText}
                    highlightedCommentId={highlightedCommentId}
                  />
                </CardContent>
              </Card>
            )}
            {/* Gap review panel for summary — hidden in demo mode */}
            {summary && showGapPanel === summary.id && !isDemoMode && (
              <Card className="lg:w-80 w-full flex-shrink-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden" data-testid="panel-gap-review-summary">
                <CardHeader className="pb-2 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Reasoning Gaps
                    </CardTitle>
                    <Button size="icon" variant="ghost" onClick={() => setShowGapPanel(null)} data-testid="button-close-gap-panel-summary">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tap a heading to jump to it in the document. Add your reasoning for each gap.
                  </p>
                  {hasAmlFlag && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-md" data-testid="banner-aml-gap-summary">
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                        AML risk flag active — an AML decision record with documented reasoning is required for this matter
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 overflow-y-auto flex-1 min-h-0">
                  {parseReasoningGaps(summary.content).map((sectionName, idx) => (
                    <div key={idx} className="space-y-2" data-testid={`gap-item-summary-${idx}`}>
                      <button
                        type="button"
                        onClick={() => scrollToReasoningGap(sectionName)}
                        className="text-left text-xs font-semibold text-foreground hover:text-amber-800 dark:hover:text-amber-300 underline-offset-2 hover:underline w-full"
                        data-testid={`button-gap-heading-summary-${idx}`}
                      >
                        {sectionName}
                      </button>
                      <Textarea
                        placeholder={`Enter reasoning for "${sectionName}"...`}
                        value={gapInputs[summary.id]?.[String(idx)] ?? ''}
                        onChange={e => setGapInputs(prev => ({
                          ...prev,
                          [summary.id]: { ...(prev[summary.id] ?? {}), [String(idx)]: e.target.value }
                        }))}
                        className="text-xs resize-none"
                        rows={3}
                        data-testid={`input-gap-summary-${idx}`}
                      />
                    </div>
                  ))}
                  {hasAmlFlag && (
                    <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md" data-testid="container-aml-confirm-summary">
                      <input
                        type="checkbox"
                        id={`aml-confirm-summary-${summary.id}`}
                        checked={amlAcknowledged[summary.id] ?? false}
                        onChange={e => setAmlAcknowledged(prev => ({ ...prev, [summary.id]: e.target.checked }))}
                        className="mt-0.5"
                        data-testid="checkbox-aml-confirm-summary"
                      />
                      <label htmlFor={`aml-confirm-summary-${summary.id}`} className="text-xs text-amber-700 dark:text-amber-400 cursor-pointer">
                        I confirm an AML decision record with documented reasoning has been filed for this matter
                      </label>
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => saveGapMutation.mutate({
                      documentId: summary.id,
                      gaps: gapInputs[summary.id] ?? {},
                      amlConfirmed: hasAmlFlag ? (amlAcknowledged[summary.id] ?? false) : undefined,
                    })}
                    disabled={
                      saveGapMutation.isPending ||
                      !Object.values(gapInputs[summary.id] ?? {}).some(v => v.trim()) ||
                      (hasAmlFlag === true && !(amlAcknowledged[summary.id]))
                    }
                    data-testid="button-save-gaps-summary"
                  >
                    {saveGapMutation.isPending ? 'Saving...' : 'Fill Selected Gaps'}
                  </Button>
                  {hasAmlFlag && !amlAcknowledged[summary.id] && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400" data-testid="text-aml-required-summary">
                      AML confirmation required before saving
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
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
                  <Badge variant="outline" data-testid="badge-ai-generated">Transcript</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              {transcriptUtterances && transcriptUtterances.length > 0 ? (
                <>
                  {litigationHold && (
                    <div className="flex flex-wrap items-center gap-2 pb-2 border-b mb-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="gap-1"
                              data-testid="button-toggle-redaction-mode"
                            >
                              <Shield className="w-3 h-3" />
                              Redact
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Redaction is blocked while this matter is under litigation hold.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  <DiarizedTranscriptViewer
                    utterances={transcriptUtterances}
                    speakerCount={speakerCount}
                    fallbackContent={transcriptContent}
                    onTimestampClick={onTranscriptTimestampClick}
                    redactions={transcriptRedactions}
                    onRedact={handleRedact}
                    onRemoveRedaction={handleRemoveRedaction}
                    canRedact={!litigationHold}
                    initialTimestamp={initialTimestamp}
                  />
                </>
              ) : transcriptContent ? (
                <p className="text-foreground whitespace-pre-wrap">{transcriptContent}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Transcript not yet available. Process this case to produce a transcript.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {clientCareLetter && (
          <TabsContent value="care_letter" className="mt-6">
            {clientCareLetter.status === 'draft' && !dismissedReviewBanners.has('care_letter') && (
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-md" data-testid="banner-review-required-care-letter">
                <div className="flex items-start gap-3">
                  <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Review Required</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">This document has been produced and requires your professional review before it can be approved or shared with clients.</p>
                  </div>
                  <Button size="icon" variant="ghost" className="flex-shrink-0 h-6 w-6" onClick={() => setDismissedReviewBanners(prev => new Set(prev).add('care_letter'))} data-testid="button-dismiss-review-care-letter">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle>Client Care Letter</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(clientCareLetter as any).acknowledgedAt ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="default" className="gap-1 bg-green-600" data-testid="badge-acknowledged">
                            <MailCheck className="w-3 h-3" />
                            Acknowledged
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          Acknowledged on {new Date((clientCareLetter as any).acknowledgedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {(clientCareLetter as any).acknowledgedByEmail ? ` by ${(clientCareLetter as any).acknowledgedByEmail}` : ''}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => requestAcknowledgementMutation.mutate({ documentId: clientCareLetter.id })}
                            disabled={requestAcknowledgementMutation.isPending}
                            className="gap-1"
                            data-testid="button-request-acknowledgement"
                          >
                            <Mail className="w-3 h-3" />
                            {requestAcknowledgementMutation.isPending ? "Sending..." : "Request Acknowledgement"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Send client a secure link to read and confirm this letter</TooltipContent>
                      </Tooltip>
                    )}
                    <Badge variant="outline" data-testid="badge-care-letter-ai">Produced by LegalNote</Badge>
                    <DocumentStatusActions document={clientCareLetter} />
                  </div>
                </div>
              </CardHeader>
              <LetterheadPreview firmProfile={firmProfile} />
              <CardContent className="p-0">
                <EditableDocumentContent
                  document={clientCareLetter}
                  isEditing={editingDocId === clientCareLetter.id}
                  editContent={editContent}
                  onEditContentChange={handleEditContentChange}
                  onStartEditing={startEditing}
                  onCancelEditing={cancelEditing}
                  onSaveEdits={saveEdits}
                  isSaving={editMutation.isPending}
                  autoSaveStatus={editingDocId === clientCareLetter.id ? autoSaveStatus : 'idle'}
                  zoom={zoom}
                  focusMode={focusMode}
                  onFocusModeToggle={() => setFocusMode(f => !f)}
                  onAddComment={handleAddComment}
                  trackChangesEnabled={editingDocId === clientCareLetter.id ? trackChangesEnabled : false}
                  onTrackChangesToggle={setTrackChangesEnabled}
                  onTrackChangeAction={handleTrackChangeAction}
                  onRedact={handleDocumentRedact}
                  legalContext={{
                    clientName: clientName || undefined,
                    matterRef: matterReference || undefined,
                    firmName: firmProfile?.firmName || undefined,
                  }}
                  pageViewMode={pageViewMode}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

      </Tabs>

      <DownloadModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        availableDocuments={{
          hasAttendanceNote: !!attendanceNote,
          hasSummary: !!summary || !!textNotes,
          hasTranscript: !!transcriptContent,
          hasCareLetter: !!clientCareLetter,
        }}
        sharedDocuments={['attendance_note', 'summary', 'client_care_letter', 'transcript']}
        onDownload={handleDownload}
      />

      <Dialog open={!!pendingRedactionData} onOpenChange={(open) => { if (!open) setPendingRedactionData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Redaction Reason</DialogTitle>
            <DialogDescription>
              Choose a reason for redacting the selected text.
            </DialogDescription>
          </DialogHeader>
          {pendingRedactionData?.selectedText && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {pendingRedactionData.selectedText}
            </div>
          )}
          <RadioGroup
            value={redactionReasonType}
            onValueChange={(value) => {
              setRedactionReasonType(value);
              setPermanenceConfirmed(false);
            }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="redaction_gdpr" id="redaction-gdpr" />
              <Label htmlFor="redaction-gdpr" className="cursor-pointer">GDPR — Personal Data</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="redaction_privilege" id="redaction-privilege" />
              <Label htmlFor="redaction-privilege" className="cursor-pointer">Legal Privilege</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="redaction_third_party" id="redaction-third-party" />
              <Label htmlFor="redaction-third-party" className="cursor-pointer">Third Party Information</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="redaction_commercially_sensitive" id="redaction-commercially-sensitive" />
              <Label htmlFor="redaction-commercially-sensitive" className="cursor-pointer">Commercially Sensitive</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="redaction_court_order" id="redaction-court-order" />
              <Label htmlFor="redaction-court-order" className="cursor-pointer">Court Order / Reporting Restriction</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="redaction_without_prejudice" id="redaction-without-prejudice" />
              <Label htmlFor="redaction-without-prejudice" className="cursor-pointer">Without Prejudice</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="redaction_nda" id="redaction-nda" />
              <Label htmlFor="redaction-nda" className="cursor-pointer">Deal Confidentiality / NDA</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="redaction_ubo" id="redaction-ubo" />
              <Label htmlFor="redaction-ubo" className="cursor-pointer">Beneficial Ownership / UBO</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="redaction_regulatory_privilege" id="redaction-regulatory-privilege" />
              <Label htmlFor="redaction-regulatory-privilege" className="cursor-pointer">Regulatory / Supervisory Privilege</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="redaction_foreign_law_privilege" id="redaction-foreign-law-privilege" />
              <Label htmlFor="redaction-foreign-law-privilege" className="cursor-pointer">Foreign Law Privilege</Label>
            </div>
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor="redaction-reason-notes">Additional notes (required for privilege)</Label>
            <Textarea
              id="redaction-reason-notes"
              value={redactionReasonNotes}
              onChange={(e) => setRedactionReasonNotes(e.target.value)}
              placeholder="Describe the basis for this redaction..."
            />
          </div>
          {redactionReasonType !== 'redaction_privilege' && (
            <div className="flex items-start gap-3 p-3 bg-destructive/8 border border-destructive/20 rounded-md">
              <input
                type="checkbox"
                id="permanence-confirm"
                checked={permanenceConfirmed}
                onChange={(e) => setPermanenceConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-destructive cursor-pointer"
                data-testid="checkbox-permanence-confirm"
              />
              <label
                htmlFor="permanence-confirm"
                className="text-xs text-destructive leading-relaxed cursor-pointer"
              >
                I understand this redaction will permanently delete the selected
                text after 4 hours and cannot be recovered.
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRedactionData(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmRedaction}
              disabled={
                (redactionReasonType === 'redaction_privilege' && redactionReasonNotes.trim().length < 20) ||
                (redactionReasonType !== 'redaction_privilege' && !permanenceConfirmed) ||
                addRedactionMutation.isPending
              }
            >
              Confirm Redaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
