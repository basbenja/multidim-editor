import { describe, expect, it } from 'vitest';
import { sampleDiagram } from '../model/fixtures';
import type { CriterionNode } from '../model/types';
import { attachedBox, attachCriterion, findAttachment, resolveAttachments } from './attach';
import type { Box } from './route';

const level: Box = { x: 100, y: 100, w: 150, h: 120, depth: 0 };
const levels = [{ id: 'L', box: level }];
const pill = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h, depth: 0 });

describe('findAttachment', () => {
  it('snaps a pill dropped just right of a level to its right side', () => {
    expect(findAttachment(pill(255, 120, 24, 100), levels)).toEqual({ nodeId: 'L', side: 'right' });
  });

  it('snaps a horizontal pill dropped against the left side too (it will turn vertical)', () => {
    expect(findAttachment(pill(-15, 150, 110, 24), levels)).toEqual({ nodeId: 'L', side: 'left' });
  });

  it('snaps to the top and bottom sides', () => {
    expect(findAttachment(pill(110, 70, 110, 24), levels)).toEqual({ nodeId: 'L', side: 'top' });
    expect(findAttachment(pill(110, 228, 110, 24), levels)).toEqual({ nodeId: 'L', side: 'bottom' });
  });

  it('ignores pills that are too far or do not overlap the side', () => {
    expect(findAttachment(pill(290, 120, 24, 100), levels)).toBeNull();
    expect(findAttachment(pill(255, 400, 24, 100), levels)).toBeNull();
  });
});

describe('attachedBox', () => {
  it('spans the whole side and shares the level border', () => {
    expect(attachedBox(level, 'right', 24)).toEqual({ x: 249, y: 100, w: 24, h: 120, depth: 0 });
    expect(attachedBox(level, 'left', 24)).toEqual({ x: 77, y: 100, w: 24, h: 120, depth: 0 });
    expect(attachedBox(level, 'top', 24)).toEqual({ x: 100, y: 77, w: 150, h: 24, depth: 0 });
    expect(attachedBox(level, 'bottom', 24)).toEqual({ x: 100, y: 219, w: 150, h: 24, depth: 0 });
  });
});

describe('resolveAttachments', () => {
  it('places attached criteria against the measured side of their level', () => {
    const d = sampleDiagram();
    const c = d.nodes[2] as CriterionNode;
    d.nodes[2] = { ...c, attachedTo: { nodeId: 'n1', side: 'bottom' } };
    const out = resolveAttachments(d, { n1: { width: 160, height: 90 } });
    expect(out.nodes[2]).toMatchObject({ x: 0, y: 89, width: 160, height: 26, orientation: 'horizontal' });
  });

  it('returns the same diagram when nothing is attached', () => {
    const d = sampleDiagram();
    expect(resolveAttachments(d, {})).toBe(d);
  });

  it('attachCriterion keeps the object when already in place', () => {
    const c = sampleDiagram().nodes[2] as CriterionNode;
    const once = attachCriterion(c, level, { nodeId: 'L', side: 'right' });
    expect(attachCriterion(once, level, { nodeId: 'L', side: 'right' })).toBe(once);
  });
});
