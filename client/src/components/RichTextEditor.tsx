import { useEffect, useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import CharacterCount from '@tiptap/extension-character-count';
import { Mark, Node, Extension, mergeAttributes, generateJSON } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { ReplaceStep, ReplaceAroundStep } from '@tiptap/pm/transform';
import { Fragment } from '@tiptap/pm/model';
import { useAuth } from "@/hooks/useAuth";
import { PaginationPlus } from 'tiptap-pagination-plus';
import { Markdown } from 'tiptap-markdown';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, Highlighter, Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon, Table as TableIcon, Search,
  Maximize2, Minimize2, Type, GitCompareArrows, Check, X,
  CheckCheck, XCircle, MessageSquarePlus, EyeOff, ChevronDown, Hash,
  User, Calendar, Briefcase, Building2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { hydrateReasoningGapAnchorsInDom } from "@/lib/reasoningGapAnchors";

function ensureSectionSpacing(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isHeadingLine = trimmed.startsWith('## ') || trimmed.startsWith('### ') ||
      /^\*\*[A-Z]/.test(trimmed) || /^\d+\.\s+\*\*/.test(trimmed);
    
    if (isHeadingLine && i > 0) {
      const prevLine = result.length > 0 ? result[result.length - 1].trim() : '';
      if (prevLine !== '') {
        result.push('');
      }
    }
    
    result.push(line);
  }
  
  return result.join('\n');
}

function stripEmptyListItems(content: string): string {
  if (!content) return content;
  return content
    .replace(/^[-*+]\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

function trackChangeAttrsFromElement(el: HTMLElement) {
  return {
    user: el.getAttribute('user'),
    timestamp: el.getAttribute('timestamp'),
    changeId: el.getAttribute('changeid') || el.getAttribute('changeId'),
  };
}

/** Content saved via getHTML() when track-change marks are present. */
function isTrackedChangesHtml(content: string): boolean {
  return /<(?:ins|del)\b[^>]*\bdata-track-change\s*=/i.test(content);
}

function ensureBoldHeadings(content: string): string {
  if (!content) return content;
  content = stripEmptyListItems(content);
  
  const knownHeadings = [
    'ATTENDANCE NOTE', 'MEETING SUMMARY', 'MATTERS DISCUSSED', 'NEXT STEPS',
    'KEY POINTS', 'CRITICAL ISSUES IDENTIFIED', 'IMMEDIATE ACTIONS REQUIRED',
    'CLIENT CONCERNS', 'SOLICITOR RECOMMENDATIONS', 'MATTER SUMMARY',
    'OUTSTANDING ACTION ITEMS', 'IMPORTANT DATES', 'SUGGESTED AGENDA ITEMS',
    'CLIENT CONFIRMATION', 'INTRODUCTION', 'BACKGROUND', 'SUMMARY',
    'CONCLUSION', 'ASSETS SUMMARY', 'DISCUSSION POINTS', 'ACTION ITEMS',
    'DECISIONS MADE', 'PURPOSE OF MEETING', 'ADDITIONAL NOTES',
    'Attendance Note', 'Meeting Summary', 'Matters Discussed', 'Next Steps',
    'Key Points', 'Critical Issues Identified', 'Immediate Actions Required',
    'Client Concerns', 'Solicitor Recommendations', 'Matter Summary',
    'Outstanding Obligations', 'Important Dates', 'Suggested Agenda Items',
    'Client Confirmation', 'Introduction', 'Background', 'Summary',
    'Conclusion', 'Assets Summary', 'Discussion Points', 'Obligations',
    'Decisions Made', 'Purpose of Meeting', 'Additional Notes',
    'Key Discussion Points from Previous Meeting',
  ];
  
  let result = content;
  for (const heading of knownHeadings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const numberedPattern = new RegExp(`^(\\d+\\.)\\s+(?!\\*\\*)${escaped}(?!\\*\\*)(:?)$`, 'gm');
    result = result.replace(numberedPattern, `$1 **${heading}**$2`);
    const standalonePattern = new RegExp(`^(?!\\*\\*)${escaped}(?!\\*\\*)(:?)$`, 'gm');
    result = result.replace(standalonePattern, `**${heading}**$1`);
  }
  
  result = ensureSectionSpacing(result);
  
  return result;
}

const LEGAL_AUTOCOMPLETE_PHRASES = [
  'without prejudice',
  'without prejudice save as to costs',
  'pursuant to',
  'time is of the essence',
  'notwithstanding',
  'in consideration of',
  'subject to contract',
  'subject to the terms and conditions',
  'in full and final settlement',
  'reasonable endeavours',
  'best endeavours',
  'force majeure',
  'mutually agreed',
  'inter alia',
  'prima facie',
  'pro rata',
  'as agreed between the parties',
  'on a without admission basis',
  'subject to board approval',
  'on the balance of probabilities',
];

const trackChangesPluginKey = new PluginKey('trackChanges');

type DeletionClass =
  | { kind: 'none' }
  | { kind: 'inline'; from: number; to: number }
  | { kind: 'structural-preserving' }
  | { kind: 'structural-destructive' };

/** Count inline text characters removed by a step (excludes block-structure-only deletions). */
function deletedInlineTextLength(step: any, docBefore: any): number {
  const ranges: [number, number][] = step instanceof ReplaceAroundStep
    ? [[step.from, step.gapFrom], [step.gapTo, step.to]]
    : [[step.from, step.to]];
  let length = 0;
  for (const [rangeFrom, rangeTo] of ranges) {
    if (rangeFrom >= rangeTo) continue;
    docBefore.nodesBetween(rangeFrom, rangeTo, (node: any, pos: number) => {
      if (node.isText) {
        length += node.text.slice(Math.max(rangeFrom, pos) - pos, rangeTo - pos).length;
      }
    });
  }
  return length;
}

/** True when a step only merges textblocks (no complete block node removed). */
function isTextblockJoin(step: any, docBefore: any): boolean {
  if (deletedInlineTextLength(step, docBefore) !== 0) return false;

  const from: number = step.from;
  const to: number = step.to;
  const gapFrom = step instanceof ReplaceAroundStep ? step.gapFrom : null;
  const gapTo = step instanceof ReplaceAroundStep ? step.gapTo : null;

  const deletedRanges: [number, number][] = gapFrom != null && gapTo != null
    ? [[from, gapFrom], [gapTo, to]]
    : [[from, to]];

  let hasRemovedBlock = false;

  for (const [rangeFrom, rangeTo] of deletedRanges) {
    if (rangeFrom >= rangeTo) continue;
    docBefore.nodesBetween(rangeFrom, rangeTo, (node: any, pos: number) => {
      if (hasRemovedBlock || !node.isBlock) return;
      if (pos >= rangeFrom && pos + node.nodeSize <= rangeTo) {
        hasRemovedBlock = true;
      }
    });
    if (hasRemovedBlock) return false;
  }

  // ReplaceAroundStep: a block spanning the outer range but not wholly in the
  // preserved gap is structurally removed (e.g. liftListItem on an empty bullet).
  if (gapFrom != null && gapTo != null) {
    docBefore.nodesBetween(from, to, (node: any, pos: number) => {
      if (hasRemovedBlock || !node.isBlock) return;
      const nodeEnd = pos + node.nodeSize;
      if (pos >= from && nodeEnd <= to && !(pos >= gapFrom && nodeEnd <= gapTo)) {
        hasRemovedBlock = true;
      }
    });
  }

  return !hasRemovedBlock;
}

function classifyStepDeletion(step: any, docBefore: any): DeletionClass {
  if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) return { kind: 'none' };
  const from: number = step.from;
  const to: number = step.to;
  if (from >= to) return { kind: 'none' };

  const $from = docBefore.resolve(from);
  const $to = docBefore.resolve(to);
  const withinOneTextblock = $from.sameParent($to) && $from.parent.isTextblock;

  if (withinOneTextblock) {
    const deletedText = docBefore.textBetween(from, to, '\u0001', '\u0001');
    return deletedText.length > 0 ? { kind: 'inline', from, to } : { kind: 'none' };
  }
  if (deletedInlineTextLength(step, docBefore) > 0) return { kind: 'structural-destructive' };
  if (isTextblockJoin(step, docBefore)) return { kind: 'structural-preserving' };
  return { kind: 'structural-destructive' };
}

function newChangeId(): string {
  return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `tc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Reuse changeId when a new insertion is position-adjacent to same-author insertion mark. */
function findAdjacentInsertionMark(
  doc: any,
  from: number,
  to: number,
  author: string,
): { changeId: string; timestamp: string } | null {
  const matchesAuthor = (mark: any) =>
    mark.type.name === 'insertion'
    && mark.attrs.changeId
    && (mark.attrs.user || 'Unknown') === author;

  if (from > 0) {
    const nodeBefore = doc.resolve(from).nodeBefore;
    if (nodeBefore?.isText) {
      const mark = nodeBefore.marks.find(matchesAuthor);
      if (mark) {
        return {
          changeId: mark.attrs.changeId,
          timestamp: mark.attrs.timestamp || new Date().toISOString(),
        };
      }
    }
  }

  if (to < doc.content.size) {
    const nodeAfter = doc.resolve(to).nodeAfter;
    if (nodeAfter?.isText) {
      const mark = nodeAfter.marks.find(matchesAuthor);
      if (mark) {
        return {
          changeId: mark.attrs.changeId,
          timestamp: mark.attrs.timestamp || new Date().toISOString(),
        };
      }
    }
  }

  return null;
}

/** Reuse changeId when a new deletion reinsert is position-adjacent to same-author deletion mark. */
function findAdjacentDeletionMark(
  doc: any,
  pos: number,
  author: string,
): { changeId: string; timestamp: string } | null {
  const matchesAuthor = (mark: any) =>
    mark.type.name === 'deletion'
    && mark.attrs.changeId
    && (mark.attrs.user || 'Unknown') === author;

  if (pos > 0) {
    const nodeBefore = doc.resolve(pos).nodeBefore;
    if (nodeBefore?.isText) {
      const mark = nodeBefore.marks.find(matchesAuthor);
      if (mark) {
        return {
          changeId: mark.attrs.changeId,
          timestamp: mark.attrs.timestamp || new Date().toISOString(),
        };
      }
    }
  }

  if (pos < doc.content.size) {
    const nodeAfter = doc.resolve(pos).nodeAfter;
    if (nodeAfter?.isText) {
      const mark = nodeAfter.marks.find(matchesAuthor);
      if (mark) {
        return {
          changeId: mark.attrs.changeId,
          timestamp: mark.attrs.timestamp || new Date().toISOString(),
        };
      }
    }
  }

  return null;
}

const InsertionMark = Mark.create({
  name: 'insertion',
  priority: 1000,
  excludes: 'deletion',
  addAttributes() {
    return {
      user: { default: null },
      timestamp: { default: null },
      changeId: { default: null },
    };
  },
  parseHTML() {
    return [
      { tag: 'ins[data-track-change]', getAttrs: trackChangeAttrsFromElement },
      { tag: 'ins.track-change-insertion', getAttrs: trackChangeAttrsFromElement },
      { tag: 'span.track-change-insertion', getAttrs: trackChangeAttrsFromElement },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ins', mergeAttributes(HTMLAttributes, { 'data-track-change': 'insertion', class: 'track-change-insertion' }), 0];
  },
});

const DeletionMark = Mark.create({
  name: 'deletion',
  priority: 1000,
  inclusive: false,
  excludes: 'insertion',
  addAttributes() {
    return {
      user: { default: null },
      timestamp: { default: null },
      originalText: { default: null },
      changeId: { default: null },
    };
  },
  parseHTML() {
    return [
      { tag: 'del[data-track-change]', getAttrs: trackChangeAttrsFromElement },
      { tag: 'del.track-change-deletion', getAttrs: trackChangeAttrsFromElement },
      { tag: 'span.track-change-deletion', getAttrs: trackChangeAttrsFromElement },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['del', mergeAttributes(HTMLAttributes, { 'data-track-change': 'deletion', class: 'track-change-deletion' }), 0];
  },
});

const RedactionMark = Mark.create({
  name: 'redaction',
  excludes: '_',
  addAttributes() {
    return {
      redactedBy: { default: null },
      redactedAt: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-redaction]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-redaction': 'true',
      class: 'redaction-mark',
      title: 'Redacted',
    }), 0];
  },
});

type LegalFieldType = 'clientName' | 'matterRef' | 'date' | 'solicitorName' | 'firmName';

const LegalFieldNode = Node.create({
  name: 'legalField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      fieldType: { default: 'date' },
      fieldLabel: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-legal-field]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-legal-field': HTMLAttributes.fieldType,
      class: 'legal-field-token',
      contenteditable: 'false',
    }), HTMLAttributes.fieldLabel || `[${HTMLAttributes.fieldType}]`];
  },
  renderText({ node }) {
    return node.attrs.fieldLabel || `[${node.attrs.fieldType}]`;
  },
});

function createTrackChangesPlugin(
  isTrackingRef: React.MutableRefObject<boolean>,
  isUpdatingRef: React.MutableRefObject<boolean>,
  userNameRef: React.MutableRefObject<string>,
  composingRef: React.MutableRefObject<boolean>,
  onChangeLogged?: (change: TrackedChange) => void,
  onStructuralBlocked?: () => void,
) {
  return new Plugin({
    key: trackChangesPluginKey,

    // Structural guard ONLY: blocks content-destroying structural deletions while tracking.
    // No marks, no buffers, no deferred dispatch.
    filterTransaction(transaction) {
      if (!isTrackingRef.current) return true;
      if (!transaction.docChanged) return true;
      if (transaction.getMeta('trackChangesApply')) return true;
      if (transaction.getMeta('history$')) return true;
      if (isUpdatingRef.current) return true;

      for (let i = 0; i < transaction.steps.length; i++) {
        const cls = classifyStepDeletion(transaction.steps[i], transaction.docs[i]);
        if (cls.kind === 'structural-destructive') {
          if (onStructuralBlocked) onStructuralBlocked();
          return false;
        }
      }
      return true;
    },

    // All tracking happens here, after the user's transaction has applied.
    appendTransaction(transactions, oldState, newState) {
      if (!isTrackingRef.current) return null;
      if (isUpdatingRef.current) return null;
      if (composingRef.current) return null;

      type ReinsertOp = {
        pos: number; nodes: any[]; cursor: 'before' | 'after' | null;
        loggedText: string; changeId: string; timestamp: string; isNewDeletion: boolean;
      };
      type MarkOp = { from: number; to: number };
      const reinserts: ReinsertOp[] = [];
      const insertionRanges: MarkOp[] = [];

      for (const transaction of transactions) {
        if (!transaction.docChanged) continue;
        if (transaction.getMeta('trackChangesApply')) continue;
        if (transaction.getMeta('history$')) continue;

        for (let i = 0; i < transaction.steps.length; i++) {
          const step: any = transaction.steps[i];
          if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) continue;
          const docBefore = transaction.docs[i];
          const mapToFinal = transaction.mapping.slice(i + 1);

          // Insertion tracking: new content occupies [from, from + slice.size] post-step.
          const insertedSize = step.slice ? step.slice.size : 0;
          if (insertedSize > 0) {
            const insFrom = mapToFinal.map(step.from, 1);
            const insTo = mapToFinal.map(step.from + insertedSize, -1);
            if (insTo > insFrom) insertionRanges.push({ from: insFrom, to: insTo });
          }

          // Deletion tracking: inline deletions are re-inserted as struck-through text.
          const cls = classifyStepDeletion(step, docBefore);
          if (cls.kind !== 'inline') continue;

          const reinsertPos = mapToFinal.map(step.from, -1);
          const adjacentDel = findAdjacentDeletionMark(newState.doc, reinsertPos, userNameRef.current);
          let changeId = adjacentDel?.changeId ?? newChangeId();
          const timestamp = adjacentDel?.timestamp ?? new Date().toISOString();
          let isNewDeletion = !adjacentDel;
          const deletionMarkType = newState.schema.marks.deletion;
          const nodes: any[] = [];
          let loggedText = '';

          docBefore.nodesBetween(cls.from, cls.to, (node: any, pos: number) => {
            if (!node.isInline) return true;
            const start = Math.max(pos, cls.from);
            const end = Math.min(pos + node.nodeSize, cls.to);
            if (end <= start) return false;

            // Rule 1: deleting an unaccepted insertion is a genuine removal.
            if (node.marks.some((m: any) => m.type.name === 'insertion')) return false;

            // Rule 2: already-struck text is re-inserted with its ORIGINAL mark preserved.
            const existingDeletion = node.marks.find((m: any) => m.type.name === 'deletion');
            if (existingDeletion) {
              changeId = existingDeletion.attrs.changeId;
              isNewDeletion = false;
            }
            const baseMarks = node.marks.filter(
              (m: any) => m.type.name !== 'deletion' && m.type.name !== 'insertion'
            );
            const mark = existingDeletion
              ?? deletionMarkType.create({ user: userNameRef.current, timestamp, changeId });

            if (node.isText) {
              const text = node.text.slice(start - pos, end - pos);
              if (!text) return false;
              nodes.push(newState.schema.text(text, [...baseMarks, mark]));
              if (!existingDeletion) loggedText += text;
            } else if (node.isLeaf) {
              nodes.push(node.mark([...baseMarks, mark]));
            }
            return false;
          });

          if (nodes.length === 0) continue;

          // Cursor intent: empty selection, head at range end = Backspace; at start = Delete.
          let cursor: 'before' | 'after' | null = null;
          const sel = oldState.selection;
          if (sel.empty && transaction.steps.length === 1) {
            if (sel.head === cls.to) cursor = 'before';
            else if (sel.head === cls.from) cursor = 'after';
          }

          reinserts.push({
            pos: reinsertPos,
            nodes, cursor, loggedText, changeId, timestamp, isNewDeletion,
          });
        }
      }

      if (reinserts.length === 0 && insertionRanges.length === 0) return null;

      let tr = newState.tr;
      let cursorTarget: number | null = null;

      // Re-inserts first, highest position first, so earlier positions stay valid.
      reinserts.sort((a, b) => b.pos - a.pos);
      for (const op of reinserts) {
        const frag = Fragment.from(op.nodes);
        tr = tr.insert(op.pos, frag);
        if (op.cursor === 'before') cursorTarget = op.pos;
        else if (op.cursor === 'after') cursorTarget = op.pos + frag.size;
        if (op.loggedText && op.isNewDeletion && onChangeLogged) {
          onChangeLogged({
            id: op.changeId, type: 'deletion', text: op.loggedText,
            user: userNameRef.current, timestamp: op.timestamp,
            from: op.pos, to: op.pos + frag.size,
          });
        }
      }

      // Insertion marks second, mapped through the re-inserts.
      const insertionMarkType = newState.schema.marks.insertion;
      const deletionMarkType = newState.schema.marks.deletion;
      const author = userNameRef.current;
      for (const op of insertionRanges) {
        const text = newState.doc.textBetween(op.from, op.to, '\u0001', '\u0001');
        if (!text) continue; // structure-only insert (e.g. Enter) — nothing to mark
        const from = tr.mapping.map(op.from, 1);
        const to = tr.mapping.map(op.to, -1);
        if (to <= from) continue;

        const adjacent = findAdjacentInsertionMark(tr.doc, from, to, author);
        const isNewChange = !adjacent;
        const changeId = adjacent?.changeId ?? newChangeId();
        const timestamp = adjacent?.timestamp ?? new Date().toISOString();

        // Strip deletion marks inherited at deletion boundaries before marking insertion.
        tr = tr.removeMark(from, to, deletionMarkType);
        tr = tr.addMark(from, to, insertionMarkType.create({
          user: author, timestamp, changeId,
        }));
        if (isNewChange && onChangeLogged) {
          onChangeLogged({
            id: changeId, type: 'insertion', text: tr.doc.textBetween(from, to, ' '),
            user: author, timestamp, from, to,
          });
        }
      }

      if (tr.steps.length === 0 && cursorTarget === null) return null;
      if (cursorTarget !== null) {
        const clamped = Math.max(1, Math.min(cursorTarget, tr.doc.content.size));
        tr = tr.setSelection(TextSelection.create(tr.doc, clamped));
      }
      tr.setMeta('trackChangesApply', true);
      return tr;
    },

    props: {
      handleDOMEvents: {
        compositionstart: () => { composingRef.current = true; return false; },
        compositionend: () => { composingRef.current = false; return false; },
      },
    },
  });
}

export interface TrackedChange {
  id: string;
  type: 'insertion' | 'deletion';
  text: string;
  originalText?: string;
  user: string;
  timestamp: string;
  from: number;
  to: number;
}

export interface TrackChangeAuditRecord {
  changeId: string;
  changeType: 'insertion' | 'deletion';
  text: string;
  author: string;
  changeTimestamp: string;
}

function collectChangeRecords(doc: any, filterChangeIds?: string[]): TrackChangeAuditRecord[] {
  const filterSet = filterChangeIds ? new Set(filterChangeIds) : null;
  const byId = new Map<string, {
    fragments: { pos: number; text: string }[];
    changeType: 'insertion' | 'deletion';
    author: string;
    changeTimestamp: string;
  }>();

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    node.marks.forEach((mark: any) => {
      if (mark.type.name !== 'insertion' && mark.type.name !== 'deletion') return;
      const changeId = mark.attrs.changeId;
      if (!changeId) return;
      if (filterSet && !filterSet.has(changeId)) return;

      if (!byId.has(changeId)) {
        byId.set(changeId, {
          fragments: [],
          changeType: mark.type.name,
          author: mark.attrs.user || 'Unknown',
          changeTimestamp: mark.attrs.timestamp || new Date().toISOString(),
        });
      }
      byId.get(changeId)!.fragments.push({ pos, text: node.text || '' });
    });
  });

  return Array.from(byId.entries()).map(([changeId, { fragments, changeType, author, changeTimestamp }]) => {
    fragments.sort((a, b) => a.pos - b.pos);
    return {
      changeId,
      changeType,
      text: fragments.map(f => f.text).join(''),
      author,
      changeTimestamp,
    };
  });
}

export interface LegalFieldContext {
  clientName?: string;
  matterRef?: string;
  solicitorName?: string;
  firmName?: string;
}

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
  /** When true (read-only review), turn @@RGAP:N@@ tokens into jump targets. */
  hydrateGapAnchors?: boolean;
  placeholder?: string;
  focusMode?: boolean;
  onFocusModeToggle?: () => void;
  zoom?: number;
  trackChangesEnabled?: boolean;
  onTrackChangesToggle?: (enabled: boolean) => void;
  onTrackChangeAction?: (action: 'accept' | 'reject' | 'accept_all' | 'reject_all', changes: TrackChangeAuditRecord[]) => void;
  onAddComment?: (selectedText: string) => void;
  onRedact?: (redactedText: string) => void;
  legalContext?: LegalFieldContext;
}

export function RichTextEditor({ 
  content, onChange, disabled, hydrateGapAnchors = false, placeholder, focusMode, onFocusModeToggle, zoom = 100,
  trackChangesEnabled = false, onTrackChangesToggle, onTrackChangeAction, onAddComment,
  onRedact, legalContext,
}: RichTextEditorProps) {
  const isUpdatingRef = useRef(false);
  const isTrackingRef = useRef(trackChangesEnabled);
  const { user } = useAuth();
  const userNameRef = useRef<string>('Solicitor');
  const composingRef = useRef<boolean>(false);
  const [structuralNotice, setStructuralNotice] = useState(false);
  const structuralNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    userNameRef.current = (user?.firstName && user?.lastName)
      ? `${user.firstName} ${user.lastName}`
      : (user?.email ? user.email.split('@')[0] : 'Solicitor');
  }, [user]);

  useEffect(() => () => {
    if (structuralNoticeTimerRef.current) clearTimeout(structuralNoticeTimerRef.current);
  }, []);

  const handleStructuralBlocked = useCallback(() => {
    setStructuralNotice(true);
    if (structuralNoticeTimerRef.current) clearTimeout(structuralNoticeTimerRef.current);
    structuralNoticeTimerRef.current = setTimeout(() => setStructuralNotice(false), 4000);
  }, []);
  const lastEmittedContentRef = useRef<string>('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState(0);
  const [trackedChanges, setTrackedChanges] = useState<TrackedChange[]>([]);
  const [changeCount, setChangeCount] = useState(0);

  useEffect(() => {
    isTrackingRef.current = trackChangesEnabled;
  }, [trackChangesEnabled]);

  const handleChangeLogged = useCallback((change: TrackedChange) => {
    setTrackedChanges(prev => [...prev, change]);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: placeholder || 'Start typing...' }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight.configure({ multicolor: false }),
      Superscript,
      Subscript,
      CharacterCount,
      InsertionMark,
      DeletionMark,
      RedactionMark,
      LegalFieldNode,
      Extension.create({
        name: 'listKeyboardShortcuts',
        addKeyboardShortcuts() {
          return {
            Backspace: ({ editor }) => {
              const { state } = editor;
              const { $from, empty } = state.selection;
              if (!empty || $from.parentOffset !== 0) return false;

              const isEmptyParagraphInList =
                $from.parent.type.name === 'paragraph' &&
                $from.parent.textContent === '' &&
                $from.depth >= 2 &&
                $from.node($from.depth - 1).type.name === 'listItem';

              const isEmptyListItem =
                $from.parent.type.name === 'listItem' &&
                $from.parent.textContent === '';

              if (isEmptyParagraphInList || isEmptyListItem) {
                return editor.chain().liftListItem('listItem').run();
              }
              return false;
            },
            Delete: ({ editor }) => {
              const { state } = editor;
              const { $from, empty } = state.selection;
              if (!empty || $from.parentOffset !== 0) return false;

              if ($from.parent.textContent === '' && $from.depth >= 2 && $from.node($from.depth - 1).type.name === 'listItem') {
                return editor.chain().liftListItem('listItem').run();
              }
              return false;
            },
            Enter: ({ editor }) => {
              const { state } = editor;
              const { $from, empty } = state.selection;
              if (!empty) return false;

              const isInList = $from.depth >= 2 && $from.node($from.depth - 1).type.name === 'listItem';
              if (isInList && $from.parent.textContent === '') {
                return editor.chain().liftListItem('listItem').run();
              }
              return false;
            },
            Tab: ({ editor }) => {
              const { state } = editor;
              const { $from } = state.selection;
              if ($from.depth >= 2 && $from.node($from.depth - 1).type.name === 'listItem') {
                return editor.chain().sinkListItem('listItem').run();
              }
              return false;
            },
            'Shift-Tab': ({ editor }) => {
              const { state } = editor;
              const { $from } = state.selection;
              if ($from.depth >= 2 && $from.node($from.depth - 1).type.name === 'listItem') {
                return editor.chain().liftListItem('listItem').run();
              }
              return false;
            },
          };
        },
      }),
      PaginationPlus.configure({
        pageHeight: 1122,
        pageWidth: 794,
        pageGap: 48,
        pageGapBorderSize: 1,
        marginTop: 96,
        marginBottom: 96,
        marginLeft: 120,
        marginRight: 120,
      }),
    ],
    content: '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] text-foreground',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;
      // Read-only view mode: never emit content changes (avoids render loops
      // when display content is transformed before setContent).
      if (!editor.isEditable) return;
      const hasTrackMarks = (() => {
        let found = false;
        editor.state.doc.descendants((node: any) => {
          if (found) return false;
          if (node.isText && node.marks.some((m: any) => m.type.name === 'insertion' || m.type.name === 'deletion')) {
            found = true; return false;
          }
        });
        return found;
      })();
      const content = hasTrackMarks
        ? editor.getHTML()
        : editor.storage.markdown.getMarkdown();
      lastEmittedContentRef.current = content;
      onChange(content);

      const { from } = editor.state.selection;
      const text = editor.state.doc.textBetween(Math.max(0, from - 30), from);
      const lastWord = text.split(/\s/).pop()?.toLowerCase() || '';
      if (lastWord.length >= 3) {
        const matches = LEGAL_AUTOCOMPLETE_PHRASES.filter(p => 
          p.toLowerCase().startsWith(lastWord) && p.toLowerCase() !== lastWord
        );
        if (matches.length > 0) {
          setAutocompleteOptions(matches.slice(0, 5));
          setAutocompleteVisible(true);
          setSelectedOption(0);
        } else {
          setAutocompleteVisible(false);
        }
      } else {
        setAutocompleteVisible(false);
      }

      scanForTrackedChanges(editor);
    },
  });

  useEffect(() => {
    if (!editor) return;

    const plugin = createTrackChangesPlugin(isTrackingRef, isUpdatingRef, userNameRef, composingRef, handleChangeLogged, handleStructuralBlocked);
    const { state } = editor;
    const newState = state.reconfigure({
      plugins: [...state.plugins.filter(p => p.spec.key !== trackChangesPluginKey), plugin],
    });
    editor.view.updateState(newState);
  }, [editor, handleChangeLogged, handleStructuralBlocked]);

  const scanForTrackedChanges = useCallback((editorInstance: any) => {
    if (!editorInstance) return;
    const { doc } = editorInstance.state;
    const byId = new Map<string, {
      type: 'insertion' | 'deletion';
      fragments: { pos: number; text: string; originalText?: string | null }[];
      user: string;
      timestamp: string;
    }>();

    doc.descendants((node: any, pos: number) => {
      if (!node.isText) return;
      node.marks.forEach((mark: any) => {
        if (mark.type.name !== 'insertion' && mark.type.name !== 'deletion') return;
        const id = mark.attrs.changeId || `tc-scan-${pos}`;
        if (!byId.has(id)) {
          byId.set(id, {
            type: mark.type.name,
            fragments: [],
            user: mark.attrs.user || 'Unknown',
            timestamp: mark.attrs.timestamp || new Date().toISOString(),
          });
        }
        byId.get(id)!.fragments.push({
          pos,
          text: node.text || '',
          originalText: mark.attrs.originalText,
        });
      });
    });

    const aggregated: TrackedChange[] = Array.from(byId.entries()).map(([id, { type, fragments, user, timestamp }]) => {
      fragments.sort((a, b) => a.pos - b.pos);
      const from = fragments[0].pos;
      const last = fragments[fragments.length - 1];
      return {
        id,
        type,
        text: fragments.map(f => f.text).join(''),
        originalText: type === 'deletion'
          ? (fragments.find(f => f.originalText)?.originalText ?? undefined)
          : undefined,
        user,
        timestamp,
        from,
        to: last.pos + last.text.length,
      };
    });

    setTrackedChanges(aggregated);
    setChangeCount(aggregated.length);
  }, []);

  useEffect(() => {
    if (!editor || disabled || !trackChangesEnabled) return;
    scanForTrackedChanges(editor);
  }, [editor, disabled, trackChangesEnabled, scanForTrackedChanges]);

  const acceptChange = useCallback((changeId: string) => {
    if (!editor) return;
    const { doc, tr } = editor.state;
    const auditRecords = collectChangeRecords(doc, [changeId]);
    let modified = false;

    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        node.marks.forEach((mark: any) => {
          if ((mark.type.name === 'insertion' || mark.type.name === 'deletion') && mark.attrs.changeId === changeId) {
            if (mark.type.name === 'insertion') {
              tr.removeMark(pos, pos + node.text.length, mark.type);
              modified = true;
            } else if (mark.type.name === 'deletion') {
              tr.delete(pos, pos + node.text.length);
              modified = true;
            }
          }
        });
      }
    });

    if (modified) {
      tr.setMeta('trackChangesApply', true);
      editor.view.dispatch(tr);
      scanForTrackedChanges(editor);
      if (auditRecords.length > 0) onTrackChangeAction?.('accept', auditRecords);
    }
  }, [editor, scanForTrackedChanges, onTrackChangeAction]);

  const rejectChange = useCallback((changeId: string) => {
    if (!editor) return;
    const { doc, tr } = editor.state;
    const auditRecords = collectChangeRecords(doc, [changeId]);
    let modified = false;

    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        node.marks.forEach((mark: any) => {
          if ((mark.type.name === 'insertion' || mark.type.name === 'deletion') && mark.attrs.changeId === changeId) {
            if (mark.type.name === 'insertion') {
              tr.delete(pos, pos + node.text.length);
              modified = true;
            } else if (mark.type.name === 'deletion') {
              tr.removeMark(pos, pos + node.text.length, mark.type);
              modified = true;
            }
          }
        });
      }
    });

    if (modified) {
      tr.setMeta('trackChangesApply', true);
      editor.view.dispatch(tr);
      scanForTrackedChanges(editor);
      if (auditRecords.length > 0) onTrackChangeAction?.('reject', auditRecords);
    }
  }, [editor, scanForTrackedChanges, onTrackChangeAction]);

  const acceptAllChanges = useCallback(() => {
    if (!editor) return;
    const { doc } = editor.state;
    const auditRecords = collectChangeRecords(doc);
    let { tr } = editor.state;

    const marksToProcess: Array<{ pos: number; end: number; type: string; mark: any }> = [];
    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        node.marks.forEach((mark: any) => {
          if (mark.type.name === 'insertion' || mark.type.name === 'deletion') {
            marksToProcess.push({ pos, end: pos + node.text.length, type: mark.type.name, mark });
          }
        });
      }
    });

    marksToProcess.sort((a, b) => b.pos - a.pos);

    for (const item of marksToProcess) {
      if (item.type === 'insertion') {
        tr = tr.removeMark(item.pos, item.end, item.mark.type);
      } else if (item.type === 'deletion') {
        tr = tr.delete(item.pos, item.end);
      }
    }

    tr.setMeta('trackChangesApply', true);
    editor.view.dispatch(tr);
    scanForTrackedChanges(editor);
    if (auditRecords.length > 0) onTrackChangeAction?.('accept_all', auditRecords);
  }, [editor, scanForTrackedChanges, onTrackChangeAction]);

  const rejectAllChanges = useCallback(() => {
    if (!editor) return;
    const { doc } = editor.state;
    const auditRecords = collectChangeRecords(doc);
    let { tr } = editor.state;

    const marksToProcess: Array<{ pos: number; end: number; type: string; mark: any }> = [];
    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        node.marks.forEach((mark: any) => {
          if (mark.type.name === 'insertion' || mark.type.name === 'deletion') {
            marksToProcess.push({ pos, end: pos + node.text.length, type: mark.type.name, mark });
          }
        });
      }
    });

    marksToProcess.sort((a, b) => b.pos - a.pos);

    for (const item of marksToProcess) {
      if (item.type === 'insertion') {
        tr = tr.delete(item.pos, item.end);
      } else if (item.type === 'deletion') {
        tr = tr.removeMark(item.pos, item.end, item.mark.type);
      }
    }

    tr.setMeta('trackChangesApply', true);
    editor.view.dispatch(tr);
    scanForTrackedChanges(editor);
    if (auditRecords.length > 0) onTrackChangeAction?.('reject_all', auditRecords);
  }, [editor, scanForTrackedChanges, onTrackChangeAction]);

  useEffect(() => {
    if (!editor) return;
    if (content === lastEmittedContentRef.current) return;
    setTrackedChanges([]);
    setChangeCount(0);
    lastEmittedContentRef.current = content;
    isUpdatingRef.current = true;
    try {
      if (isTrackedChangesHtml(content)) {
        // Bypass tiptap-markdown's setContent (which always runs markdown-it) by passing JSON.
        const json = generateJSON(content, editor.extensionManager.extensions);
        editor.commands.setContent(json, false);
      } else {
        const processedContent = ensureBoldHeadings(content ?? '');
        editor.commands.setContent(processedContent, false);
      }
    } catch (err) {
      console.error('[RichTextEditor] Content hydration failed, falling back to raw:', err);
      editor.commands.setContent(content ?? '', false);
    } finally {
      requestAnimationFrame(() => {
        isUpdatingRef.current = false;
        if (hydrateGapAnchors && disabled && content?.includes("@@RGAP:")) {
          try {
            hydrateReasoningGapAnchorsInDom(editor.view.dom);
          } catch (hydrateErr) {
            console.error("[RichTextEditor] Gap anchor hydration failed:", hydrateErr);
          }
        }
        if (!disabled && trackChangesEnabled) {
          scanForTrackedChanges(editor);
        }
      });
    }
  }, [editor, content, disabled, hydrateGapAnchors, trackChangesEnabled, scanForTrackedChanges]);

  useEffect(() => {
    if (editor && disabled !== undefined) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  const applyAutocomplete = useCallback((phrase: string) => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const text = editor.state.doc.textBetween(Math.max(0, from - 30), from);
    const lastWord = text.split(/\s/).pop() || '';
    editor.chain().focus()
      .deleteRange({ from: from - lastWord.length, to: from })
      .insertContent(phrase + ' ')
      .run();
    setAutocompleteVisible(false);
  }, [editor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!autocompleteVisible) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedOption(p => Math.min(p + 1, autocompleteOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedOption(p => Math.max(p - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      if (autocompleteOptions[selectedOption]) {
        e.preventDefault();
        applyAutocomplete(autocompleteOptions[selectedOption]);
      }
    } else if (e.key === 'Escape') {
      setAutocompleteVisible(false);
    }
  }, [autocompleteVisible, autocompleteOptions, selectedOption, applyAutocomplete]);

  const handleSearch = useCallback(() => {
    if (!editor || !searchTerm) return;
    const content = editor.getHTML();
    const highlighted = content.replace(
      new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      match => `<mark>${match}</mark>`
    );
    isUpdatingRef.current = true;
    editor.commands.setContent(highlighted);
    requestAnimationFrame(() => { isUpdatingRef.current = false; });
  }, [editor, searchTerm]);

  const handleReplace = useCallback(() => {
    if (!editor || !searchTerm) return;
    const text = editor.getText();
    if (text.includes(searchTerm)) {
      const html = editor.getHTML();
      const replaced = html.replace(
        new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        replaceTerm
      );
      isUpdatingRef.current = true;
      editor.commands.setContent(replaced);
      requestAnimationFrame(() => { isUpdatingRef.current = false; });
    }
  }, [editor, searchTerm, replaceTerm]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const scrollToChange = useCallback((change: TrackedChange) => {
    if (!editor) return;
    try {
      editor.chain().focus().setTextSelection({ from: change.from, to: change.to }).run();
    } catch {
      // position may have shifted
    }
  }, [editor]);


  if (!editor) return null;

  const wordCount = editor.storage.characterCount?.words() ?? 0;
  const charCount = editor.storage.characterCount?.characters() ?? 0;

  const handleRedact = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;
    editor.chain().focus()
      .setMark('redaction', {
        redactedBy: userNameRef.current,
        redactedAt: new Date().toISOString(),
      })
      .run();
    if (onRedact) onRedact(selectedText);
  };

  const LEGAL_FIELDS: { type: LegalFieldType; label: string; icon: any; display: string }[] = [
    { type: 'clientName', label: 'Client Name', icon: User, display: legalContext?.clientName || '[Client Name]' },
    { type: 'matterRef', label: 'Matter Reference', icon: Hash, display: legalContext?.matterRef || '[Matter Ref]' },
    { type: 'date', label: 'Today\'s Date', icon: Calendar, display: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) },
    { type: 'solicitorName', label: 'Solicitor Name', icon: Briefcase, display: legalContext?.solicitorName || '[Solicitor Name]' },
    { type: 'firmName', label: 'Firm Name', icon: Building2, display: legalContext?.firmName || '[Firm Name]' },
  ];

  const insertLegalField = (fieldType: LegalFieldType) => {
    const field = LEGAL_FIELDS.find(f => f.type === fieldType);
    if (!editor || !field) return;
    editor.chain().focus().insertContent({
      type: 'legalField',
      attrs: { fieldType, fieldLabel: field.display },
    }).run();
  };

  const ToolbarButton = ({ 
    onClick, active, icon: Icon, tooltip, disabled: btnDisabled 
  }: { 
    onClick: () => void; active?: boolean; icon: any; tooltip: string; disabled?: boolean 
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={active ? 'secondary' : 'ghost'}
          onClick={onClick}
          disabled={btnDisabled ?? disabled}
          className="h-7 w-7"
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );

  const RibbonGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col items-center gap-0.5 px-2 border-r border-border/50 last:border-r-0">
      <span className="text-[9px] text-muted-foreground/70 uppercase tracking-wider leading-none select-none">{label}</span>
      <div className="flex items-center gap-0.5">
        {children}
      </div>
    </div>
  );

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    } catch { return ts; }
  };

  return (
    <div 
      className="rounded-md overflow-visible"
      style={{ fontSize: `${zoom}%` }}
    >
      {!disabled && (
        <div className="border border-border rounded-t-md bg-muted/40 backdrop-blur-sm sticky z-30" style={{ top: 'var(--doc-header-height, 0px)' }}>
          <div className="flex items-start gap-0 p-1.5 flex-wrap">
            <RibbonGroup label="Font">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={Bold} tooltip="Bold (Ctrl+B)" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={Italic} tooltip="Italic (Ctrl+I)" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={UnderlineIcon} tooltip="Underline (Ctrl+U)" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} icon={Highlighter} tooltip="Highlight" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} icon={SuperscriptIcon} tooltip="Superscript" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} icon={SubscriptIcon} tooltip="Subscript" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={Heading1} tooltip="Heading 1" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={Heading2} tooltip="Heading 2" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} icon={Heading3} tooltip="Heading 3" />
            </RibbonGroup>

            <RibbonGroup label="Paragraph">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={List} tooltip="Bullet List" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={ListOrdered} tooltip="Numbered List" />
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} icon={AlignLeft} tooltip="Align Left" />
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} icon={AlignCenter} tooltip="Align Centre" />
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} icon={AlignRight} tooltip="Align Right" />
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} icon={AlignJustify} tooltip="Justify" />
            </RibbonGroup>

            <RibbonGroup label="Insert">
              <ToolbarButton onClick={insertTable} active={false} icon={TableIcon} tooltip="Insert Table" />
              {onAddComment && (
                <ToolbarButton 
                  onClick={() => {
                    if (!editor) return;
                    const { from, to } = editor.state.selection;
                    if (from === to) return;
                    const selectedText = editor.state.doc.textBetween(from, to, ' ');
                    if (selectedText.trim()) onAddComment(selectedText.trim());
                  }} 
                  active={false} 
                  icon={MessageSquarePlus} 
                  tooltip="Add Comment (select text first)" 
                />
              )}
            </RibbonGroup>

            <RibbonGroup label="Legal">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleRedact}
                    disabled={disabled}
                    className="h-7 w-7"
                    data-testid="button-redact-selection"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redact selection (select text first)</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    className="h-7 gap-0.5 text-xs px-1.5"
                    data-testid="button-insert-field"
                  >
                    <Hash className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Field</span>
                    <ChevronDown className="h-2.5 w-2.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {LEGAL_FIELDS.map(f => (
                    <DropdownMenuItem
                      key={f.type}
                      onClick={() => insertLegalField(f.type)}
                      className="gap-2 text-xs"
                      data-testid={`menu-item-field-${f.type}`}
                    >
                      <f.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {f.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </RibbonGroup>

            <RibbonGroup label="Review">
              <ToolbarButton onClick={() => setShowSearch(s => !s)} active={showSearch} icon={Search} tooltip="Find & Replace" />
              {onTrackChangesToggle && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant={trackChangesEnabled ? 'default' : 'ghost'}
                      onClick={() => onTrackChangesToggle(!trackChangesEnabled)}
                      disabled={disabled}
                      className="gap-1 text-xs h-7"
                      data-testid="button-toggle-track-changes"
                    >
                      <GitCompareArrows className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Track</span>
                      {trackChangesEnabled && changeCount > 0 && (
                        <Badge variant="secondary" className="ml-0.5 text-[10px] px-1 py-0" data-testid="badge-change-count">
                          {changeCount}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{trackChangesEnabled ? 'Track Changes: ON' : 'Track Changes: OFF'}</TooltipContent>
                </Tooltip>
              )}
            </RibbonGroup>

            {onFocusModeToggle && (
              <RibbonGroup label="View">
                <ToolbarButton 
                  onClick={onFocusModeToggle} 
                  active={focusMode} 
                  icon={focusMode ? Minimize2 : Maximize2} 
                  tooltip={focusMode ? "Exit Focus Mode (Esc)" : "Focus Mode"} 
                />
              </RibbonGroup>
            )}
          </div>

          {trackChangesEnabled && changeCount > 0 && (
            <div className="flex items-center gap-2 px-3 pb-2 flex-wrap" data-testid="container-track-changes-actions">
              <span className="text-xs text-muted-foreground">{changeCount} change{changeCount !== 1 ? 's' : ''} pending</span>
              <Button
                size="sm"
                variant="outline"
                onClick={acceptAllChanges}
                className="gap-1 text-xs"
                data-testid="button-accept-all-changes"
              >
                <CheckCheck className="w-3 h-3" />
                Accept All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={rejectAllChanges}
                className="gap-1 text-xs"
                data-testid="button-reject-all-changes"
              >
                <XCircle className="w-3 h-3" />
                Reject All
              </Button>
            </div>
          )}

          {showSearch && (
            <div className="flex items-center gap-2 px-3 pb-2 flex-wrap">
              <Input
                placeholder="Find..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-7 text-xs w-36"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <Input
                placeholder="Replace with..."
                value={replaceTerm}
                onChange={e => setReplaceTerm(e.target.value)}
                className="h-7 text-xs w-36"
              />
              <Button size="sm" variant="outline" onClick={handleSearch} className="h-7 text-xs px-2">Find</Button>
              <Button size="sm" variant="outline" onClick={handleReplace} className="h-7 text-xs px-2">Replace All</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSearch(false)} className="h-7 text-xs px-2">Close</Button>
            </div>
          )}
        </div>
      )}

      <div className="flex">
        <div className={`relative flex-1 ${trackChangesEnabled && changeCount > 0 && !disabled ? 'min-w-0' : ''}`} onKeyDown={handleKeyDown}>
        {structuralNotice && (
          <div
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-900/40 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200 shadow-sm pointer-events-none"
            data-testid="notice-structural-blocked"
          >
            Structural deletions are blocked while Track Changes is on. Turn Track Changes off to delete table rows, columns, or list items.
          </div>
        )}
          <div className="bg-muted/30 dark:bg-muted/10 border-x border-border overflow-x-auto py-8">
            <div className="pagination-plus-host mx-auto">
              <EditorContent 
                editor={editor} 
                className="legal-document-editor
                  [&_.ProseMirror]:focus:outline-none
                  [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:mt-6
                  [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:mt-5
                  [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4
                  [&_.ProseMirror_>h1:first-child]:mt-0
                  [&_.ProseMirror_>h2:first-child]:mt-0
                  [&_.ProseMirror_>h3:first-child]:mt-0
                  [&_.ProseMirror_p]:mb-3 [&_.ProseMirror_p]:leading-relaxed
                  [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:mb-3
                  [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:mb-3
                  [&_.ProseMirror_li]:mb-1.5
                  [&_.ProseMirror_strong]:font-bold
                  [&_.ProseMirror_em]:italic
                  [&_.ProseMirror_u]:underline
                  [&_.ProseMirror_mark]:bg-yellow-200 [&_.ProseMirror_mark]:dark:bg-yellow-800
                  [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:my-4
                  [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:text-sm
                  [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_th]:bg-muted/40 [&_.ProseMirror_th]:text-sm
                  [&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground
                  [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
                  [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left
                  [&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none
                  [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0
                  [&_.track-change-insertion]:bg-green-100 [&_.track-change-insertion]:dark:bg-green-900/40 [&_.track-change-insertion]:text-green-800 [&_.track-change-insertion]:dark:text-green-200 [&_.track-change-insertion]:no-underline [&_.track-change-insertion]:border-b-2 [&_.track-change-insertion]:border-green-400 [&_.track-change-insertion]:dark:border-green-600
                  [&_.track-change-deletion]:bg-red-100 [&_.track-change-deletion]:dark:bg-red-900/40 [&_.track-change-deletion]:text-red-800 [&_.track-change-deletion]:dark:text-red-200 [&_.track-change-deletion]:line-through"
                data-testid="editor-rich-text"
              />
            </div>
          </div>

          {autocompleteVisible && autocompleteOptions.length > 0 && (() => {
            const sel = window.getSelection();
            const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
            const rect = range ? range.getBoundingClientRect() : null;
            const containerRect = (document.querySelector('.legal-document-editor') as HTMLElement)?.getBoundingClientRect();
            const top = rect && containerRect ? rect.bottom - containerRect.top + 4 : 40;
            const left = rect && containerRect ? Math.min(rect.left - containerRect.left, containerRect.width - 220) : 16;
            return (
            <div className="absolute z-50 bg-popover border border-border rounded-md shadow-md overflow-hidden"
              style={{ top: `${top}px`, left: `${Math.max(left, 8)}px`, minWidth: '200px' }}
            >
              {autocompleteOptions.map((opt, i) => (
                <button
                  key={opt}
                  className={`w-full text-left px-3 py-1.5 text-sm ${i === selectedOption ? 'bg-accent text-accent-foreground' : 'hover-elevate'}`}
                  onMouseDown={e => { e.preventDefault(); applyAutocomplete(opt); }}
                >
                  {opt}
                </button>
              ))}
              <div className="px-3 py-1 text-xs text-muted-foreground border-t border-border">
                Tab to complete
              </div>
            </div>
            );
          })()}
        </div>

        {trackChangesEnabled && changeCount > 0 && !disabled && (
          <div className="w-64 border-l border-border bg-muted/10 overflow-y-auto max-h-[500px] flex-shrink-0" data-testid="panel-tracked-changes">
            <div className="p-2 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground">Tracked Changes</span>
            </div>
            <div className="divide-y divide-border">
              {trackedChanges.map((change) => (
                <div 
                  key={change.id} 
                  className="p-2 hover-elevate cursor-pointer"
                  onClick={() => scrollToChange(change)}
                  data-testid={`tracked-change-${change.id}`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <Badge 
                      variant={change.type === 'insertion' ? 'default' : 'destructive'} 
                      className={`text-[10px] px-1.5 py-0 ${change.type === 'insertion' ? 'bg-green-600' : ''}`}
                    >
                      {change.type === 'insertion' ? 'Added' : 'Deleted'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{formatTimestamp(change.timestamp)}</span>
                  </div>
                  <p className={`text-xs truncate mb-1.5 ${change.type === 'insertion' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300 line-through'}`}>
                    {change.text.substring(0, 60)}{change.text.length > 60 ? '...' : ''}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); acceptChange(change.id); }}
                      className="h-5 text-[10px] px-1.5 gap-0.5 text-green-700 dark:text-green-400"
                      data-testid={`button-accept-change-${change.id}`}
                    >
                      <Check className="w-3 h-3" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); rejectChange(change.id); }}
                      className="h-5 text-[10px] px-1.5 gap-0.5 text-red-700 dark:text-red-400"
                      data-testid={`button-reject-change-${change.id}`}
                    >
                      <X className="w-3 h-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!disabled && (
        <div className="flex items-center justify-between px-3 py-1.5 border border-border border-t-0 rounded-b-md bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Type className="w-3 h-3" />
            <span>{wordCount} words</span>
            <span className="ml-2">{charCount} characters</span>
          </div>
          {trackChangesEnabled && (
            <div className="flex items-center gap-1" data-testid="indicator-track-changes-status">
              <GitCompareArrows className="w-3 h-3 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">Track Changes ON</span>
              {changeCount > 0 && <span>({changeCount} pending)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
