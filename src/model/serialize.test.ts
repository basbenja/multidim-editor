import { describe, expect, it } from 'vitest';
import { sampleDiagram } from './fixtures';
import { DiagramParseError, parseDiagram, serializeDiagram } from './serialize';

describe('JSON round-trip', () => {
  it('parse(serialize(d)) equals d', () => {
    const d = sampleDiagram();
    expect(parseDiagram(serializeDiagram(d))).toEqual(d);
  });

  it('fills defaults for optional fields', () => {
    const d = parseDiagram(
      JSON.stringify({
        version: 1,
        nodes: [
          { id: 'a', kind: 'level', x: 0, y: 0, width: 100, name: 'A', attributes: ['Plain'] },
          { id: 'b', kind: 'level', x: 0, y: 0, width: 100, name: 'B' },
        ],
        links: [{ id: 'l', source: 'a', target: 'b', sourceCard: '1,n', targetCard: '1,1' }],
      }),
    );
    expect(d.nodes[0]).toMatchObject({ attributes: [{ text: 'Plain', key: false }] });
    expect(d.links[0]).toMatchObject({ routing: 'orthogonal', waypoints: [], sourceRole: null, sourceRoleOffset: null });
    expect(d.distributingFactors).toEqual([]);
  });

  it('drops dangling references', () => {
    const d = sampleDiagram();
    const raw = { ...d, links: [...d.links, { ...d.links[0], id: 'l9', target: 'ghost' }] };
    expect(parseDiagram(JSON.stringify(raw)).links.map((l) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4']);
  });

  it.each([
    ['not json', 'The file is not valid JSON.'],
    ['{"nodes": []}', 'Missing "version" field.'],
    ['{"version": 99, "nodes": []}', 'version 99'],
    ['{"version": 1, "nodes": [{"id": "a", "kind": "blob", "x": 0, "y": 0, "width": 1}]}', 'kind'],
    [
      '{"version": 1, "nodes": [{"id":"a","kind":"level","x":0,"y":0,"width":1},{"id":"a","kind":"level","x":0,"y":0,"width":1}]}',
      'Duplicate id',
    ],
  ])('rejects invalid input: %s', (text, message) => {
    expect(() => parseDiagram(text)).toThrow(DiagramParseError);
    expect(() => parseDiagram(text)).toThrow(message);
  });
});
