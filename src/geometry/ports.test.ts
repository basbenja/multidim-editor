import { describe, expect, it } from 'vitest';
import { link } from '../model/fixtures';
import type { Diagram, LevelNode } from '../model/types';
import { PORT_GAP } from './ports';
import { computeRoutes, type Route } from './route';

const level = (id: string, x: number, y: number, width = 150): LevelNode => ({
  id,
  kind: 'level',
  x,
  y,
  width,
  name: id,
  attributes: [{ text: 'K', key: true }],
});

function diagram(nodes: LevelNode[], links: Diagram['links']): Diagram {
  return { version: 1, nodes, links, distributingFactors: [], exclusiveArcs: [] };
}

const isOrthogonal = (r: Route) => r.points.slice(1).every((p, i) => p.x === r.points[i].x || p.y === r.points[i].y);

describe('spreadPorts', () => {
  it('gives two links on the same side separate ends (the Band/Manager/Artist case)', () => {
    const d = diagram(
      [level('band', 40, 160), level('manager', 265, 30), level('artist', 260, 150)],
      [link('toManager', 'band', 'manager'), link('toArtist', 'band', 'artist')],
    );
    const sizes = { band: { width: 150, height: 65 }, manager: { width: 150, height: 80 }, artist: { width: 150, height: 100 } };
    const routes = computeRoutes(d, sizes);
    const m = routes.get('toManager')!;
    const a = routes.get('toArtist')!;
    expect(m.source.side).toBe('right');
    expect(a.source.side).toBe('right');
    // Manager is above: its end is higher, and far enough from Artist's.
    expect(a.source.point.y - m.source.point.y).toBeGreaterThanOrEqual(PORT_GAP - 0.5);
    // The link to Artist stays straight.
    expect(a.points).toHaveLength(2);
    expect(isOrthogonal(m)).toBe(true);
  });

  it('staggers bent links leaving one side so their middle segments do not overlap', () => {
    // Sales-like fact on the left; Employee level level with it, Shipper and Order lower right.
    const d = diagram(
      [level('sales', 0, 0, 170), level('employee', 300, 0), level('shipper', 300, 260), level('order', 300, 400)],
      [link('e', 'sales', 'employee'), link('s', 'sales', 'shipper'), link('o', 'sales', 'order')],
    );
    const sizes = {
      sales: { width: 170, height: 180 },
      employee: { width: 150, height: 100 },
      shipper: { width: 150, height: 60 },
      order: { width: 150, height: 60 },
    };
    const routes = computeRoutes(d, sizes);
    const [e, s, o] = ['e', 's', 'o'].map((id) => routes.get(id)!);
    const ys = [e, s, o].map((r) => r.source.point.y);
    // Ordered top to bottom as their targets, and spaced out.
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(PORT_GAP - 0.5);
    // Shipper (upper exit) turns further out than Order.
    expect(s.points[1].x).toBeGreaterThan(o.points[1].x);
    expect([e, s, o].every(isOrthogonal)).toBe(true);
  });

  it('leaves a single link per side alone', () => {
    const d = diagram([level('a', 0, 0), level('b', 300, 10)], [link('l', 'a', 'b')]);
    const r = computeRoutes(d, { a: { width: 150, height: 80 }, b: { width: 150, height: 80 } }).get('l')!;
    expect(r.points).toHaveLength(2);
  });
});
