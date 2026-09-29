import type { ExclusiveArc, Link, Point, Side } from '../model/types';
import { markerExtent } from './markers';
import { isHorizontalSide, type Box, type Route } from './route';

export interface ArcGeometry {
  /** Ends of the dashed line. */
  from: Point;
  to: Point;
  /** Where the dashed line meets each of its links. */
  dots: Point[];
  /** Position of the ⊗. */
  center: Point;
}

/** Polyline of `link` oriented so that it starts at `nodeId`. */
function fromNode(link: Link, route: Route, nodeId: string): Point[] {
  return link.source === nodeId ? route.points : route.points.slice().reverse();
}

/** The fixed coordinate of the arc line: x for left/right sides, y for top/bottom. */
function lineCoordinate(box: Box, side: Side, distance: number): number {
  switch (side) {
    case 'right':
      return box.x + box.w + distance;
    case 'left':
      return box.x - distance;
    case 'bottom':
      return box.y + box.h + distance;
    case 'top':
      return box.y - distance;
  }
}

/** First point where the polyline crosses the line `axis = at` (x = at or y = at). */
function firstCrossing(points: Point[], axis: 'x' | 'y', at: number): Point | null {
  const other = axis === 'x' ? 'y' : 'x';
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if ((a[axis] - at) * (b[axis] - at) > 0) continue;
    if (a[axis] === b[axis]) return a[axis] === at ? { ...a } : null;
    const s = (at - a[axis]) / (b[axis] - a[axis]);
    const p = { x: 0, y: 0 };
    p[axis] = at;
    p[other] = a[other] + s * (b[other] - a[other]);
    return p;
  }
  return null;
}

/**
 * An exclusive relationship is drawn as a straight dashed line parallel to
 * one side of the shared node, `distance` away from it, crossing its links;
 * a dot marks each crossing and ⊗ sits in the middle.
 */
export function arcGeometry(arc: ExclusiveArc, box: Box, links: Link[], routes: Map<string, Route>): ArcGeometry | null {
  const at = lineCoordinate(box, arc.side, arc.distance);
  // A line parallel to a top/bottom side is horizontal, i.e. y is fixed.
  const axis = isHorizontalSide(arc.side) ? 'y' : 'x';
  const along = axis === 'x' ? 'y' : 'x';
  const dots: Point[] = [];
  for (const link of links) {
    const route = routes.get(link.id);
    if (!route) continue;
    const p = firstCrossing(fromNode(link, route, arc.nodeId), axis, at);
    if (p) dots.push(p);
  }
  if (dots.length === 0) return null;
  const lo = Math.min(...dots.map((p) => p[along]));
  const hi = Math.max(...dots.map((p) => p[along]));
  const point = (v: number): Point => (axis === 'x' ? { x: at, y: v } : { x: v, y: at });
  return { from: point(lo), to: point(hi), dots, center: point((lo + hi) / 2) };
}

/**
 * Initial placement for an arc over `links` at `nodeId`: the side most of the
 * links leave from, just past their cardinality markers.
 */
export function defaultArcPlacement(nodeId: string, links: Link[], routes: Map<string, Route>): { side: Side; distance: number } {
  const counts = new Map<Side, number>();
  let reach = 0;
  for (const l of links) {
    const route = routes.get(l.id);
    if (!route) continue;
    const atSource = l.source === nodeId;
    const side = (atSource ? route.source : route.target).side;
    counts.set(side, (counts.get(side) ?? 0) + 1);
    reach = Math.max(reach, markerExtent(atSource ? l.sourceCard : l.targetCard));
  }
  let side: Side = 'right';
  let best = 0;
  for (const [s, n] of counts) {
    if (n > best) {
      side = s;
      best = n;
    }
  }
  return { side, distance: Math.max(18, reach + 8) };
}

/** Distance from `side` of the node for an arc whose ⊗ is dragged to `q`. */
export function arcDistanceAt(box: Box, side: Side, q: Point): number {
  const distance = {
    right: q.x - (box.x + box.w),
    left: box.x - q.x,
    bottom: q.y - (box.y + box.h),
    top: box.y - q.y,
  }[side];
  return Math.round(Math.max(4, Math.min(400, distance)));
}
