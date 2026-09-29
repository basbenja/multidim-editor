import type {
  Attribute,
  CriterionNode,
  Diagram,
  DiagramNode,
  DistributingFactor,
  ExclusiveArc,
  FactNode,
  LevelNode,
  Link,
  Orientation,
  Point,
} from './types';

export type NodePatch = Partial<Omit<LevelNode, 'id' | 'kind'>> &
  Partial<Omit<FactNode, 'id' | 'kind'>> &
  Partial<Omit<CriterionNode, 'id' | 'kind'>>;

export type Action =
  | { type: 'replace'; diagram: Diagram }
  | { type: 'addNode'; node: DiagramNode }
  | { type: 'updateNode'; id: string; patch: NodePatch }
  | { type: 'moveNodes'; positions: Record<string, Point> }
  /** Rotates a criterion in place: swaps its width and height around its center. */
  | { type: 'setOrientation'; id: string; orientation: Orientation }
  /** Replace line `index` (attribute or measure). Empty text removes the line. */
  | { type: 'commitLine'; nodeId: string; index: number; text: string; key?: boolean; width?: number }
  | { type: 'insertLine'; nodeId: string; index: number; text: string; key?: boolean; width?: number }
  | { type: 'removeLine'; nodeId: string; index: number }
  | { type: 'toggleKey'; nodeId: string; index: number }
  | { type: 'addLink'; link: Link }
  | { type: 'updateLink'; id: string; patch: Partial<Omit<Link, 'id'>> }
  | { type: 'addFactor'; factor: DistributingFactor }
  | { type: 'updateFactor'; id: string; patch: Partial<Omit<DistributingFactor, 'id' | 'linkId'>> }
  | { type: 'addArc'; arc: ExclusiveArc }
  | { type: 'updateArc'; id: string; patch: Partial<Omit<ExclusiveArc, 'id'>> }
  /** Delete any mix of node, link, factor and arc ids, with cascades. */
  | { type: 'deleteElements'; ids: string[] };

export function reduce(d: Diagram, a: Action): Diagram {
  switch (a.type) {
    case 'replace':
      return a.diagram;

    case 'addNode':
      return { ...d, nodes: [...d.nodes, a.node] };

    case 'updateNode':
      return mapNode(d, a.id, (n) => ({ ...n, ...defined(a.patch) }) as DiagramNode);

    case 'moveNodes':
      return moveNodes(d, a.positions);

    case 'setOrientation':
      return mapNode(d, a.id, (n) => {
        if (n.kind !== 'criterion' || n.orientation === a.orientation) return n;
        const cx = n.x + n.width / 2;
        const cy = n.y + n.height / 2;
        return {
          ...n,
          orientation: a.orientation,
          width: n.height,
          height: n.width,
          x: Math.round(cx - n.height / 2),
          y: Math.round(cy - n.width / 2),
        };
      });

    case 'commitLine':
      return mapNode(d, a.nodeId, (n) => {
        if (n.kind === 'criterion' || a.index < 0 || a.index >= lineCount(n)) return n;
        const withWidth = widen(n, a.width);
        if (a.text === '') return removeLineAt(withWidth, a.index);
        if (withWidth.kind === 'level') {
          const attributes = withWidth.attributes.slice();
          attributes[a.index] = { text: a.text, key: a.key ?? attributes[a.index].key };
          return { ...withWidth, attributes };
        }
        const measures = withWidth.measures.slice();
        measures[a.index] = a.text;
        return { ...withWidth, measures };
      });

    case 'insertLine':
      return mapNode(d, a.nodeId, (n) => {
        if (n.kind === 'criterion') return n;
        const index = clamp(a.index, 0, lineCount(n));
        const withWidth = widen(n, a.width);
        if (withWidth.kind === 'level') {
          const attr: Attribute = { text: a.text, key: a.key ?? false };
          return { ...withWidth, attributes: insertAt(withWidth.attributes, index, attr) };
        }
        return { ...withWidth, measures: insertAt(withWidth.measures, index, a.text) };
      });

    case 'removeLine':
      return mapNode(d, a.nodeId, (n) => (n.kind === 'criterion' ? n : removeLineAt(n, a.index)));

    case 'toggleKey':
      return mapNode(d, a.nodeId, (n) => {
        if (n.kind !== 'level' || !n.attributes[a.index]) return n;
        const attributes = n.attributes.slice();
        attributes[a.index] = { ...attributes[a.index], key: !attributes[a.index].key };
        return { ...n, attributes };
      });

    case 'addLink':
      if (!hasNode(d, a.link.source) || !hasNode(d, a.link.target)) return d;
      return { ...d, links: [...d.links, a.link] };

    case 'updateLink': {
      const links = replaceById(d.links, a.id, (l) => ({ ...l, ...defined(a.patch) }));
      return links === d.links ? d : cleanup({ ...d, links });
    }

    case 'addFactor':
      if (!d.links.some((l) => l.id === a.factor.linkId)) return d;
      return { ...d, distributingFactors: [...d.distributingFactors, a.factor] };

    case 'updateFactor': {
      const distributingFactors = replaceById(d.distributingFactors, a.id, (f) => ({ ...f, ...defined(a.patch) }));
      return distributingFactors === d.distributingFactors ? d : { ...d, distributingFactors };
    }

    case 'addArc':
      return cleanup({ ...d, exclusiveArcs: [...d.exclusiveArcs, a.arc] });

    case 'updateArc': {
      const exclusiveArcs = replaceById(d.exclusiveArcs, a.id, (x) => ({ ...x, ...defined(a.patch) }));
      return exclusiveArcs === d.exclusiveArcs ? d : cleanup({ ...d, exclusiveArcs });
    }

    case 'deleteElements': {
      if (a.ids.length === 0) return d;
      const ids = new Set(a.ids);
      return cleanup({
        ...d,
        nodes: d.nodes.filter((n) => !ids.has(n.id)),
        links: d.links.filter((l) => !ids.has(l.id)),
        distributingFactors: d.distributingFactors.filter((f) => !ids.has(f.id)),
        exclusiveArcs: d.exclusiveArcs.filter((x) => !ids.has(x.id)),
      });
    }
  }
}

/**
 * Removes dangling references: links whose endpoints are gone, factors whose
 * link is gone, and arc members that no longer touch the arc's node. Arcs with
 * fewer than two remaining links are removed.
 */
export function cleanup(d: Diagram): Diagram {
  const nodeIds = new Set(d.nodes.map((n) => n.id));
  const levelIds = new Set(d.nodes.filter((n) => n.kind === 'level').map((n) => n.id));
  // Criteria attached to a level that no longer exists become free.
  let nodes = d.nodes;
  if (d.nodes.some((n) => n.kind === 'criterion' && n.attachedTo && !levelIds.has(n.attachedTo.nodeId))) {
    nodes = d.nodes.map((n) =>
      n.kind === 'criterion' && n.attachedTo && !levelIds.has(n.attachedTo.nodeId) ? { ...n, attachedTo: null } : n,
    );
  }
  const links = d.links.filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));
  const linkById = new Map(links.map((l) => [l.id, l]));
  const distributingFactors = d.distributingFactors.filter((f) => linkById.has(f.linkId));
  const exclusiveArcs: ExclusiveArc[] = [];
  for (const arc of d.exclusiveArcs) {
    if (!nodeIds.has(arc.nodeId)) continue;
    const linkIds = arc.linkIds.filter((id) => {
      const l = linkById.get(id);
      return l !== undefined && (l.source === arc.nodeId || l.target === arc.nodeId);
    });
    if (linkIds.length < 2) continue;
    exclusiveArcs.push(linkIds.length === arc.linkIds.length ? arc : { ...arc, linkIds });
  }
  const same =
    nodes === d.nodes &&
    links.length === d.links.length &&
    distributingFactors.length === d.distributingFactors.length &&
    exclusiveArcs.length === d.exclusiveArcs.length &&
    exclusiveArcs.every((x, i) => x === d.exclusiveArcs[i]);
  return same ? d : { ...d, nodes, links, distributingFactors, exclusiveArcs };
}

export function lineCount(n: DiagramNode): number {
  if (n.kind === 'level') return n.attributes.length;
  if (n.kind === 'fact') return n.measures.length;
  return 0;
}

function moveNodes(d: Diagram, positions: Record<string, Point>): Diagram {
  const deltas = new Map<string, Point>();
  let nodes = d.nodes.map((n) => {
    const p = positions[n.id];
    if (!p || (p.x === n.x && p.y === n.y)) return n;
    deltas.set(n.id, { x: p.x - n.x, y: p.y - n.y });
    return { ...n, x: p.x, y: p.y };
  });
  if (deltas.size === 0) return d;
  // Attached criteria travel with their level.
  nodes = nodes.map((n) => {
    if (n.kind !== 'criterion' || !n.attachedTo || positions[n.id]) return n;
    const delta = deltas.get(n.attachedTo.nodeId);
    if (!delta) return n;
    deltas.set(n.id, delta);
    return { ...n, x: n.x + delta.x, y: n.y + delta.y };
  });
  // Links whose both ends moved by the same amount keep their shape.
  const links = d.links.map((l) => {
    const ds = deltas.get(l.source);
    const dt = deltas.get(l.target);
    if (!ds || !dt || ds.x !== dt.x || ds.y !== dt.y || l.waypoints.length === 0) return l;
    return { ...l, waypoints: l.waypoints.map((w) => ({ x: w.x + ds.x, y: w.y + ds.y })) };
  });
  return { ...d, nodes, links };
}

function removeLineAt<T extends LevelNode | FactNode>(n: T, index: number): T {
  if (n.kind === 'level') {
    if (index < 0 || index >= n.attributes.length) return n;
    return { ...n, attributes: n.attributes.filter((_, i) => i !== index) };
  }
  const f = n as FactNode;
  if (index < 0 || index >= f.measures.length) return n;
  return { ...f, measures: f.measures.filter((_, i) => i !== index) } as T;
}

function widen<T extends DiagramNode>(n: T, width: number | undefined): T {
  return width !== undefined && width > n.width ? { ...n, width } : n;
}

function mapNode(d: Diagram, id: string, fn: (n: DiagramNode) => DiagramNode): Diagram {
  const nodes = replaceById(d.nodes, id, fn);
  return nodes === d.nodes ? d : { ...d, nodes };
}

function replaceById<T extends { id: string }>(items: T[], id: string, fn: (item: T) => T): T[] {
  const i = items.findIndex((it) => it.id === id);
  if (i < 0) return items;
  const next = fn(items[i]);
  if (next === items[i]) return items;
  const copy = items.slice();
  copy[i] = next;
  return copy;
}

function hasNode(d: Diagram, id: string): boolean {
  return d.nodes.some((n) => n.id === id);
}

/** Drops keys whose value is undefined so a patch never erases fields. */
function defined<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function insertAt<T>(items: T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
