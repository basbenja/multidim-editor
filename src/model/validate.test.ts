import { describe, expect, it } from 'vitest';
import { link, sampleDiagram } from './fixtures';
import type { Diagram, LevelNode } from './types';
import { validate } from './validate';

const keys = (d: Diagram) => validate(d).map((w) => w.key);

describe('validate', () => {
  it('reports nothing for a clean diagram', () => {
    const d = sampleDiagram();
    // l3/l4 are two Sales–Time links with roles: fine.
    expect(keys(d)).toEqual([]);
  });

  it('flags levels without a key attribute', () => {
    const d = sampleDiagram();
    const p = d.nodes[0] as LevelNode;
    d.nodes[0] = { ...p, attributes: p.attributes.map((a) => ({ ...a, key: false })) };
    expect(validate(d)).toEqual([
      { key: 'no-key:n1', message: 'Level "Product" has no key attribute.', elementIds: ['n1'] },
    ]);
  });

  it('flags nodes with an empty name, of any kind', () => {
    const d = sampleDiagram();
    d.nodes[1] = { ...d.nodes[1], name: '  ' };
    d.nodes[2] = { ...d.nodes[2], name: '' };
    expect(keys(d)).toEqual(['empty-name:n2', 'empty-name:n3']);
  });

  it('flags levels and facts sharing a name, ignoring case', () => {
    const d = sampleDiagram();
    d.nodes[3] = { ...d.nodes[3], name: 'product' };
    d.nodes[1] = { ...d.nodes[1], name: 'Product' };
    const [w] = validate(d);
    expect(w.elementIds).toEqual(['n1', 'n2', 'n4']);
    expect(w.message).toBe('3 levels/facts are named "Product".');
  });

  it('does not count criteria as duplicates', () => {
    const d = sampleDiagram();
    d.nodes[2] = { ...d.nodes[2], name: 'Product' };
    expect(keys(d)).toEqual([]);
  });

  it('flags facts without links', () => {
    const d = sampleDiagram();
    d.links = d.links.filter((l) => l.source !== 'n2' && l.target !== 'n2');
    d.exclusiveArcs = [];
    d.distributingFactors = [];
    expect(keys(d)).toEqual(['no-links:n2']);
  });

  it('flags the unnamed links among several between the same fact and level', () => {
    const d = sampleDiagram();
    d.links = [...d.links, link('l5', 'n5', 'n2')];
    d.links[3] = { ...d.links[3], sourceRole: null };
    expect(validate(d)).toEqual([
      { key: 'role:l4,l5', message: '2 of the 3 links between "Sales" and "Time" have no role name.', elementIds: ['l4', 'l5'] },
    ]);
  });

  it('accepts a role on either end, and ignores single links', () => {
    const d = sampleDiagram();
    d.links[3] = { ...d.links[3], sourceRole: null, targetRole: 'DueDate' };
    expect(keys(d)).toEqual([]);
  });
});
