import type { Diagram, Link } from './types';

export function link(id: string, source: string, target: string, extra: Partial<Link> = {}): Link {
  return {
    id,
    source,
    target,
    sourceCard: '1,n',
    targetCard: '1,1',
    sourceRole: null,
    targetRole: null,
    sourceRoleOffset: null,
    targetRoleOffset: null,
    routing: 'orthogonal',
    waypoints: [],
    ...extra,
  };
}

/** Small diagram: Sales fact linked to Product and Time, Product → Category via a criterion. */
export function sampleDiagram(): Diagram {
  return {
    version: 1,
    nodes: [
      {
        id: 'n1',
        kind: 'level',
        x: 0,
        y: 0,
        width: 160,
        name: 'Product',
        attributes: [
          { text: 'ProductID', key: true },
          { text: 'ProductName', key: false },
        ],
      },
      { id: 'n2', kind: 'fact', x: 300, y: 0, width: 168, name: 'Sales', measures: ['Quantity', 'UnitPrice: Avg +!', '/NetAmount'] },
      { id: 'n3', kind: 'criterion', x: 160, y: 0, width: 26, height: 140, name: 'Categories', orientation: 'vertical', attachedTo: null },
      { id: 'n4', kind: 'level', x: 0, y: 300, width: 160, name: 'Category', attributes: [{ text: 'CategoryID', key: true }] },
      { id: 'n5', kind: 'level', x: 600, y: 0, width: 160, name: 'Time', attributes: [{ text: 'Date', key: true }] },
    ],
    links: [
      link('l1', 'n2', 'n1'),
      link('l2', 'n3', 'n4'),
      link('l3', 'n2', 'n5', { sourceRole: 'OrderDate', waypoints: [{ x: 500, y: 20 }] }),
      link('l4', 'n2', 'n5', { sourceRole: 'DueDate' }),
    ],
    distributingFactors: [{ id: 'd1', linkId: 'l1', text: 'percentage ÷', t: 0.5, dx: 0, dy: 40 }],
    exclusiveArcs: [{ id: 'x1', nodeId: 'n5', linkIds: ['l3', 'l4'], side: 'left', distance: 30 }],
  };
}
