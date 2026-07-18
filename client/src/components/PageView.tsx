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
import { hydrateReasoningGapAnchorsInHtml } from "@/lib/reasoningGapAnchors";

// A4 layout constants matching the editor
const PAGE_W    = 794;   // A4 width in px
const MARGIN_H  = 120;   // left/right horizontal margin
const MARGIN_V  = 96;    // top/bottom vertical margin per page
const CONTENT_W = PAGE_W - 2 * MARGIN_H; // 554px – content column width
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
  return /<(?:ins|del)\b[^>]*\bdata-track-change\s*=/i.test(content);
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
    return ['ins', mergeAttributes(HTMLAttributes, { 'data-track-change': 'insertion', class: 'track-change-insertion' }), 0];
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
    return ['del', mergeAttributes(HTMLAttributes, { 'data-track-change': 'deletion', class: 'track-change-deletion' }), 0];
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
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
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
      if (isTrackedChangesHtml(content)) {
        const json = generateJSON(content, measureEditor.extensionManager.extensions);
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

    const topLevelBlocks = Array.from(pmEl.children) as HTMLElement[];
    if (topLevelBlocks.length === 0) return;

    const result: Page[] = [];
    let currentBlocks: string[] = [];
    let currentHeight = 0;
    let pageNumber = 1;

    for (const block of topLevelBlocks) {
      const style      = getComputedStyle(block);
      const marginTop  = parseFloat(style.marginTop)    || 0;
      const marginBot  = parseFloat(style.marginBottom) || 0;
      const blockHeight = block.getBoundingClientRect().height + marginTop + marginBot;

      // If this block would overflow the current page, start a new one
      if (currentHeight + blockHeight > CONTENT_H && currentBlocks.length > 0) {
        result.push({ blocks: [...currentBlocks], pageNumber });
        pageNumber++;
        currentBlocks = [hydrateReasoningGapAnchorsInHtml(block.outerHTML, gapAnchorLabels)];
        currentHeight = blockHeight;
      } else {
        currentBlocks.push(hydrateReasoningGapAnchorsInHtml(block.outerHTML, gapAnchorLabels));
        currentHeight += blockHeight;
      }
    }

    if (currentBlocks.length > 0) {
      result.push({ blocks: currentBlocks, pageNumber });
    }

    setPages(result.length > 0 ? result : [{ blocks: topLevelBlocks.map(b => hydrateReasoningGapAnchorsInHtml(b.outerHTML, gapAnchorLabels)), pageNumber: 1 }]);
    setComputing(false);
  }, [gapAnchorLabels]);

  // Re-compute whenever the editor content changes
  useEffect(() => {
    if (!measureEditor) return;

    // Wait a tick after TipTap renders before measuring
    const id = setTimeout(computePages, 120);
    return () => clearTimeout(id);
  }, [measureEditor, content, computePages]);

  return (
    <div className="flex-1 overflow-y-auto">
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
      <div className="bg-muted/30 dark:bg-muted/10 py-8 min-h-full">
        {computing ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <FileText className="w-8 h-8 opacity-30 animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0">
            {pages.map((page, idx) => (
              <div key={page.pageNumber}>
                {/* Grey separator band between pages */}
                {idx > 0 && (
                  <div
                    className="flex items-center justify-center"
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

                {/* A4 page card */}
                <div
                  className="bg-card shadow-md"
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
