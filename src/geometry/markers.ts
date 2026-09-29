import type { Cardinality, Point } from '../model/types';
import type { End } from './route';

/** Crow's foot length along the link and half its spread. */
export const FOOT_LENGTH = 12;
export const FOOT_HALF_WIDTH = 6;
export const CIRCLE_RADIUS = 5;

export interface MarkerShape {
  /** Path for the crow's foot prongs, if any. */
  foot: string | null;
  /** Open circle, if any. */
  circle: { cx: number; cy: number; r: number } | null;
}

/**
 * Marker for a cardinality at a link end. The crow's foot prongs touch the
 * node border; (0,1) puts the circle against the border; (0,n) puts it just
 * past the tip of the crow's foot.
 */
export function markerShape(end: End, card: Cardinality): MarkerShape {
  const { point: p, dir: u } = end;
  const n: Point = { x: -u.y, y: u.x };
  const at = (along: number, across = 0): Point => ({
    x: p.x + u.x * along + n.x * across,
    y: p.y + u.y * along + n.y * across,
  });
  const many = card === '1,n' || card === '0,n';
  const optional = card === '0,1' || card === '0,n';
  let foot: string | null = null;
  if (many) {
    const tip = at(FOOT_LENGTH);
    const l = at(0, FOOT_HALF_WIDTH);
    const r = at(0, -FOOT_HALF_WIDTH);
    foot = `M${l.x} ${l.y} L${tip.x} ${tip.y} L${r.x} ${r.y}`;
  }
  let circle: MarkerShape['circle'] = null;
  if (optional) {
    const c = at((many ? FOOT_LENGTH : 0) + CIRCLE_RADIUS);
    circle = { cx: c.x, cy: c.y, r: CIRCLE_RADIUS };
  }
  return { foot, circle };
}

/** How far the marker reaches out from the node border. */
export function markerExtent(card: Cardinality): number {
  switch (card) {
    case '1,1':
      return 0;
    case '0,1':
      return 2 * CIRCLE_RADIUS;
    case '1,n':
      return FOOT_LENGTH;
    case '0,n':
      return FOOT_LENGTH + 2 * CIRCLE_RADIUS;
  }
}
