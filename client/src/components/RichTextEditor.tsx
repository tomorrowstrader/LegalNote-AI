import { useEffect, useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import CharacterCount from '@tiptap/extension-character-count';
import { Mark, Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
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

function ensureBoldHeadings(content: string): string {
  if (!content) return content;
  
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

const InsertionMark = Mark.create({
  name: 'insertion',
  addAttributes() {
    return {
      user: { default: null },
      timestamp: { default: null },
      changeId: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'ins[data-track-change]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ins', mergeAttributes(HTMLAttributes, { 'data-track-change': 'insertion', class: 'track-change-insertion' }), 0];
  },
});

const DeletionMark = Mark.create({
  name: 'deletion',
  addAttributes() {
    return {
      user: { default: null },
      timestamp: { default: null },
      originalText: { default: null },
      changeId: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'del[data-track-change]' }];
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
  deletionBufferRef: React.MutableRefObject<TrackedChange[]>,
  onChangeLogged?: (change: TrackedChange) => void
) {
  return new Plugin({
    key: trackChangesPluginKey,
    filterTransaction(transaction, state) {
      if (!isTrackingRef.current) return true;
      if (!transaction.docChanged) return true;
      if (transaction.getMeta('trackChangesApply')) return true;

      let hasPureDeletion = false;
      const deletions: Array<{ from: number; to: number }> = [];

      transaction.steps.forEach((step: any) => {
        if (step.from !== undefined && step.to !== undefined && step.from < step.to) {
          const insertedSize = step.slice ? step.slice.content.size : 0;
          if (insertedSize === 0) {
            hasPureDeletion = true;
            deletions.push({ from: step.from, to: step.to });
          }
        }
      });

      if (hasPureDeletion && deletions.length > 0) {
        const tr = state.tr;
        tr.setMeta('trackChangesApply', true);
        for (const del of deletions) {
          const from = Math.max(del.from, 0);
          const to = Math.min(del.to, state.doc.content.size);
          if (to > from) {
            const changeId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const timestamp = new Date().toISOString();
            const deletedText = state.doc.textBetween(from, to, ' ');
            const deletionMark = state.schema.marks.deletion.create({
              user: 'Solicitor',
              timestamp,
              changeId,
            });
            tr.addMark(from, to, deletionMark);
            const change: TrackedChange = {
              id: changeId,
              type: 'deletion',
              text: deletedText,
              user: 'Solicitor',
              timestamp,
              from,
              to,
            };
            deletionBufferRef.current.push(change);
            if (onChangeLogged) {
              onChangeLogged(change);
            }
          }
        }
        if (tr.steps.length > 0) {
          setTimeout(() => {
            const view = (window as any).__tiptapEditorView;
            if (view) view.dispatch(tr);
          }, 0);
        }
        return false;
      }

      return true;
    },
    appendTransaction(transactions, _oldState, newState) {
      if (!isTrackingRef.current) return null;

      const docChanged = transactions.some(tr => tr.docChanged && !tr.getMeta('trackChangesApply'));
      if (!docChanged) return null;

      let tr = newState.tr;
      let modified = false;

      for (const transaction of transactions) {
        if (!transaction.docChanged || transaction.getMeta('trackChangesApply')) continue;

        transaction.steps.forEach((step) => {
          const stepMap = step.getMap();
          stepMap.forEach((oldStart: number, oldEnd: number, newStart: number, newEnd: number) => {
            const changeId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const timestamp = new Date().toISOString();

            if (newEnd > newStart) {
              const clampedStart = Math.max(newStart, 1);
              const clampedEnd = Math.min(newEnd, newState.doc.content.size);
              if (clampedEnd > clampedStart) {
                const insertionMark = newState.schema.marks.insertion.create({
                  user: 'Solicitor',
                  timestamp,
                  changeId,
                });
                tr = tr.addMark(clampedStart, clampedEnd, insertionMark);
                modified = true;

                if (onChangeLogged) {
                  const insertedText = newState.doc.textBetween(clampedStart, clampedEnd, ' ');
                  onChangeLogged({
                    id: changeId,
                    type: 'insertion',
                    text: insertedText,
                    user: 'Solicitor',
                    timestamp,
                    from: clampedStart,
                    to: clampedEnd,
                  });
                }
              }
            }
          });
        });
      }

      if (modified) {
        tr.setMeta('trackChangesApply', true);
        return tr;
      }
      return null;
    },
    view(editorView) {
      (window as any).__tiptapEditorView = editorView;
      return {
        destroy() {
          delete (window as any).__tiptapEditorView;
        },
      };
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
  placeholder?: string;
  focusMode?: boolean;
  onFocusModeToggle?: () => void;
  zoom?: number;
  trackChangesEnabled?: boolean;
  onTrackChangesToggle?: (enabled: boolean) => void;
  onTrackChangeAction?: (action: 'accept' | 'reject' | 'accept_all' | 'reject_all', changeId?: string) => void;
  onAddComment?: (selectedText: string) => void;
  onRedact?: (redactedText: string) => void;
  legalContext?: LegalFieldContext;
}

export function RichTextEditor({ 
  content, onChange, disabled, placeholder, focusMode, onFocusModeToggle, zoom = 100,
  trackChangesEnabled = false, onTrackChangesToggle, onTrackChangeAction, onAddComment,
  onRedact, legalContext,
}: RichTextEditorProps) {
  const isUpdatingRef = useRef(false);
  const isTrackingRef = useRef(trackChangesEnabled);
  const deletionBufferRef = useRef<TrackedChange[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState(0);
  const [trackedChanges, setTrackedChanges] = useState<TrackedChange[]>([]);
  const [changeCount, setChangeCount] = useState(0);
  const [numPageBreaks, setNumPageBreaks] = useState(0);
  const pageCardRef = useRef<HTMLDivElement>(null);

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
      Underline,
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
      const markdown = editor.storage.markdown.getMarkdown();
      onChange(markdown);

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

    const plugin = createTrackChangesPlugin(isTrackingRef, deletionBufferRef, handleChangeLogged);
    const { state } = editor;
    const newState = state.reconfigure({
      plugins: [...state.plugins.filter(p => p.spec.key !== trackChangesPluginKey), plugin],
    });
    editor.view.updateState(newState);
  }, [editor, handleChangeLogged]);

  const scanForTrackedChanges = useCallback((editorInstance: any) => {
    if (!editorInstance) return;
    const changes: TrackedChange[] = [];
    const { doc } = editorInstance.state;

    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        node.marks.forEach((mark: any) => {
          if (mark.type.name === 'insertion') {
            changes.push({
              id: mark.attrs.changeId || `tc-scan-${pos}`,
              type: 'insertion',
              text: node.text || '',
              user: mark.attrs.user || 'Unknown',
              timestamp: mark.attrs.timestamp || new Date().toISOString(),
              from: pos,
              to: pos + (node.text?.length || 0),
            });
          } else if (mark.type.name === 'deletion') {
            changes.push({
              id: mark.attrs.changeId || `tc-scan-${pos}`,
              type: 'deletion',
              text: node.text || '',
              originalText: mark.attrs.originalText,
              user: mark.attrs.user || 'Unknown',
              timestamp: mark.attrs.timestamp || new Date().toISOString(),
              from: pos,
              to: pos + (node.text?.length || 0),
            });
          }
        });
      }
    });

    setTrackedChanges(changes);
    setChangeCount(changes.length);
  }, []);

  useEffect(() => {
    if (editor) {
      scanForTrackedChanges(editor);
    }
  }, [editor, scanForTrackedChanges]);

  const acceptChange = useCallback((changeId: string) => {
    if (!editor) return;
    const { doc, tr } = editor.state;
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
      onTrackChangeAction?.('accept', changeId);
    }
  }, [editor, scanForTrackedChanges, onTrackChangeAction]);

  const rejectChange = useCallback((changeId: string) => {
    if (!editor) return;
    const { doc, tr } = editor.state;
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
      onTrackChangeAction?.('reject', changeId);
    }
  }, [editor, scanForTrackedChanges, onTrackChangeAction]);

  const acceptAllChanges = useCallback(() => {
    if (!editor) return;
    const { doc } = editor.state;
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
    onTrackChangeAction?.('accept_all');
  }, [editor, scanForTrackedChanges, onTrackChangeAction]);

  const rejectAllChanges = useCallback(() => {
    if (!editor) return;
    const { doc } = editor.state;
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
    onTrackChangeAction?.('reject_all');
  }, [editor, scanForTrackedChanges, onTrackChangeAction]);

  useEffect(() => {
    if (!editor) return;
    const currentMarkdown = editor.storage.markdown?.getMarkdown() ?? '';
    if (content === currentMarkdown) return;
    isUpdatingRef.current = true;
    try {
      const processedContent = ensureBoldHeadings(content ?? '');
      const doc = editor.storage.markdown.parser.parse(processedContent).toJSON();
      editor.commands.setContent(doc, false);
    } catch (err) {
      console.error('[RichTextEditor] Markdown hydration failed, falling back to raw:', err);
      editor.commands.setContent(content ?? '', false);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [editor, content]);

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
    editor.commands.setContent(highlighted);
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
      editor.commands.setContent(replaced);
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

  // ResizeObserver for paginated page break labels
  useEffect(() => {
    if (!pageCardRef.current) return;
    const el = pageCardRef.current;
    const A4_H = 1122;
    const GUTTER_H = 32;
    const observer = new ResizeObserver(() => {
      const h = el.scrollHeight;
      const breaks = Math.max(0, Math.floor(h / (A4_H + GUTTER_H)));
      setNumPageBreaks(breaks);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
        redactedBy: 'Solicitor',
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
        <div className="border border-border rounded-t-md bg-muted/40 backdrop-blur-sm">
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
          <div className="bg-muted/30 dark:bg-muted/10 border-x border-border overflow-x-auto">
            <div
              ref={pageCardRef}
              className="paginated-page-card shadow-md mx-auto"
            >
              {numPageBreaks > 0 && Array.from({ length: numPageBreaks }).map((_, i) => (
                <div
                  key={i}
                  className="page-gutter-label"
                  style={{ top: `${(i + 1) * 1122 + i * 32}px` }}
                >
                  <span>Page {i + 2}</span>
                </div>
              ))}
              <EditorContent 
                editor={editor} 
                className="legal-document-editor
                  [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:focus:outline-none
                  [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:mt-6
                  [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:mt-5
                  [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4
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

          {autocompleteVisible && autocompleteOptions.length > 0 && (
            <div className="absolute z-50 left-4 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden"
              style={{ top: '2.5rem' }}
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
          )}
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
