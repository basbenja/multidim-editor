import type { CriterionNode, Diagram, Side } from '../model/types';
import { isHorizontalSide, nodeBox, type Box, type Size } from './route';

/** How close (in diagram units) a criterion must be dropped to a level side to snap to it. */
export const SNAP_DISTANCE = 16;
/** Minimum overlap along the side for a criterion to count as next to it. */
const MIN_OVERLAP = 8;

export interface Attachment {
  nodeId: string;
  side: Side;
}

export function criterionThickness(c: CriterionNode): number {
  return Math.min(c.width, c.height);
}

/**
 * Box of a criterion of thickness `t` snapped to `side` of `level`, spanning
 * the whole side. It overlaps the level by 1px so both borders coincide.
 */
export function attachedBox(level: Box, side: Side, t: number): Box {
  const l = { x: Math.round(level.x), y: Math.round(level.y), w: Math.round(level.w), h: Math.round(level.h) };
  switch (side) {
    case 'right':
      return { x: l.x + l.w - 1, y: l.y, w: t, h: l.h, depth: 0 };
    case 'left':
      return { x: l.x - t + 1, y: l.y, w: t, h: l.h, depth: 0 };
    case 'top':
      return { x: l.x, y: l.y - t + 1, w: l.w, h: t, depth: 0 };
    case 'bottom':
      return { x: l.x, y: l.y + l.h - 1, w: l.w, h: t, depth: 0 };
  }
}

/** The criterion as it looks when snapped to `side` of `level`. */
export function attachCriterion(c: CriterionNode, level: Box, a: Attachment): CriterionNode {
  const b = attachedBox(level, a.side, criterionThickness(c));
  const orientation = isHorizontalSide(a.side) ? 'horizontal' : 'vertical';
  if (
    c.x === b.x &&
    c.y === b.y &&
    c.width === b.w &&
    c.height === b.h &&
    c.orientation === orientation &&
    c.attachedTo?.nodeId === a.nodeId &&
    c.attachedTo.side === a.side
  ) {
    return c;
  }
  return { ...c, x: b.x, y: b.y, width: b.w, height: b.h, orientation, attachedTo: { nodeId: a.nodeId, side: a.side } };
}

/** The diagram with every attached criterion placed against its level's current side. */
export function resolveAttachments(d: Diagram, sizes: Record<string, Size>): Diagram {
  if (!d.nodes.some((n) => n.kind === 'criterion' && n.attachedTo)) return d;
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  let changed = false;
  const nodes = d.nodes.map((n) => {
    if (n.kind !== 'criterion' || !n.attachedTo) return n;
    const level = byId.get(n.attachedTo.nodeId);
    if (!level) return n;
    const next = attachCriterion(n, nodeBox(level, sizes[level.id]), n.attachedTo);
    if (next !== n) changed = true;
    return next;
  });
  return changed ? { ...d, nodes } : d;
}

/** The level side a criterion box is closest to, if within snapping distance. */
export function findAttachment(c: Box, levels: { id: string; box: Box }[], tolerance = SNAP_DISTANCE): Attachment | null {
  let best: Attachment | null = null;
  let bestGap = tolerance;
  for (const { id, box: l } of levels) {
    const overlapY = Math.min(c.y + c.h, l.y + l.h) - Math.max(c.y, l.y);
    const overlapX = Math.min(c.x + c.w, l.x + l.w) - Math.max(c.x, l.x);
    const candidates: [Side, number, number][] = [
      ['right', Math.abs(c.x - (l.x + l.w)), overlapY],
      ['left', Math.abs(c.x + c.w - l.x), overlapY],
      ['top', Math.abs(c.y + c.h - l.y), overlapX],
      ['bottom', Math.abs(c.y - (l.y + l.h)), overlapX],
    ];
    for (const [side, gap, overlap] of candidates) {
      if (overlap >= MIN_OVERLAP && gap <= bestGap) {
        best = { nodeId: id, side };
        bestGap = gap;
      }
    }
  }
  return best;
}
