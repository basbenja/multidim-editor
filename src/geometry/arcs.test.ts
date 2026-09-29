import { describe, expect, it } from 'vitest';
import { createFactor, exclusiveArcCandidate } from '../model/factory';
import { link, sampleDiagram } from '../model/fixtures';
import type { ExclusiveArc } from '../model/types';
import { arcDistanceAt, arcGeometry, defaultArcPlacement } from './arcs';
import { pointAt, polylineLength, project } from './polyline';
import type { Box, Route } from './route';

const L = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
];

describe('polyline', () => {
  it('measures, samples and projects', () => {
    expect(polylineLength(L)).toBe(150);
    expect(pointAt(L, 0.5).point).toEqual({ x: 75, y: 0 });
    expect(pointAt(L, 0.9).point).toEqual({ x: 100, y: 35 });
    expect(pointAt(L, 0.9).dir).toEqual({ x: 0, y: 1 });
    expect(project(L, { x: 75, y: 20 })).toBeCloseTo(0.5);
    expect(project(L, { x: 130, y: 35 })).toBeCloseTo(0.9);
  });
});

// City at (0,0) 100x60; State to the right (straight link), Country below-right (Z link).
const city: Box = { x: 0, y: 0, w: 100, h: 60, depth: 0 };
const routes = new Map<string, Route>([
  [
    'toState',
    {
      points: [{ x: 100, y: 10 }, { x: 200, y: 10 }],
      source: { point: { x: 100, y: 10 }, side: 'right', dir: { x: 1, y: 0 } },
      target: { point: { x: 200, y: 10 }, side: 'left', dir: { x: -1, y: 0 } },
    },
  ],
  [
    'toCountry',
    {
      points: [{ x: 100, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 300 }, { x: 200, y: 300 }],
      source: { point: { x: 100, y: 50 }, side: 'right', dir: { x: 1, y: 0 } },
      target: { point: { x: 200, y: 300 }, side: 'left', dir: { x: -1, y: 0 } },
    },
  ],
]);
const links = [link('toState', 'city', 'state'), link('toCountry', 'city', 'country', { sourceCard: '0,n' })];

describe('exclusive arcs', () => {
  it('draws a line parallel to the side, with a dot on each link and ⊗ in the middle', () => {
    const arc: ExclusiveArc = { id: 'x1', nodeId: 'city', linkIds: ['toState', 'toCountry'], side: 'right', distance: 30 };
    const g = arcGeometry(arc, city, links, routes)!;
    expect(g.dots).toEqual([{ x: 130, y: 10 }, { x: 130, y: 50 }]);
    expect(g.from).toEqual({ x: 130, y: 10 });
    expect(g.to).toEqual({ x: 130, y: 50 });
    expect(g.center).toEqual({ x: 130, y: 30 });
  });

  it('crosses a link on a later segment when needed (horizontal line below the node)', () => {
    const arc: ExclusiveArc = { id: 'x1', nodeId: 'city', linkIds: ['toState', 'toCountry'], side: 'bottom', distance: 40 };
    const g = arcGeometry(arc, city, links, routes)!;
    // Only the Z link reaches y = 100 (on its vertical leg).
    expect(g.dots).toEqual([{ x: 150, y: 100 }]);
  });

  it('defaults to the side the links leave from, past the markers', () => {
    expect(defaultArcPlacement('city', links, routes)).toEqual({ side: 'right', distance: 30 });
  });

  it('dragging ⊗ changes the distance from its side, never below 4', () => {
    expect(arcDistanceAt(city, 'right', { x: 125, y: 300 })).toBe(25);
    expect(arcDistanceAt(city, 'bottom', { x: 500, y: 80 })).toBe(20);
    expect(arcDistanceAt(city, 'top', { x: 50, y: 10 })).toBe(4);
  });
});

describe('factories', () => {
  it('finds the node shared by the selected links', () => {
    const d = sampleDiagram();
    expect(exclusiveArcCandidate(d, ['l3', 'l4'])).toEqual({ nodeId: 'n2', linkIds: ['l3', 'l4'] });
    expect(exclusiveArcCandidate(d, ['l1', 'l3'])).toEqual({ nodeId: 'n2', linkIds: ['l1', 'l3'] });
    expect(exclusiveArcCandidate(d, ['l1', 'l2'])).toBeNull();
    expect(exclusiveArcCandidate(d, ['l1'])).toBeNull();
    expect(exclusiveArcCandidate(d, ['l1', 'n1'])).toBeNull();
  });

  it('creates a factor with a fresh id', () => {
    const f = createFactor(sampleDiagram(), 'l2', { x: 0, y: 36 });
    expect(f).toEqual({ id: 'd2', linkId: 'l2', text: 'percentage ÷', t: 0.5, dx: 0, dy: 36 });
  });
});
