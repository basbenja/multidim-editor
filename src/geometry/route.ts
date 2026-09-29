import { FACT_DEPTH, LINE_HEIGHT } from '../lib/style';
import type { Diagram, DiagramNode, Link, Point, Side } from '../model/types';

/** Node bounds. `depth` > 0 for facts, whose 3D corners are cut off. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

/** Where a link meets a node: point on the border and outward direction. */
export interface End {
  point: Point;
  side: Side;
  dir: Point;
}

export interface Route {
  /** Polyline from the source end to the target end. */
  points: Point[];
  source: End;
  target: End;
}

export interface Size {
  width: number;
  height: number;
}

/** Distance between parallel links. */
export const PARALLEL_GAP = 26;
/** Keeps link ends away from node corners. */
const CORNER_MARGIN = 8;
/** Minimum shared span for two boxes to be joined by one straight segment. */
const MIN_OVERLAP = 12;

const DIRS: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function isHorizontalSide(side: Side): boolean {
  return side === 'top' || side === 'bottom';
}

export function nodeBox(n: DiagramNode, size: Size | undefined): Box {
  if (n.kind === 'criterion') return { x: n.x, y: n.y, w: n.width, h: n.height, depth: 0 };
  const lines = n.kind === 'level' ? n.attributes.length : n.measures.length;
  const depth = n.kind === 'fact' ? FACT_DEPTH : 0;
  const estimated = 45 + Math.max(1, lines) * LINE_HEIGHT + depth;
  return { x: n.x, y: n.y, w: size?.width ?? n.width, h: size?.height ?? estimated, depth };
}

/**
 * A node side as a segment: `at` is its fixed coordinate (x for left/right,
 * y for top/bottom) and [from, to] the span along it. Fact sides skip the
 * empty corners of the 3D box.
 */
export function sideSpan(b: Box, side: Side): { at: number; from: number; to: number } {
  const { x, y, w, h, depth: d } = b;
  switch (side) {
    case 'left':
      return { at: x, from: y + d, to: y + h };
    case 'right':
      return { at: x + w, from: y, to: y + h - d };
    case 'top':
      return { at: y, from: x + d, to: x + w };
    case 'bottom':
      return { at: y + h, from: x, to: x + w - d };
  }
}

/** Usable span of a side, i.e. without the corner margins. */
function usable(b: Box, side: Side): [number, number] {
  const s = sideSpan(b, side);
  const m = Math.min(CORNER_MARGIN, (s.to - s.from) / 2);
  return [s.from + m, s.to - m];
}

/** End on `side` at coordinate `along` (clamped to the side). */
export function endAt(b: Box, side: Side, along: number): End {
  const s = sideSpan(b, side);
  const [lo, hi] = usable(b, side);
  const t = clamp(along, lo, hi);
  const point = isHorizontalSide(side) ? { x: t, y: s.at } : { x: s.at, y: t };
  return { point, side, dir: DIRS[side] };
}

function center(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/**
 * Automatic orthogonal route between two distinct boxes. `k` is the offset
 * index among parallel links (…, -1, 0, 1, …) and `n` their count.
 */
export function autoRoute(a: Box, b: Box, k = 0, n = 1): Route {
  const hGap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const vGap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));

  // Facing sides when the boxes are separated along each axis.
  const hSides: [Side, Side] | null = hGap > 0 ? (b.x > a.x ? ['right', 'left'] : ['left', 'right']) : null;
  const vSides: [Side, Side] | null = vGap > 0 ? (b.y > a.y ? ['bottom', 'top'] : ['top', 'bottom']) : null;

  for (const sides of [hSides, vSides]) {
    if (!sides) continue;
    const straight = straightRoute(a, b, sides, k, n);
    if (straight) return straight;
  }
  if (hSides && (!vSides || hGap >= vGap)) return zRoute(a, b, hSides, k);
  if (vSides) return zRoute(a, b, vSides, k);

  // Overlapping boxes: join the sides facing each other along the dominant axis.
  const ca = center(a);
  const cb = center(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const sa: Side = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
  const source = endAt(a, sa, isHorizontalSide(sa) ? ca.x : ca.y);
  const target = endAt(b, OPPOSITE[sa], isHorizontalSide(sa) ? cb.x : cb.y);
  return { points: [source.point, target.point], source, target };
}

/** One straight segment through the span both facing sides share, or null. */
function straightRoute(a: Box, b: Box, [sa, sb]: [Side, Side], k: number, n: number): Route | null {
  const [a0, a1] = usable(a, sa);
  const [b0, b1] = usable(b, sb);
  const lo = Math.max(a0, b0);
  const hi = Math.min(a1, b1);
  if (hi - lo < MIN_OVERLAP) return null;
  const gap = n > 1 ? Math.min(PARALLEL_GAP, (hi - lo) / (n - 1)) : 0;
  const along = clamp((lo + hi) / 2 + k * gap, lo, hi);
  const source = endAt(a, sa, along);
  const target = endAt(b, sb, along);
  return { points: [source.point, target.point], source, target };
}

/** Three-segment route leaving and entering through facing sides. */
function zRoute(a: Box, b: Box, [sa, sb]: [Side, Side], k: number): Route {
  const horizontalEnds = !isHorizontalSide(sa);
  const ca = center(a);
  const cb = center(b);
  const offset = k * PARALLEL_GAP;
  const source = endAt(a, sa, (horizontalEnds ? ca.y : ca.x) + offset);
  const target = endAt(b, sb, (horizontalEnds ? cb.y : cb.x) + offset);
  const s = source.point;
  const t = target.point;
  if (horizontalEnds) {
    // Nest parallel links so that their middle segments do not cross.
    const x = clampBetween((s.x + t.x) / 2 - offset * Math.sign(t.y - s.y) * Math.sign(t.x - s.x), s.x, t.x);
    return { points: [s, { x, y: s.y }, { x, y: t.y }, t], source, target };
  }
  const y = clampBetween((s.y + t.y) / 2 - offset * Math.sign(t.x - s.x) * Math.sign(t.y - s.y), s.y, t.y);
  return { points: [s, { x: s.x, y }, { x: t.x, y }, t], source, target };
}

/** Loop of a recursive link around the bottom-right corner; `k` nests several loops. */
export function selfLoop(b: Box, k = 0): Route {
  const ext = 34 + k * 16;
  const inset = 18 + k * 12;
  const right = sideSpan(b, 'right');
  const bottom = sideSpan(b, 'bottom');
  const source = endAt(b, 'right', right.to - inset);
  const target = endAt(b, 'bottom', bottom.to - inset);
  const s = source.point;
  const t = target.point;
  const corner = { x: right.at + ext, y: bottom.at + ext };
  return {
    points: [s, { x: corner.x, y: s.y }, corner, { x: t.x, y: corner.y }, t],
    source,
    target,
  };
}

/** Routes of every link, keyed by link id. */
export function computeRoutes(d: Diagram, sizes: Record<string, Size>): Map<string, Route> {
  const boxes = new Map(d.nodes.map((n) => [n.id, nodeBox(n, sizes[n.id])]));
  const groups = new Map<string, Link[]>();
  for (const l of d.links) {
    const key = l.source < l.target ? `${l.source}|${l.target}` : `${l.target}|${l.source}`;
    const g = groups.get(key);
    if (g) g.push(l);
    else groups.set(key, [l]);
  }
  const routes = new Map<string, Route>();
  for (const group of groups.values()) {
    group.forEach((l, i) => {
      const a = boxes.get(l.source);
      const b = boxes.get(l.target);
      if (!a || !b) return;
      if (l.source === l.target) {
        routes.set(l.id, selfLoop(a, i));
        return;
      }
      // Offsets are defined in the canonical (sorted) direction so that
      // links drawn in opposite directions still spread apart.
      const k = i - (group.length - 1) / 2;
      const flipped = l.source > l.target;
      const r = flipped ? reverse(autoRoute(b, a, k, group.length)) : autoRoute(a, b, k, group.length);
      routes.set(l.id, r);
    });
  }
  return routes;
}

export function reverse(r: Route): Route {
  return { points: r.points.slice().reverse(), source: r.target, target: r.source };
}

export function pathD(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function clampBetween(v: number, p: number, q: number): number {
  return clamp(v, Math.min(p, q), Math.max(p, q));
}

/** Where the ray from the box center towards `p` leaves the box. */
export function borderPoint(b: Box, p: Point): Point {
  const c = center(b);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const t = Math.min(dx === 0 ? Infinity : b.w / 2 / Math.abs(dx), dy === 0 ? Infinity : b.h / 2 / Math.abs(dy));
  return t >= 1 ? p : { x: c.x + dx * t, y: c.y + dy * t };
}
