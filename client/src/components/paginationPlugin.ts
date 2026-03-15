import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';

// A4 page layout constants (all values in px at 96dpi)
const TOP_PAD    = 96;   // ProseMirror padding-top (first page top margin)
const CONTENT_H  = 930;  // usable content height per page (1122 - 96 top - 96 bottom)
const BOT_MARGIN = 96;   // white zone below last block on page N (looks like a page-bottom margin)
const GREY_H     = 32;   // grey separator band
const TOP_MARGIN = 96;   // white zone above first block on page N+1
const WIDGET_H   = BOT_MARGIN + GREY_H + TOP_MARGIN; // 224px total gutter widget
const MAX_PAGES  = 50;

export const paginationPluginKey = new PluginKey('pagination');

function rebuildDecorations(view: EditorView): { set: DecorationSet; signature: string } {
  const proseMirrorEl = view.dom;
  const pageCardEl =
    proseMirrorEl.closest('.paginated-page-card') || proseMirrorEl.parentElement;
  if (!pageCardEl) return { set: DecorationSet.empty, signature: '' };

  const cardTop = pageCardEl.getBoundingClientRect().top;
  const decorations: Decoration[] = [];
  const parts: string[] = [];

  // Track where the current page's content zone ends (y from card top).
  // Page 0: content starts at TOP_PAD due to ProseMirror padding-top;
  //         content zone ends at TOP_PAD + CONTENT_H = 1026.
  // After each gutter insertion: next page content ends at
  //         blockTop_at_insertion + WIDGET_H + CONTENT_H.
  let pageContentEnd = TOP_PAD + CONTENT_H;
  let gutterCount = 0;

  view.state.doc.forEach((node, offset) => {
    if (!node.isBlock) return;
    if (gutterCount >= MAX_PAGES) return;

    const dom = view.nodeDOM(offset);
    if (!dom || !(dom instanceof HTMLElement)) return;
    if (dom.classList.contains('page-gutter-widget')) return;

    const rect = dom.getBoundingClientRect();
    const blockTop    = rect.top    - cardTop;
    const blockBottom = rect.bottom - cardTop;

    // Block fits entirely within the current page's content zone.
    if (blockBottom <= pageContentEnd) return;

    // Block overflows. Insert a gutter widget immediately BEFORE this block
    // so it becomes the first block of the next page.
    const key = `pg-gutter-${gutterCount}`;
    parts.push(`${key}@${offset}`);

    const el = document.createElement('div');
    el.className = 'page-gutter-widget';
    el.setAttribute('contenteditable', 'false');
    const label = document.createElement('span');
    label.textContent = `Page ${gutterCount + 2}`;
    el.appendChild(label);

    decorations.push(
      Decoration.widget(offset, el, { side: -1, key })
    );

    // After the gutter widget (WIDGET_H px), this block begins the next page.
    // Its shifted DOM position will be approximately blockTop + WIDGET_H.
    // The next page's content zone ends at: blockTop + WIDGET_H + CONTENT_H.
    pageContentEnd = blockTop + WIDGET_H + CONTENT_H;
    gutterCount++;
  });

  return {
    set: DecorationSet.create(view.state.doc, decorations),
    signature: parts.join('|'),
  };
}

export function createPaginationPlugin(): Plugin {
  return new Plugin({
    key: paginationPluginKey,

    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, old) {
        const meta = tr.getMeta(paginationPluginKey);
        if (meta !== undefined) return meta as DecorationSet;
        return old.map(tr.mapping, tr.doc);
      },
    },

    props: {
      decorations(state) {
        return paginationPluginKey.getState(state) as DecorationSet;
      },
    },

    view() {
      let rafId: number | null = null;
      let dispatching = false;
      let lastSignature = '';
      let resizeObserver: ResizeObserver | null = null;
      let currentView: EditorView | null = null;

      const schedule = (editorView: EditorView) => {
        if (dispatching) return;
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          rafId = null;
          if (dispatching) return;
          const { set, signature } = rebuildDecorations(editorView);
          if (signature === lastSignature) return;
          lastSignature = signature;
          dispatching = true;
          editorView.dispatch(
            editorView.state.tr.setMeta(paginationPluginKey, set)
          );
          dispatching = false;
        });
      };

      return {
        update(view) {
          currentView = view;
          if (!resizeObserver) {
            resizeObserver = new ResizeObserver(() => {
              if (currentView) schedule(currentView);
            });
            resizeObserver.observe(view.dom);
          }
          schedule(view);
        },
        destroy() {
          if (rafId !== null) cancelAnimationFrame(rafId);
          if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
          }
        },
      };
    },
  });
}
