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

function getBlockNaturalTop(dom: HTMLElement, proseMirrorEl: HTMLElement): number {
  // Walk up the DOM from the block element to the ProseMirror root,
  // summing offsetTop values. This gives us the natural document-flow
  // position of the block, unaffected by decoration widgets inserted above it.
  let top = 0;
  let el: HTMLElement | null = dom;
  while (el && el !== proseMirrorEl) {
    top += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  return top;
}

function rebuildDecorations(view: EditorView): { set: DecorationSet; signature: string } {
  const proseMirrorEl = view.dom;
  if (!proseMirrorEl) return { set: DecorationSet.empty, signature: '' };

  const decorations: Decoration[] = [];
  const parts: string[] = [];

  // Accumulate natural block heights to determine page breaks.
  // We track cumulative content height ignoring gutter widgets.
  let cumulativeHeight = TOP_PAD;
  let pageContentEnd = TOP_PAD + CONTENT_H;
  let gutterCount = 0;
  let guttersInserted = 0;

  view.state.doc.forEach((node, offset) => {
    if (!node.isBlock) return;
    if (gutterCount >= MAX_PAGES) return;

    const dom = view.nodeDOM(offset);
    if (!dom || !(dom instanceof HTMLElement)) return;
    if (dom.classList.contains('page-gutter-widget')) return;

    // Use offsetHeight for the block's natural height (ignores viewport scroll)
    const blockHeight = dom.offsetHeight;
    const blockNaturalBottom = cumulativeHeight + blockHeight;

    // Block fits on current page
    if (blockNaturalBottom <= pageContentEnd) {
      cumulativeHeight += blockHeight;
      return;
    }

    // Block overflows — insert a page break before it
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

    // Start fresh page: reset cumulative height to top of new page
    // The gutter widget itself occupies WIDGET_H px but we don't count it
    // in content height — only real content blocks count.
    cumulativeHeight = TOP_PAD;
    pageContentEnd = TOP_PAD + CONTENT_H;
    gutterCount++;
    guttersInserted++;

    // Now account for this block on the new page
    cumulativeHeight += blockHeight;
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
