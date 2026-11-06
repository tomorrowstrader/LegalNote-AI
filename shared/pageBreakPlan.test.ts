import { describe, expect, it } from "vitest";
import { planPages, type PlanBlock } from "./pageBreakPlan";

const LINE = 20;

/** A paragraph of `lines` lines starting at `top`, with no margins. */
function paragraph(top: number, lines: number): PlanBlock {
  return {
    top,
    end: top + lines * LINE,
    minEdge: 2,
    units: () => Array.from({ length: lines }, (_, i) => ({ top: top + i * LINE, bottom: top + (i + 1) * LINE })),
  };
}

function heading(top: number): PlanBlock {
  return { top, end: top + LINE, keepWithNext: true };
}

const summary = (pages: ReturnType<typeof planPages>) =>
  pages.map((page) => page.map((piece) => `${piece.block}:${piece.from}-${piece.to}`));

describe("planPages", () => {
  it("keeps blocks whole when they fit", () => {
    const pages = planPages([paragraph(0, 5), paragraph(100, 5)], 400);
    expect(summary(pages)).toEqual([["0:0-1", "1:0-1"]]);
  });

  it("splits a long paragraph so it starts under its heading instead of leaving a gap", () => {
    // Page holds 10 lines. 6 lines of text, a heading, then a 10-line paragraph.
    const pages = planPages([paragraph(0, 6), heading(120), paragraph(140, 10)], 200);
    expect(summary(pages)).toEqual([
      ["0:0-1", "1:0-1", "2:0-3"],
      ["2:3-10"],
    ]);
  });

  it("moves a heading to the next page rather than leave it alone at the foot", () => {
    // Heading lands on the last line; only one line of text would fit, which is not allowed.
    const pages = planPages([paragraph(0, 8), heading(160), paragraph(180, 6)], 200);
    expect(summary(pages)).toEqual([
      ["0:0-1"],
      ["1:0-1", "2:0-6"],
    ]);
  });

  it("does not leave a single line at the top of the next page", () => {
    // 4 lines left on the page, paragraph of 5: split 3/2 rather than 4/1.
    const pages = planPages([paragraph(0, 6), paragraph(120, 5)], 200);
    expect(summary(pages)).toEqual([
      ["0:0-1", "1:0-3"],
      ["1:3-5"],
    ]);
  });

  it("carries a paragraph longer than a page over several pages", () => {
    const pages = planPages([paragraph(0, 25)], 200);
    expect(summary(pages)).toEqual([["0:0-10"], ["0:10-20"], ["0:20-25"]]);
  });

  it("moves a block that cannot be split to the next page whole", () => {
    const table: PlanBlock = { top: 120, end: 260 };
    const pages = planPages([paragraph(0, 6), table], 200);
    expect(summary(pages)).toEqual([["0:0-1"], ["1:0-1"]]);
  });
});
