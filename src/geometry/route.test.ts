import { describe, expect, it } from 'vitest';
import { link } from '../model/fixtures';
import type { Diagram, LevelNode } from '../model/types';
import { markerShape } from './markers';
import { autoRoute, computeRoutes, selfLoop, type Box } from './route';

const box = (x: number, y: number, w = 100, h = 80, depth = 0): Box => ({ x, y, w, h, depth });

function isOrthogonal(points: { x: number; y: number }[]) {
  return points.slice(1).every((p, i) => p.x === points[i].x || p.y === points[i].y);
}

describe('autoRoute', () => {
  it('joins horizontally aligned boxes with one horizontal segment', () => {
    const r = autoRoute(box(0, 0), box(300, 20));
    expect(r.points).toHaveLength(2);
    expect(r.source.side).toBe('right');
    expect(r.target.side).toBe('left');
    expect(r.points[0].y).toBe(r.points[1].y);
    expect(r.points[0].x).toBe(100);
    expect(r.points[1].x).toBe(300);
  });

  it('joins vertically aligned boxes with one vertical segment', () => {
    const r = autoRoute(box(0, 300), box(20, 0));
    expect(r.source.side).toBe('top');
    expect(r.target.side).toBe('bottom');
    expect(r.points[0].x).toBe(r.points[1].x);
  });

  it('uses an orthogonal Z route for diagonal boxes', () => {
    const r = autoRoute(box(0, 0), box(300, 200));
    expect(r.points).toHaveLength(4);
    expect(isOrthogonal(r.points)).toBe(true);
    expect(r.source.side).toBe('right');
    expect(r.target.side).toBe('left');
  });

  it('attaches to the outer faces of a fact, skipping its cut corners', () => {
    // Fact at the left, level to the right, only overlapping near the fact's top.
    const fact = box(0, 100, 108, 88, 8);
    const r = autoRoute(fact, box(300, 0, 100, 110));
    // Right face of a fact spans y 100..180; the attachment is inside it.
    expect(r.source.point.x).toBe(108);
    expect(r.source.point.y).toBeLessThanOrEqual(180);
  });
});

describe('parallel and recursive links', () => {
  const level = (id: string, x: number, y: number): LevelNode => ({
    id,
    kind: 'level',
    x,
    y,
    width: 100,
    name: id,
    attributes: [{ text: 'K', key: true }],
  });

  it('spreads parallel links apart, whatever direction they were drawn in', () => {
    const d: Diagram = {
      version: 1,
      nodes: [level('a', 0, 0), level('b', 300, 0)],
      links: [link('l1', 'a', 'b'), link('l2', 'b', 'a'), link('l3', 'a', 'b')],
      distributingFactors: [],
      exclusiveArcs: [],
    };
    const sizes = { a: { width: 100, height: 120 }, b: { width: 100, height: 120 } };
    const routes = computeRoutes(d, sizes);
    const ys = ['l1', 'l2', 'l3'].map((id) => routes.get(id)!.points[0].y);
    expect(new Set(ys).size).toBe(3);
    // l2 runs from b to a but still starts on b's left side.
    expect(routes.get('l2')!.source.side).toBe('left');
  });

  it('draws self links as an orthogonal loop leaving and re-entering the node', () => {
    const r = selfLoop(box(0, 0, 100, 80));
    expect(isOrthogonal(r.points)).toBe(true);
    expect(r.source.side).toBe('right');
    expect(r.target.side).toBe('bottom');
    expect(r.points.at(-1)).toEqual(r.target.point);
  });
});

describe('markers', () => {
  const end = { point: { x: 100, y: 50 }, side: 'right' as const, dir: { x: 1, y: 0 } };

  it('draws nothing for (1,1)', () => {
    expect(markerShape(end, '1,1')).toEqual({ foot: null, circle: null });
  });

  it('puts the (0,1) circle against the border', () => {
    expect(markerShape(end, '0,1').circle).toEqual({ cx: 105, cy: 50, r: 5 });
  });

  it('puts the crow foot prongs on the border and the (0,n) circle past its tip', () => {
    const m = markerShape(end, '0,n');
    expect(m.foot).toBe('M100 56 L112 50 L100 44');
    expect(m.circle).toEqual({ cx: 117, cy: 50, r: 5 });
  });
});
