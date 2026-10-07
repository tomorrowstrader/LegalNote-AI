import { Fragment, type Node as ProseNode } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

export function newChangeId(): string {
  return (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    ? crypto.randomUUID()
    : `tc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type AdjacentMark = { changeId: string; timestamp: string };

function markMatches(mark: { type: { name: string }; attrs: Record<string, unknown> }, name: string, author: string) {
  return mark.type.name === name
    && !!mark.attrs.changeId
    && (mark.attrs.user || "Unknown") === author;
}

/** Reuse changeId when a new insertion sits against the same author's insertion. */
export function findAdjacentInsertionMark(
  doc: { resolve: (pos: number) => { nodeBefore: ProseNode | null; nodeAfter: ProseNode | null }; content: { size: number } },
  from: number,
  to: number,
  author: string,
): AdjacentMark | null {
  const read = (node: ProseNode | null): AdjacentMark | null => {
    if (!node?.isText) return null;
    const mark = node.marks.find((candidate) => markMatches(candidate, "insertion", author));
    if (!mark) return null;
    return {
      changeId: String(mark.attrs.changeId),
      timestamp: String(mark.attrs.timestamp || new Date().toISOString()),
    };
  };

  if (from > 0) {
    const before = read(doc.resolve(from).nodeBefore);
    if (before) return before;
  }
  if (to < doc.content.size) {
    const after = read(doc.resolve(to).nodeAfter);
    if (after) return after;
  }
  return null;
}

/** Reuse changeId when a reinserted deletion sits against the same author's deletion. */
export function findAdjacentDeletionMark(
  doc: { resolve: (pos: number) => { nodeBefore: ProseNode | null; nodeAfter: ProseNode | null }; content: { size: number } },
  pos: number,
  author: string,
): AdjacentMark | null {
  const read = (node: ProseNode | null): AdjacentMark | null => {
    if (!node?.isText) return null;
    const mark = node.marks.find((candidate) => markMatches(candidate, "deletion", author));
    if (!mark) return null;
    return {
      changeId: String(mark.attrs.changeId),
      timestamp: String(mark.attrs.timestamp || new Date().toISOString()),
    };
  };

  if (pos > 0) {
    const before = read(doc.resolve(pos).nodeBefore);
    if (before) return before;
  }
  if (pos < doc.content.size) {
    const after = read(doc.resolve(pos).nodeAfter);
    if (after) return after;
  }
  return null;
}

/**
 * Where the caret goes after a tracked deletion is put back.
 * A keystroke that also inserts text (typing, spellcheck, replacing a selection)
 * must keep ProseMirror's own caret. Parking it before the reinserted letters
 * is what scrambled "Shipley" into "hiply … e S".
 */
export function caretForTrackedStep(args: {
  insertedSize: number;
  selectionEmpty: boolean;
  selectionHead: number;
  deletedFrom: number;
  deletedTo: number;
  stepCount: number;
}): "before" | "after" | null {
  if (args.insertedSize > 0) return null;
  if (!args.selectionEmpty || args.stepCount !== 1) return null;
  if (args.selectionHead === args.deletedTo) return "before";
  if (args.selectionHead === args.deletedFrom) return "after";
  return null;
}

/**
 * Insert typed text already wearing its insertion mark, with the caret after it.
 * Doing this in one step stops the browser from placing the next character
 * inside a freshly wrapped <ins>/<del> at the wrong offset.
 */
export function buildTrackedTypingTransaction(
  state: EditorState,
  from: number,
  to: number,
  text: string,
  author: string,
): Transaction | null {
  if (!text || text.includes("\n")) return null;
  const insertionType = state.schema.marks.insertion;
  const deletionType = state.schema.marks.deletion;
  if (!insertionType || !deletionType) return null;

  const $from = state.doc.resolve(from);
  const $to = state.doc.resolve(to);
  if (!$from.sameParent($to) || !$from.parent.isTextblock) return null;

  if (from !== to) {
    let blocked = false;
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isLeaf && !node.isText) blocked = true;
    });
    if (blocked) return null;
  }

  const baseMarks = (state.storedMarks || $from.marks()).filter(
    (mark) => mark.type.name !== "insertion" && mark.type.name !== "deletion" && mark.type.name !== "redaction",
  );

  const adjacent = findAdjacentInsertionMark(state.doc, from, to, author);
  const timestamp = adjacent?.timestamp ?? new Date().toISOString();
  const insertion = insertionType.create({
    user: author,
    timestamp,
    changeId: adjacent?.changeId ?? newChangeId(),
  });
  const inserted = state.schema.text(text, [...baseMarks, insertion]);

  const deletedNodes: ProseNode[] = [];
  if (from < to) {
    const adjacentDel = findAdjacentDeletionMark(state.doc, from, author);
    let deletionChangeId = adjacentDel?.changeId ?? newChangeId();
    const deletionTimestamp = adjacentDel?.timestamp ?? timestamp;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText || !node.text) return;
      if (node.marks.some((mark) => mark.type.name === "insertion")) return;
      const start = Math.max(pos, from);
      const end = Math.min(pos + node.nodeSize, to);
      const slice = node.text.slice(start - pos, end - pos);
      if (!slice) return;
      const existingDeletion = node.marks.find((mark) => mark.type.name === "deletion");
      if (existingDeletion?.attrs.changeId) deletionChangeId = String(existingDeletion.attrs.changeId);
      const kept = node.marks.filter(
        (mark) => mark.type.name !== "insertion" && mark.type.name !== "deletion",
      );
      const deletion = existingDeletion
        ?? deletionType.create({ user: author, timestamp: deletionTimestamp, changeId: deletionChangeId });
      deletedNodes.push(state.schema.text(slice, [...kept, deletion]));
    });
  }

  const piece = Fragment.from(deletedNodes.length ? [...deletedNodes, inserted] : inserted);
  let tr = state.tr.replaceWith(from, to, piece);
  const cursor = from + piece.size;
  tr = tr.setSelection(TextSelection.create(tr.doc, cursor));
  tr = tr.setStoredMarks([...baseMarks, insertion]);
  tr = tr.scrollIntoView();
  tr.setMeta("trackChangesApply", true);
  return tr;
}
