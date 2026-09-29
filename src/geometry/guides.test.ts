import { describe, expect, it } from 'vitest';
import { snapToGuides, unionRect, visualBox } from './guides';

const r = (x: number, y: number, w = 100, h = 60) => ({ x, y, w, h });

describe('snapToGuides', () => {
  it('snaps left edges that are within the threshold and draws a vertical guide', () => {
    const s = snapToGuides(r(203, 300), [r(200, 0)], 6);
    expect(s.dx).toBe(-3);
    expect(s.dy).toBe(0);
    expect(s.guides).toEqual([{ axis: 'x', at: 200, from: 0, to: 360 }, { axis: 'x', at: 250, from: 0, to: 360 }, { axis: 'x', at: 300, from: 0, to: 360 }]);
  });

  it('snaps centers of boxes with different sizes', () => {
    // Moving box center y = 125; other center y = 130.
    const s = snapToGuides(r(400, 95, 100, 60), [r(0, 80, 100, 100)], 6);
    expect(s.dy).toBe(5);
    expect(s.guides).toContainEqual({ axis: 'y', at: 130, from: 0, to: 500 });
  });

  it('picks the closest alignment and snaps both axes independently', () => {
    const s = snapToGuides(r(104, 198), [r(100, 0), r(0, 200), r(102, 500)], 6);
    expect(s.dx).toBe(-2);
    expect(s.dy).toBe(2);
  });

  it('does nothing when nothing is close enough', () => {
    expect(snapToGuides(r(150, 150), [r(0, 0)], 6)).toEqual({ dx: 0, dy: 0, guides: [] });
  });
});

describe('helpers', () => {
  it('unions boxes', () => {
    expect(unionRect([r(0, 0, 10, 10), r(20, 5, 10, 30)])).toEqual({ x: 0, y: 0, w: 30, h: 35 });
  });

  it('uses the front face of a fact', () => {
    const fact = { id: 'f', kind: 'fact' as const, x: 10, y: 20, width: 108, name: 'F', measures: [] };
    expect(visualBox(fact, { width: 108, height: 80 })).toEqual({ x: 10, y: 28, w: 100, h: 72 });
  });
});
