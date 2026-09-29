import { CRITERION_THICKNESS, DEFAULT_NODE_WIDTH } from '../lib/style';
import { nextId, uniqueName } from './ids';
import {
  CARDINALITIES,
  type Cardinality,
  type Diagram,
  type DiagramNode,
  type DistributingFactor,
  type ExclusiveArc,
  type Link,
  type NodeKind,
  type Point,
  type Side,
} from './types';

/** Creates a new node of `kind` whose top-left corner is at `at`, with a unique id and name. */
export function createNode(d: Diagram, kind: NodeKind, at: Point): DiagramNode {
  const id = nextId('n', d.nodes.map((n) => n.id));
  const names = d.nodes.filter((n) => n.kind === kind).map((n) => n.name);
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  switch (kind) {
    case 'level': {
      const name = uniqueName('Level', names);
      return { id, kind, x, y, width: DEFAULT_NODE_WIDTH, name, attributes: [{ text: `${name}ID`, key: true }] };
    }
    case 'fact':
      return { id, kind, x, y, width: DEFAULT_NODE_WIDTH + 8, name: uniqueName('Fact', names), measures: ['Measure'] };
    case 'criterion':
      return {
        id,
        kind,
        x,
        y,
        width: 110,
        height: CRITERION_THICKNESS,
        name: uniqueName('Criterion', names),
        orientation: 'horizontal',
        attachedTo: null,
      };
  }
}

/** Default size used to center a freshly created node on a point. */
export function approxSize(kind: NodeKind): { width: number; height: number } {
  if (kind === 'criterion') return { width: 110, height: CRITERION_THICKNESS };
  return { width: DEFAULT_NODE_WIDTH, height: 60 };
}

/** Creates a link between two existing nodes; both ends start as (1,1). */
export function createLink(d: Diagram, source: string, target: string): Link | null {
  if (!d.nodes.some((n) => n.id === source) || !d.nodes.some((n) => n.id === target)) return null;
  return {
    id: nextId('l', d.links.map((l) => l.id)),
    source,
    target,
    sourceCard: '1,1',
    targetCard: '1,1',
    sourceRole: null,
    targetRole: null,
    sourceRoleOffset: null,
    targetRoleOffset: null,
    routing: 'orthogonal',
    waypoints: [],
  };
}

/** (1,1) → (0,1) → (1,n) → (0,n) → (1,1). */
export function nextCardinality(c: Cardinality): Cardinality {
  return CARDINALITIES[(CARDINALITIES.indexOf(c) + 1) % CARDINALITIES.length];
}

export type LinkKind = 'fact' | 'hierarchy';

/** A link touching a fact is a fact link; any other link is a hierarchy link. */
export function linkKind(d: Diagram, l: Link): LinkKind {
  const isFact = (id: string) => d.nodes.some((n) => n.id === id && n.kind === 'fact');
  return isFact(l.source) || isFact(l.target) ? 'fact' : 'hierarchy';
}

/** A distributing factor halfway along `linkId`, its box offset below/right of the link. */
export function createFactor(d: Diagram, linkId: string, offset: Point): DistributingFactor {
  return {
    id: nextId('d', d.distributingFactors.map((f) => f.id)),
    linkId,
    text: 'percentage ÷',
    t: 0.5,
    dx: Math.round(offset.x),
    dy: Math.round(offset.y),
  };
}

/**
 * The node shared by all the given links, if they are at least two distinct
 * links and have one; this is where an exclusive relationship would go.
 */
export function exclusiveArcCandidate(d: Diagram, ids: string[]): { nodeId: string; linkIds: string[] } | null {
  const links = d.links.filter((l) => ids.includes(l.id));
  if (links.length < 2 || links.length !== ids.length) return null;
  const shared = [links[0].source, links[0].target].find((n) => links.every((l) => l.source === n || l.target === n));
  return shared ? { nodeId: shared, linkIds: links.map((l) => l.id) } : null;
}

export function createArc(d: Diagram, nodeId: string, linkIds: string[], side: Side, distance: number): ExclusiveArc {
  return { id: nextId('x', d.exclusiveArcs.map((x) => x.id)), nodeId, linkIds, side, distance };
}
