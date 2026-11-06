import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { Mark, Node, mergeAttributes, generateJSON } from '@tiptap/core';
import { Markdown } from 'tiptap-markdown';
import { FileText } from "lucide-react";
import { enrichGapCitationChips, hydrateReasoningGapAnchorsInHtml } from "@/lib/reasoningGapAnchors";
import { isEditorHtml, repairNameAutolinks } from "@shared/editorHtml";
import { isWholePiece, planPages, type PlanBlock, type PlanPiece, type PlanUnit } from "@shared/pageBreakPlan";

// A4 layout constants matching the editor (Word/Docs 1" margins @ 96dpi)
const PAGE_W    = 794;   // A4 width in px
const MARGIN_H  = 96;    // left/right horizontal margin (1 inch)
const MARGIN_V  = 96;    // top/bottom vertical margin per page (1 inch)
const CONTENT_W = PAGE_W - 2 * MARGIN_H; // 602px – content column width
const CONTENT_H = 930;   // usable content height per page (1122 - 96 - 96)

// ---------------------------------------------------------------------------
// Minimal custom marks/nodes for rendering stored content correctly.
// These mirror the ones in RichTextEditor but are stripped to rendering only.
// ---------------------------------------------------------------------------

function trackChangeAttrsFromElement(el: HTMLElement) {
  return {
    user: el.getAttribute('user'),
    timestamp: el.getAttribute('timestamp'),
    changeId: el.getAttribute('changeid') || el.getAttribute('changeId'),
  };
}

function isTrackedChangesHtml(content: string): boolean {
  return /<(?:ins|del|span)\b[^>]*\bdata-track-change\s*=/i.test(content);
}

const InsertionMark = Mark.create({
  name: 'insertion',
  priority: 1000,
  addAttributes() {
    return {
      user: { default: null },
      timestamp: { default: null },
      changeId: { default: null },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-track-change': 'insertion', class: 'track-change-insertion' }), 0];
  },
  parseHTML() {
    return [
      { tag: 'ins[data-track-change]', getAttrs: trackChangeAttrsFromElement },
      { tag: 'ins.track-change-insertion', getAttrs: trackChangeAttrsFromElement },
      { tag: 'span.track-change-insertion', getAttrs: trackChangeAttrsFromElement },
    ];
  },
});

const DeletionMark = Mark.create({
  name: 'deletion',
  priority: 1000,
  addAttributes() {
    return {
      user: { default: null },
      timestamp: { default: null },
      changeId: { default: null },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-track-change': 'deletion', class: 'track-change-deletion' }), 0];
  },
  parseHTML() {
    return [
      { tag: 'del[data-track-change]', getAttrs: trackChangeAttrsFromElement },
      { tag: 'del.track-change-deletion', getAttrs: trackChangeAttrsFromElement },
      { tag: 'span.track-change-deletion', getAttrs: trackChangeAttrsFromElement },
    ];
  },
});

const RedactionMark = Mark.create({
  name: 'redaction',
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'redaction-mark' }), 0];
  },
  parseHTML() { return [{ tag: 'span.redaction-mark' }]; },
});

const LegalFieldNode = Node.create({
  name: 'legalField',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      fieldType: { default: 'client_name' },
      value: { default: '' },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'legal-field-token', 'data-field-type': node.attrs.fieldType }),
      node.attrs.value || `[${node.attrs.fieldType}]`,
    ];
  },
  parseHTML() { return [{ tag: 'span.legal-field-token' }]; },
});

// ---------------------------------------------------------------------------
// PageView component
// ---------------------------------------------------------------------------

interface PageViewProps {
  content: string;
  /** Labels for @@RGAP:N@@ anchors, in document order, so chips show the specific gap. */
  gapAnchorLabels?: string[];
  legalContext?: {
    clientName?: string;
    matterRef?: string;
    solicitorName?: string;
    firmName?: string;
  };
}

// ---------------------------------------------------------------------------
// Page breaks: measure each block so a long paragraph or list can carry on
// over the page break, and a short bold heading moves with the text under it.
// ---------------------------------------------------------------------------

/** A short paragraph that is all bold, or a real heading. */
function isKeepWithNext(el: HTMLElement): boolean {
  if (/^H[1-6]$/.test(el.tagName)) return true;
  if (el.tagName !== 'P') return false;
  const text = (el.textContent ?? '').trim();
  if (!text || text.length > 160) return false;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    if (!node.parentElement?.closest('strong, b')) return false;
  }
  return true;
}

interface LineStart {
  node: Text;
  offset: number;
  top: number;
  bottom: number;
}

/** The first visible character of each rendered line in a paragraph. */
function measureLines(block: HTMLElement): LineStart[] {
  const lines: LineStart[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const text = node.data;
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect || rect.height === 0) continue;
      const last = lines[lines.length - 1];
      if (!last || rect.top >= last.bottom - 1) {
        lines.push({ node, offset: i, top: rect.top, bottom: rect.bottom });
      } else {
        last.bottom = Math.max(last.bottom, rect.bottom);
      }
    }
  }
  return lines;
}

interface MeasuredBlock {
  plan: PlanBlock;
  pieceHtml: (piece: PlanPiece) => string;
}

function measureBlock(block: HTMLElement): MeasuredBlock {
  const style = getComputedStyle(block);
  const marginTop = parseFloat(style.marginTop) || 0;
  const marginBot = parseFloat(style.marginBottom) || 0;
  const top = block.offsetTop - marginTop;
  const end = block.offsetTop + block.offsetHeight + marginBot;
  const whole = () => block.outerHTML;
  const toDocY = (clientY: number) => block.offsetTop + (clientY - block.getBoundingClientRect().top);

  /** Units between boundaries: unit k runs from boundary k to boundary k+1. */
  const unitsFrom = (boundaries: number[]): PlanUnit[] =>
    boundaries.map((boundary, k) => ({ top: boundary, bottom: k + 1 < boundaries.length ? boundaries[k + 1] : end }));

  const shellFor = (from: number, to: number, count: number) => {
    const shell = block.cloneNode(false) as HTMLElement;
    if (from > 0) shell.style.marginTop = '0';
    if (to < count) {
      shell.style.marginBottom = '0';
      // A justified paragraph keeps its last line before the break justified (index.css).
      shell.classList.add('page-split-continues');
    }
    return shell;
  };

  if (block.tagName === 'P') {
    let lines: LineStart[] = [];
    return {
      plan: {
        top,
        end,
        keepWithNext: isKeepWithNext(block),
        minEdge: 2,
        units: () => {
          lines = measureLines(block);
          if (lines.length < 2) return [];
          return unitsFrom(lines.map((line, k) =>
            k === 0 ? top : toDocY((lines[k - 1].bottom + line.top) / 2),
          ));
        },
      },
      pieceHtml: (piece) => {
        if (isWholePiece(piece) || lines.length < 2) return whole();
        const range = document.createRange();
        if (piece.from === 0) range.setStart(block, 0);
        else range.setStart(lines[piece.from].node, lines[piece.from].offset);
        if (piece.to >= lines.length) range.setEnd(block, block.childNodes.length);
        else range.setEnd(lines[piece.to].node, lines[piece.to].offset);
        const shell = shellFor(piece.from, piece.to, lines.length);
        shell.appendChild(range.cloneContents());
        return shell.outerHTML;
      },
    };
  }

  if (block.tagName === 'UL' || block.tagName === 'OL') {
    const items = Array.from(block.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    return {
      plan: {
        top,
        end,
        minEdge: 1,
        units: () => items.length < 2
          ? []
          : unitsFrom(items.map((item, k) => (k === 0 ? top : toDocY(item.getBoundingClientRect().top)))),
      },
      pieceHtml: (piece) => {
        if (isWholePiece(piece) || items.length < 2) return whole();
        const shell = shellFor(piece.from, piece.to, items.length);
        if (block.tagName === 'OL' && piece.from > 0) {
          const first = parseInt(block.getAttribute('start') ?? '1', 10) || 1;
          shell.setAttribute('start', String(first + piece.from));
        }
        for (const item of items.slice(piece.from, piece.to)) shell.appendChild(item.cloneNode(true));
        return shell.outerHTML;
      },
    };
  }

  return {
    plan: { top, end, keepWithNext: isKeepWithNext(block) },
    pieceHtml: whole,
  };
}

interface Page {
  blocks: string[];
  pageNumber: number;
}

export function PageView({ content, gapAnchorLabels }: PageViewProps) {
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [computing, setComputing] = useState(true);

  // Hidden TipTap editor used purely for measurement. Uses the same extensions
  // as RichTextEditor but without the pagination plugin or placeholder.
  const measureEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { autolink: false, openOnClick: false, linkOnPaste: false },
      }),
      Markdown.configure({
        html: false,
        transformCopiedText: false,
        transformPastedText: false,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight.configure({ multicolor: false }),
      Superscript,
      Subscript,
      InsertionMark,
      DeletionMark,
      RedactionMark,
      LegalFieldNode,
    ],
    content: '',
    editable: false,
    immediatelyRender: false,
  });

  // Set content once editor is ready
  useEffect(() => {
    if (!measureEditor || !content) return;
    try {
      if (isEditorHtml(content) || isTrackedChangesHtml(content)) {
        const json = generateJSON(repairNameAutolinks(content), measureEditor.extensionManager.extensions);
        measureEditor.commands.setContent(json, false);
      } else {
        measureEditor.commands.setContent(content, false);
      }
    } catch (err) {
      console.error('[PageView] Content hydration failed, falling back to raw:', err);
      try {
        measureEditor.commands.setContent(content, false);
      } catch (fallbackErr) {
        console.error('[PageView] Fallback setContent also failed:', fallbackErr);
      }
    }
  }, [measureEditor, content]);

  // Compute page distribution after the editor renders
  const computePages = useCallback(() => {
    const container = measureContainerRef.current;
    if (!container) return;

    const pmEl = container.querySelector('.ProseMirror') as HTMLElement | null;
    if (!pmEl) return;

    const topLevelBlocks = Array.from(pmEl.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.classList.contains('page-gutter-widget')
    );
    if (topLevelBlocks.length === 0) return;

    const gapHtml = (html: string) => hydrateReasoningGapAnchorsInHtml(html, gapAnchorLabels);
    const measured = topLevelBlocks.map(measureBlock);
    const plan = planPages(measured.map((entry) => entry.plan), CONTENT_H);
    const result: Page[] = plan.map((pieces, index) => ({
      pageNumber: index + 1,
      blocks: pieces.map((piece) => gapHtml(measured[piece.block].pieceHtml(piece))),
    }));

    setPages(result.length > 0 ? result : [{ blocks: topLevelBlocks.map(b => hydrateReasoningGapAnchorsInHtml(b.outerHTML, gapAnchorLabels)), pageNumber: 1 }]);
    setComputing(false);
  }, [gapAnchorLabels]);

  // Re-compute whenever the editor content changes
  useEffect(() => {
    if (!measureEditor) return;

    // Wait for TipTap + measure-container CSS (ProseMirror reset) to lay out
    let cancelled = false;
    const id = window.setTimeout(() => {
      requestAnimationFrame(() => {
        if (!cancelled) computePages();
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [measureEditor, content, computePages]);

  // Once pages are painted, quote Advice given onto weak gap chips
  useEffect(() => {
    if (computing || pages.length === 0) return;
    const id = window.setTimeout(() => {
      const roots = Array.from(document.querySelectorAll("[data-page-view-visible]"));
      enrichGapCitationChips(roots);
    }, 80);
    return () => window.clearTimeout(id);
  }, [computing, pages]);

  return (
    <div className="flex-1 overflow-y-auto min-w-0 max-w-full">
      {/* ----------------------------------------------------------------
          Hidden measurement container.
          position: fixed keeps it out of layout while still allowing
          getBoundingClientRect() to return real rendered dimensions.
          ---------------------------------------------------------------- */}
      <div
        ref={measureContainerRef}
        data-page-view-measure=""
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: CONTENT_W,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        {measureEditor && (
          <EditorContent
            editor={measureEditor}
            className="page-view-content"
          />
        )}
      </div>

      {/* ----------------------------------------------------------------
          Visible page-view output
          ---------------------------------------------------------------- */}
      <div className="bg-muted/30 dark:bg-muted/10 py-8 min-h-full min-w-0 max-w-full overflow-x-hidden">
        {computing ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <FileText className="w-8 h-8 opacity-30 animate-pulse" />
          </div>
        ) : (
          <div className="page-view-pages flex flex-col items-center gap-0 w-full max-w-full min-w-0">
            {pages.map((page, idx) => (
              <div key={page.pageNumber} className="w-full max-w-full min-w-0 sm:w-auto">
                {/* Grey separator band between pages */}
                {idx > 0 && (
                  <div
                    className="page-view-page-separator flex items-center justify-center"
                    style={{
                      width: PAGE_W,
                      height: 32,
                      backgroundColor: 'hsl(var(--muted) / 0.85)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'hsl(var(--muted-foreground) / 0.6)',
                      }}
                    >
                      Page {page.pageNumber}
                    </span>
                  </div>
                )}

                {/* A4 page card - fluid width on mobile via .page-view-page-card CSS */}
                <div
                  className="page-view-page-card bg-card shadow-md"
                  style={{
                    width: PAGE_W,
                    minHeight: 1122,
                    padding: `${MARGIN_V}px ${MARGIN_H}px`,
                  }}
                >
                  <div
                    className="page-view-content
                      [&_.track-change-insertion]:bg-green-100 [&_.track-change-insertion]:dark:bg-green-900/40
                      [&_.track-change-insertion]:text-green-800 [&_.track-change-insertion]:dark:text-green-200
                      [&_.track-change-deletion]:bg-red-100 [&_.track-change-deletion]:dark:bg-red-900/40
                      [&_.track-change-deletion]:text-red-800 [&_.track-change-deletion]:dark:text-red-200
                      [&_.track-change-deletion]:line-through"
                    data-page-view-visible=""
                    data-page={page.pageNumber}
                    style={{ outline: 'none' }}
                    dangerouslySetInnerHTML={{
                      __html: page.blocks.join(''),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
