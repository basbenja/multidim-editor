import { describe, expect, it } from 'vitest';
import { sampleDiagram } from './fixtures';
import { beginGesture, commit, createHistory, endGesture, redo, transient, undo } from './history';

describe('history', () => {
  it('undoes and redoes committed actions', () => {
    let h = createHistory(sampleDiagram());
    const start = h.present;
    h = commit(h, { type: 'updateNode', id: 'n1', patch: { name: 'A' } });
    h = commit(h, { type: 'updateNode', id: 'n1', patch: { name: 'B' } });
    expect(h.present.nodes[0].name).toBe('B');
    h = undo(h);
    expect(h.present.nodes[0].name).toBe('A');
    h = undo(h);
    expect(h.present).toBe(start);
    h = redo(h);
    expect(h.present.nodes[0].name).toBe('A');
  });

  it('does not record no-op actions', () => {
    const h = createHistory(sampleDiagram());
    expect(commit(h, { type: 'updateNode', id: 'missing', patch: { name: 'x' } })).toBe(h);
  });

  it('a new commit clears the redo stack', () => {
    let h = createHistory(sampleDiagram());
    h = commit(h, { type: 'updateNode', id: 'n1', patch: { name: 'A' } });
    h = undo(h);
    h = commit(h, { type: 'updateNode', id: 'n1', patch: { name: 'C' } });
    expect(h.future).toEqual([]);
  });

  it('collapses a gesture into a single undo step', () => {
    let h = createHistory(sampleDiagram());
    const start = h.present;
    h = beginGesture(h);
    for (let i = 1; i <= 10; i++) h = transient(h, { type: 'moveNodes', positions: { n1: { x: i, y: i } } });
    h = endGesture(h);
    expect(h.past).toHaveLength(1);
    expect(h.present.nodes[0]).toMatchObject({ x: 10, y: 10 });
    h = undo(h);
    expect(h.present).toBe(start);
  });

  it('an empty gesture records nothing', () => {
    let h = createHistory(sampleDiagram());
    h = endGesture(beginGesture(h));
    expect(h.past).toHaveLength(0);
  });
});
