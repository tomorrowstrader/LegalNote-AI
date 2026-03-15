import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';

const A4_H = 1122;
const GUTTER_H = 32;
const PAGE_STRIDE = A4_H + GUTTER_H;
const MAX_PAGES = 100;

export const paginationPluginKey = new PluginKey('pagination');

function rebuildDecorations(view: EditorView): { set: DecorationSet; signature: string } {
  const proseMirrorEl = view.dom;
  const pageCardEl =
    proseMirrorEl.closest('.paginated-page-card') || proseMirrorEl.parentElement;
  if (!pageCardEl) return { set: DecorationSet.empty, signature: '' };

  const cardTop = pageCardEl.getBoundingClientRect().top;
  const decorations: Decoration[] = [];
  const parts: string[] = [];

  view.state.doc.forEach((node, offset) => {
    if (!node.isBlock) return;

    let dom: Node | null = null;
    try {
      dom = view.nodeDOM(offset);
    } catch {
      return;
    }
    if (!dom || !(dom instanceof HTMLElement)) return;
    if (dom.classList.contains('page-gutter-widget')) return;

    const rect = dom.getBoundingClientRect();
    const nodeTop = rect.top - cardTop;
    const nodeBottom = rect.bottom - cardTop;

    for (let n = 0; n < MAX_PAGES; n++) {
      const gutterStart = n * PAGE_STRIDE + A4_H;
      const gutterEnd = gutterStart + GUTTER_H;

      if (nodeBottom <= gutterStart) break;
      if (nodeTop >= gutterEnd) continue;

      let widgetPos: number;
      if (nodeTop < gutterStart) {
        widgetPos = offset + node.nodeSize;
      } else {
        widgetPos = offset;
      }

      const key = `pg-gutter-${n}`;
      parts.push(`${key}@${widgetPos}`);

      const el = document.createElement('div');
      el.className = 'page-gutter-widget';
      el.setAttribute('contenteditable', 'false');
      const span = document.createElement('span');
      span.textContent = `Page ${n + 2}`;
      el.appendChild(span);

      decorations.push(
        Decoration.widget(widgetPos, el, { side: -1, key })
      );
      break;
    }
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
        if (tr.docChanged) return DecorationSet.empty;
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
      let stabilizeCount = 0;

      const schedule = (editorView: EditorView) => {
        if (dispatching) return;
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          rafId = null;
          if (dispatching) return;
          try {
            const { set, signature } = rebuildDecorations(editorView);
            if (signature === lastSignature) {
              stabilizeCount = 0;
              return;
            }
            lastSignature = signature;
            stabilizeCount++;
            if (stabilizeCount > 5) {
              stabilizeCount = 0;
              return;
            }
            dispatching = true;
            editorView.dispatch(
              editorView.state.tr.setMeta(paginationPluginKey, set)
            );
          } finally {
            dispatching = false;
          }
        });
      };

      return {
        update(view) {
          schedule(view);
        },
        destroy() {
          if (rafId !== null) cancelAnimationFrame(rafId);
        },
      };
    },
  });
}
