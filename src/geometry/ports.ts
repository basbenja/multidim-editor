import type { Link, Point, Side } from '../model/types';
import { isHorizontalSide, sideSpan, usableSpan, type Box, type Route } from './route';

/** Minimum distance between two link ends on the same node side. */
export const PORT_GAP = 20;
/** Room a bent link keeps before turning, so markers stay on a straight piece. */
const MIN_TURN = 26;

type Axis = 'x' | 'y';
type Which = 'source' | 'target';

interface Item {
  linkId: string;
  which: Which;
  /** Current position of the end along the side. */
  pos: number;
  /** Where the link is heading along the side's axis (used for ordering). */
  key: number;
  /** Straight links (and loops) keep their end where it is when possible. */
  pinned: boolean;
}

/** The route's points listed from the given end. */
function fromEnd(r: Route, which: Which): Point[] {
  return which === 'source' ? r.points : r.points.slice().reverse();
}

function withPoints(r: Route, which: Which, pts: Point[]): Route {
  const points = which === 'source' ? pts : pts.slice().reverse();
  return {
    points,
    source: { ...r.source, point: points[0] },
    target: { ...r.target, point: points[points.length - 1] },
  };
}

/** Moves one end of a route along its side to `v`, keeping the route orthogonal. */
function movePort(r: Route, which: Which, along: Axis, v: number): Route {
  const pts = fromEnd(r, which).map((p) => ({ ...p }));
  const normal: Axis = along === 'x' ? 'y' : 'x';
  if (pts.length === 2) {
    // A straight link can no longer stay straight: add a jog halfway.
    const [s, t] = pts;
    const mid = (s[normal] + t[normal]) / 2;
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    a[normal] = mid;
    a[along] = v;
    b[normal] = mid;
    b[along] = t[along];
    return withPoints(r, which, [{ ...s, [along]: v }, a, b, t]);
  }
  const old = pts[0][along];
  pts[0][along] = v;
  if (pts[1][along] === old) pts[1][along] = v;
  return withPoints(r, which, pts);
}

/**
 * Gives every link end on the same node side its own spot, at least
 * `PORT_GAP` apart and ordered by where the links go (so they do not cross
 * right at the node). Then staggers the middle segments of bent links that
 * leave the same side in the same direction, so they do not overlap either.
 */
export function spreadPorts(routes: Map<string, Route>, links: Link[], boxes: Map<string, Box>): Map<string, Route> {
  const result = new Map(routes);
  const groups = new Map<string, { nodeId: string; side: Side; ends: { linkId: string; which: Which }[] }>();
  for (const l of links) {
    const r = routes.get(l.id);
    if (!r) continue;
    for (const which of ['source', 'target'] as const) {
      const nodeId = l[which];
      const side = r[which].side;
      const key = `${nodeId}|${side}`;
      const g = groups.get(key) ?? { nodeId, side, ends: [] };
      g.ends.push({ linkId: l.id, which });
      groups.set(key, g);
    }
  }
  const loops = new Set(links.filter((l) => l.source === l.target).map((l) => l.id));

  for (const { nodeId, side, ends } of groups.values()) {
    const box = boxes.get(nodeId);
    if (!box || ends.length < 2) continue;
    const along: Axis = isHorizontalSide(side) ? 'x' : 'y';
    const [lo, hi] = usableSpan(box, side);
    const items: Item[] = ends.map(({ linkId, which }) => {
      const pts = fromEnd(result.get(linkId)!, which);
      const pos = pts[0][along];
      const straight = pts.length === 2 && Math.abs(pts[1][along] - pos) < 0.5;
      return { linkId, which, pos, key: straight ? pos : pts[pts.length - 1][along], pinned: straight || loops.has(linkId) };
    });
    items.sort((a, b) => a.key - b.key || a.pos - b.pos);

    const gap = Math.min(PORT_GAP, (hi - lo) / (items.length - 1));
    // Two pinned ends too close together: the later one has to move.
    let lastPinned = -Infinity;
    for (const it of items) {
      if (!it.pinned) continue;
      if (it.pos - lastPinned < gap - 0.5) it.pinned = false;
      else lastPinned = it.pos;
    }
    const pos = items.map((it) => it.pos);
    for (let i = 1; i < pos.length; i++) if (!items[i].pinned) pos[i] = Math.max(pos[i], pos[i - 1] + gap);
    for (let i = pos.length - 2; i >= 0; i--) if (!items[i].pinned) pos[i] = Math.min(pos[i], pos[i + 1] - gap);
    items.forEach((it, i) => {
      const v = Math.max(lo, Math.min(hi, pos[i]));
      if (Math.abs(v - it.pos) >= 0.5) result.set(it.linkId, movePort(result.get(it.linkId)!, it.which, along, v));
    });

    staggerMiddles(result, items, box, side, along, loops);
  }
  return result;
}

/**
 * Bent (Z-shaped) links leaving one side in the same direction turn at
 * different distances from the node: the end farthest from where they head
 * turns furthest out, so their middle segments nest instead of overlapping.
 */
function staggerMiddles(result: Map<string, Route>, items: Item[], box: Box, side: Side, along: Axis, loops: Set<string>) {
  const normal: Axis = along === 'x' ? 'y' : 'x';
  const at = sideSpan(box, side).at;
  const out = side === 'right' || side === 'bottom' ? 1 : -1;
  for (const heading of [-1, 1]) {
    const bent = items
      .filter((it) => !loops.has(it.linkId))
      .map((it) => ({ it, pts: fromEnd(result.get(it.linkId)!, it.which) }))
      .filter(({ pts }) => pts.length === 4 && Math.sign(pts[3][along] - pts[0][along]) === heading);
    if (bent.length < 2) continue;
    // Heading down (+): the upper end turns furthest out.
    bent.sort((a, b) => heading * (a.pts[0][along] - b.pts[0][along]));
    const dists = bent.map(({ pts }) => Math.abs(pts[1][normal] - at));
    const center = dists.reduce((s, d) => s + d, 0) / dists.length;
    bent.forEach(({ it, pts }, i) => {
      const room = Math.abs(pts[3][normal] - at) - MIN_TURN;
      if (room < MIN_TURN) return;
      const d = Math.max(MIN_TURN, Math.min(room, center + ((bent.length - 1) / 2 - i) * PORT_GAP));
      const next = pts.map((p) => ({ ...p }));
      next[1][normal] = next[2][normal] = at + out * d;
      result.set(it.linkId, withPoints(result.get(it.linkId)!, it.which, next));
    });
  }
}
