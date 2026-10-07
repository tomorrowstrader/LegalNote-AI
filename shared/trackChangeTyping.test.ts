import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { buildTrackedTypingTransaction, caretForTrackedStep } from "./trackChangeTyping";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
  },
  marks: {
    insertion: {
      attrs: {
        user: { default: null },
        timestamp: { default: null },
        changeId: { default: null },
      },
      inclusive: true,
      excludes: "deletion",
    },
    deletion: {
      attrs: {
        user: { default: null },
        timestamp: { default: null },
        changeId: { default: null },
        originalText: { default: null },
      },
      inclusive: false,
      excludes: "insertion",
    },
  },
});

function note(text: string) {
  return EditorState.create({
    schema,
    doc: schema.node("doc", null, [schema.node("paragraph", null, schema.text(text))]),
  });
}

function typeAt(state: EditorState, pos: number, text: string, author = "Solicitor") {
  let next = state;
  let cursor = pos;
  for (const ch of text) {
    const tr = buildTrackedTypingTransaction(next, cursor, cursor, ch, author);
    if (!tr) throw new Error(`could not type ${JSON.stringify(ch)}`);
    next = next.apply(tr);
    cursor = next.selection.from;
  }
  return next;
}

function markedText(state: EditorState, markName: string) {
  let text = "";
  state.doc.descendants((node) => {
    if (node.isText && node.marks.some((mark) => mark.type.name === markName)) text += node.text;
  });
  return text;
}

describe("tracked typing", () => {
  it("adds Shipley after Jen in the order it was typed", () => {
    const start = note("Prepared by: Jen");
    const at = 1 + "Prepared by: Jen".length;
    const typed = typeAt(start, at, " Shipley");
    expect(typed.doc.textContent).toBe("Prepared by: Jen Shipley");
    expect(markedText(typed, "insertion")).toBe(" Shipley");
    expect(markedText(typed, "deletion")).toBe("");
    expect(typed.selection.from).toBe(1 + "Prepared by: Jen Shipley".length);
  });

  it("keeps a replacement after the struck-through original", () => {
    const start = note("Prepared by: Jen");
    const from = 1 + "Prepared by: ".length;
    const to = from + "Jen".length;
    const first = buildTrackedTypingTransaction(start, from, to, "S", "Solicitor");
    if (!first) throw new Error("replace failed");
    let state = start.apply(first);
    state = typeAt(state, state.selection.from, "hipley");
    expect(state.doc.textContent).toBe("Prepared by: JenShipley");
    expect(markedText(state, "deletion")).toBe("Jen");
    expect(markedText(state, "insertion")).toBe("Shipley");
    expect(state.selection.from).toBe(1 + "Prepared by: JenShipley".length);
  });

  it("does not park the caret before text when the keystroke also inserted letters", () => {
    expect(caretForTrackedStep({
      insertedSize: 1,
      selectionEmpty: true,
      selectionHead: 8,
      deletedFrom: 5,
      deletedTo: 8,
      stepCount: 1,
    })).toBeNull();
    expect(caretForTrackedStep({
      insertedSize: 0,
      selectionEmpty: true,
      selectionHead: 8,
      deletedFrom: 7,
      deletedTo: 8,
      stepCount: 1,
    })).toBe("before");
  });
});
