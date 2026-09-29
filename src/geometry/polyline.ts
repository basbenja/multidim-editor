import type { Point } from '../model/types';

export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** Point at fraction `t` (0..1) of the polyline's length, with the direction of its segment. */
export function pointAt(points: Point[], t: number): { point: Point; dir: Point } {
  const total = polylineLength(points);
  let remaining = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    if (remaining <= len || i === points.length - 1) {
      const d = Math.min(remaining, len);
      return { point: { x: a.x + dir.x * d, y: a.y + dir.y * d }, dir };
    }
    remaining -= len;
  }
  return { point: points[0], dir: { x: 1, y: 0 } };
}

/** Fraction (0..1) of the polyline's length at the point closest to `q`. */
export function project(points: Point[], q: Point): number {
  const total = polylineLength(points);
  if (total === 0) return 0;
  let best = Infinity;
  let bestAt = 0;
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2));
    const px = a.x + s * dx;
    const py = a.y + s * dy;
    const dist = Math.hypot(q.x - px, q.y - py);
    const len = Math.sqrt(len2);
    if (dist < best) {
      best = dist;
      bestAt = walked + s * len;
    }
    walked += len;
  }
  return bestAt / total;
}
