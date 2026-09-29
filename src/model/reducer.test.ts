import { describe, expect, it } from 'vitest';
import { createLink, createNode, linkKind, nextCardinality } from './factory';
import { sampleDiagram } from './fixtures';
import { reduce } from './reducer';
import { emptyDiagram, type FactNode, type LevelNode } from './types';

const level = (d: ReturnType<typeof sampleDiagram>, id: string) => d.nodes.find((n) => n.id === id) as LevelNode;
const fact = (d: ReturnType<typeof sampleDiagram>, id: string) => d.nodes.find((n) => n.id === id) as FactNode;

describe('nodes', () => {
  it('creates nodes with unique ids and names', () => {
    let d = emptyDiagram();
    const a = createNode(d, 'level', { x: 0, y: 0 });
    d = reduce(d, { type: 'addNode', node: a });
    const b = createNode(d, 'level', { x: 10, y: 10 });
    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe('Level1');
    expect(b.name).toBe('Level2');
    expect(b.kind === 'level' && b.attributes[0].key).toBe(true);
  });

  it('updates a node and returns the same diagram for unknown ids', () => {
    const d = sampleDiagram();
    const next = reduce(d, { type: 'updateNode', id: 'n1', patch: { name: 'Item' } });
    expect(next.nodes[0].name).toBe('Item');
    expect(reduce(d, { type: 'updateNode', id: 'zz', patch: { name: 'x' } })).toBe(d);
  });

  it('ignores undefined patch values', () => {
    const next = reduce(sampleDiagram(), { type: 'updateNode', id: 'n1', patch: { name: 'Item', width: undefined } });
    expect(next.nodes[0].width).toBe(160);
  });

  it('moves nodes and translates waypoints of links whose both ends moved together', () => {
    const d = sampleDiagram();
    const moved = reduce(d, { type: 'moveNodes', positions: { n2: { x: 310, y: 5 }, n5: { x: 610, y: 5 } } });
    expect(moved.nodes[1]).toMatchObject({ x: 310, y: 5 });
    expect(moved.links.find((l) => l.id === 'l3')!.waypoints).toEqual([{ x: 510, y: 25 }]);
    const alone = reduce(d, { type: 'moveNodes', positions: { n5: { x: 700, y: 0 } } });
    expect(alone.links.find((l) => l.id === 'l3')!.waypoints).toEqual([{ x: 500, y: 20 }]);
  });
});

describe('criterion', () => {
  it('rotates around its center, swapping width and height', () => {
    const d = reduce(sampleDiagram(), { type: 'setOrientation', id: 'n3', orientation: 'horizontal' });
    expect(d.nodes[2]).toMatchObject({ orientation: 'horizontal', width: 140, height: 26, x: 103, y: 57 });
    const back = reduce(d, { type: 'setOrientation', id: 'n3', orientation: 'vertical' });
    expect(back.nodes[2]).toMatchObject({ orientation: 'vertical', width: 26, height: 140, x: 160, y: 0 });
  });

  it('ignores a no-op rotation and non-criteria', () => {
    const d = sampleDiagram();
    expect(reduce(d, { type: 'setOrientation', id: 'n3', orientation: 'vertical' })).toBe(d);
    expect(reduce(d, { type: 'setOrientation', id: 'n1', orientation: 'vertical' })).toBe(d);
  });
});

describe('lines', () => {
  it('commits, inserts, removes and toggles key on level attributes', () => {
    let d = sampleDiagram();
    d = reduce(d, { type: 'commitLine', nodeId: 'n1', index: 1, text: 'Name' });
    expect(level(d, 'n1').attributes[1]).toEqual({ text: 'Name', key: false });
    d = reduce(d, { type: 'insertLine', nodeId: 'n1', index: 1, text: 'Code', key: true });
    expect(level(d, 'n1').attributes.map((a) => a.text)).toEqual(['ProductID', 'Code', 'Name']);
    d = reduce(d, { type: 'toggleKey', nodeId: 'n1', index: 1 });
    expect(level(d, 'n1').attributes[1].key).toBe(false);
    d = reduce(d, { type: 'removeLine', nodeId: 'n1', index: 0 });
    expect(level(d, 'n1').attributes.map((a) => a.text)).toEqual(['Code', 'Name']);
  });

  it('removes a line when committed empty', () => {
    const d = reduce(sampleDiagram(), { type: 'commitLine', nodeId: 'n2', index: 0, text: '' });
    expect(fact(d, 'n2').measures).toEqual(['UnitPrice: Avg +!', '/NetAmount']);
  });

  it('edits fact measures as plain strings and only widens nodes', () => {
    let d = sampleDiagram();
    d = reduce(d, { type: 'insertLine', nodeId: 'n2', index: 3, text: 'Freight', width: 100 });
    expect(fact(d, 'n2').measures.at(-1)).toBe('Freight');
    expect(fact(d, 'n2').width).toBe(168);
    d = reduce(d, { type: 'commitLine', nodeId: 'n2', index: 0, text: 'A very long measure name', width: 250 });
    expect(fact(d, 'n2').width).toBe(250);
  });

  it('ignores out-of-range indexes and key toggles on facts', () => {
    const d = sampleDiagram();
    expect(reduce(d, { type: 'commitLine', nodeId: 'n1', index: 9, text: 'x' })).toBe(d);
    expect(reduce(d, { type: 'toggleKey', nodeId: 'n2', index: 0 })).toBe(d);
  });
});

describe('links and cascades', () => {
  it('rejects links to missing nodes', () => {
    const d = sampleDiagram();
    const next = reduce(d, {
      type: 'addLink',
      link: { ...d.links[0], id: 'l9', target: 'missing' },
    });
    expect(next).toBe(d);
  });

  it('deleting a node removes its links, their factors and emptied arcs', () => {
    const d = reduce(sampleDiagram(), { type: 'deleteElements', ids: ['n2'] });
    expect(d.nodes.map((n) => n.id)).toEqual(['n1', 'n3', 'n4', 'n5']);
    expect(d.links.map((l) => l.id)).toEqual(['l2']);
    expect(d.distributingFactors).toEqual([]);
    expect(d.exclusiveArcs).toEqual([]);
  });

  it('an exclusive arc is removed when fewer than two links remain', () => {
    const d = reduce(sampleDiagram(), { type: 'deleteElements', ids: ['l4'] });
    expect(d.exclusiveArcs).toEqual([]);
    expect(d.links.map((l) => l.id)).toEqual(['l1', 'l2', 'l3']);
  });

  it('reconnecting a link away from the arc node drops it from the arc', () => {
    const d = reduce(sampleDiagram(), { type: 'updateLink', id: 'l4', patch: { target: 'n1' } });
    expect(d.exclusiveArcs).toEqual([]);
  });

  it('deleting a link deletes its distributing factor', () => {
    const d = reduce(sampleDiagram(), { type: 'deleteElements', ids: ['l1'] });
    expect(d.distributingFactors).toEqual([]);
  });
});

describe('link defaults', () => {
  it('new links are (1,1) at both ends, whatever the node kinds', () => {
    const d = sampleDiagram();
    expect(createLink(d, 'n1', 'n4')).toMatchObject({ sourceCard: '1,1', targetCard: '1,1' });
    expect(createLink(d, 'n2', 'n1')).toMatchObject({ sourceCard: '1,1', targetCard: '1,1' });
    expect(createLink(d, 'n1', 'missing')).toBeNull();
  });

  it('infers the link kind from its ends', () => {
    const d = sampleDiagram();
    expect(linkKind(d, d.links[0])).toBe('fact');
    expect(linkKind(d, d.links[1])).toBe('hierarchy');
  });

  it('cycles cardinalities in the documented order', () => {
    expect(['1,1', '0,1', '1,n', '0,n'].map((c) => nextCardinality(c as never))).toEqual(['0,1', '1,n', '0,n', '1,1']);
  });
});

describe('attached criteria', () => {
  const attached = () =>
    reduce(sampleDiagram(), { type: 'updateNode', id: 'n3', patch: { attachedTo: { nodeId: 'n1', side: 'right' } } });

  it('move with their level', () => {
    const d = reduce(attached(), { type: 'moveNodes', positions: { n1: { x: 10, y: 20 } } });
    expect(d.nodes[2]).toMatchObject({ x: 170, y: 20 });
  });

  it('do not move twice when dragged together with their level', () => {
    const d = reduce(attached(), { type: 'moveNodes', positions: { n1: { x: 10, y: 20 }, n3: { x: 170, y: 20 } } });
    expect(d.nodes[2]).toMatchObject({ x: 170, y: 20 });
  });

  it('become free when their level is deleted', () => {
    const d = reduce(attached(), { type: 'deleteElements', ids: ['n1'] });
    expect(d.nodes.find((n) => n.id === 'n3')).toMatchObject({ attachedTo: null });
  });
});
