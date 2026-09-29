import type { Cardinality } from '../model/types';
import { markerExtent } from './markers';
import type { End } from './route';

/**
 * Default placement of a role label near a link end: just past the marker,
 * above horizontal lines and to the left of vertical ones (clear of the
 * loop of a recursive link). `tx`/`ty` are
 * the percentage translations that anchor the label box at (x, y).
 */
export function roleAnchor(end: End, card: Cardinality): { x: number; y: number; tx: number; ty: number } {
  const { point: p, dir: u } = end;
  const along = markerExtent(card) + 5;
  if (u.y === 0) {
    return { x: p.x + u.x * along, y: p.y - 1, tx: u.x > 0 ? 0 : -100, ty: -100 };
  }
  return { x: p.x - 5, y: p.y + u.y * along, tx: -100, ty: u.y > 0 ? 0 : -100 };
}
