/**
 * Where page breaks fall in the A4 page view.
 *
 * A block can be split between its units (lines of a paragraph, items of a
 * list) so a long paragraph flows onto the next page instead of leaving a gap.
 * A heading is never left alone at the foot of a page: it moves to the next
 * page with the text under it. All positions are in one vertical coordinate
 * space (the measured document), in px.
 */

export interface PlanUnit {
  top: number;
  bottom: number;
}

export interface PlanBlock {
  /** Top of the block, including its top margin. */
  top: number;
  /** Bottom of the block, including its bottom margin. */
  end: number;
  /** Short headings that must sit on the same page as what follows. */
  keepWithNext?: boolean;
  /** Fewest units allowed on either side of a split (2 avoids a lone line). */
  minEdge?: number;
  /** Splittable units, measured only when the block does not fit. */
  units?: () => PlanUnit[];
}

export interface PlanPiece {
  block: number;
  /** First unit in this piece. */
  from: number;
  /** One past the last unit in this piece. */
  to: number;
  /** Units in the whole block, so from=0,to=count is the whole block. */
  count: number;
}

export function isWholePiece(piece: PlanPiece): boolean {
  return piece.from === 0 && piece.to === piece.count;
}

export function planPages(blocks: PlanBlock[], pageHeight: number): PlanPiece[][] {
  const pages: PlanPiece[][] = [];
  if (blocks.length === 0) return pages;
  let current: PlanPiece[] = [];
  let pageStart = blocks[0].top;
  const unitCache = new Map<number, PlanUnit[]>();

  const unitsOf = (index: number): PlanUnit[] => {
    const cached = unitCache.get(index);
    if (cached) return cached;
    const block = blocks[index];
    const measured = block.units?.() ?? [];
    const units = measured.length > 1 ? measured : [{ top: block.top, bottom: block.end }];
    unitCache.set(index, units);
    return units;
  };

  const pieceTop = (piece: PlanPiece): number =>
    piece.from === 0 ? blocks[piece.block].top : unitsOf(piece.block)[piece.from].top;

  const newPage = (nextTop: number) => {
    let keepFrom = current.length;
    while (
      keepFrom > 1 &&
      blocks[current[keepFrom - 1].block].keepWithNext &&
      isWholePiece(current[keepFrom - 1])
    ) {
      keepFrom -= 1;
    }
    const moved = current.slice(keepFrom);
    pages.push(current.slice(0, keepFrom));
    current = moved;
    pageStart = moved.length > 0 ? pieceTop(moved[0]) : nextTop;
  };

  blocks.forEach((block, index) => {
    if (block.end - pageStart <= pageHeight) {
      current.push({ block: index, from: 0, to: 1, count: 1 });
      return;
    }

    const units = block.keepWithNext ? [{ top: block.top, bottom: block.end }] : unitsOf(index);
    const count = units.length;
    const min = Math.max(1, Math.min(block.minEdge ?? 1, count));
    let start = 0;

    while (start < count) {
      const limit = pageStart + pageHeight;
      let fit = start;
      while (fit < count && units[fit].bottom <= limit) fit += 1;
      if (fit === count) {
        current.push({ block: index, from: start, to: count, count });
        return;
      }

      let cut = fit;
      if (count - cut < min) cut = count - min;
      if (cut - start < min) {
        if (current.length > 0) {
          newPage(start === 0 ? block.top : units[start].top);
          continue;
        }
        cut = Math.max(fit, start + 1);
      }
      if (cut >= count) {
        current.push({ block: index, from: start, to: count, count });
        return;
      }

      current.push({ block: index, from: start, to: cut, count });
      newPage(units[cut].top);
      start = cut;
    }
  });

  if (current.length > 0) pages.push(current);
  return pages;
}
