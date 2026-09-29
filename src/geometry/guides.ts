import type { DiagramNode } from '../model/types';
import { nodeBox, type Box, type Size } from './route';

/**
 * An alignment guide: a vertical line (`axis: 'x'`, at x = `at`) or a
 * horizontal one (`axis: 'y'`, at y = `at`), spanning `from`..`to`.
 */
export interface Guide {
  axis: 'x' | 'y';
  at: number;
  from: number;
  to: number;
}

type Rect = Pick<Box, 'x' | 'y' | 'w' | 'h'>;

const xLines = (b: Rect) => [b.x, b.x + b.w / 2, b.x + b.w];
const yLines = (b: Rect) => [b.y, b.y + b.h / 2, b.y + b.h];

/** Smallest shift (within `threshold`) that puts one of `moving` on one of `targets`, or 0. */
function nearestShift(moving: number[], targets: number[], threshold: number): number {
  let best: number | null = null;
  for (const m of moving) {
    for (const t of targets) {
      const d = t - m;
      if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  return best ?? 0;
}

/**
 * Snaps `moving` so that its left/center/right or top/middle/bottom lines up
 * with those of another box, if one is within `threshold`. Returns the
 * shift to apply and the guides to draw after applying it.
 */
export function snapToGuides(moving: Rect, others: Rect[], threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const dx = nearestShift(xLines(moving), others.flatMap(xLines), threshold);
  const dy = nearestShift(yLines(moving), others.flatMap(yLines), threshold);
  const snapped = { x: moving.x + dx, y: moving.y + dy, w: moving.w, h: moving.h };

  const guides = new Map<string, Guide>();
  const add = (axis: 'x' | 'y', at: number, from: number, to: number) => {
    const key = `${axis}:${Math.round(at * 2)}`;
    const g = guides.get(key);
    guides.set(key, g ? { ...g, from: Math.min(g.from, from), to: Math.max(g.to, to) } : { axis, at, from, to });
  };
  for (const o of others) {
    for (const m of xLines(snapped)) {
      for (const t of xLines(o)) {
        if (Math.abs(m - t) < 0.5) add('x', t, Math.min(snapped.y, o.y), Math.max(snapped.y + snapped.h, o.y + o.h));
      }
    }
    for (const m of yLines(snapped)) {
      for (const t of yLines(o)) {
        if (Math.abs(m - t) < 0.5) add('y', t, Math.min(snapped.x, o.x), Math.max(snapped.x + snapped.w, o.x + o.w));
      }
    }
  }
  return { dx, dy, guides: [...guides.values()] };
}

/** Union of several boxes. */
export function unionRect(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

/** The box as it looks: for a fact, its front face without the 3D top and right faces. */
export function visualBox(n: DiagramNode, size: Size | undefined): Rect {
  const b = nodeBox(n, size);
  return { x: b.x, y: b.y + b.depth, w: b.w - b.depth, h: b.h - b.depth };
}
