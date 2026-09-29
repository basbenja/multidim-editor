import { cleanup } from './reducer';
import {
  CARDINALITIES,
  DIAGRAM_VERSION,
  type Attribute,
  type Cardinality,
  type Diagram,
  type DiagramNode,
  type DistributingFactor,
  type ExclusiveArc,
  type Link,
  type Point,
  type Side,
} from './types';

export class DiagramParseError extends Error {}

export function serializeDiagram(d: Diagram): string {
  return JSON.stringify(d, null, 2);
}

/**
 * Parses and validates a diagram document. Missing optional fields get
 * defaults; structurally invalid input throws `DiagramParseError`.
 */
export function parseDiagram(text: string): Diagram {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DiagramParseError('The file is not valid JSON.');
  }
  return normalizeDiagram(raw);
}

export function normalizeDiagram(raw: unknown): Diagram {
  const doc = obj(raw, 'document');
  const version = doc.version;
  if (typeof version !== 'number') throw new DiagramParseError('Missing "version" field.');
  if (version > DIAGRAM_VERSION) {
    throw new DiagramParseError(`This file uses version ${version}; this editor supports up to ${DIAGRAM_VERSION}.`);
  }
  const nodes = arr(doc.nodes, 'nodes').map((n, i) => parseNode(n, `nodes[${i}]`));
  const links = arr(doc.links ?? [], 'links').map((l, i) => parseLink(l, `links[${i}]`));
  const distributingFactors = arr(doc.distributingFactors ?? [], 'distributingFactors').map((f, i) =>
    parseFactor(f, `distributingFactors[${i}]`),
  );
  const exclusiveArcs = arr(doc.exclusiveArcs ?? [], 'exclusiveArcs').map((x, i) =>
    parseArc(x, `exclusiveArcs[${i}]`),
  );
  const ids = [...nodes, ...links, ...distributingFactors, ...exclusiveArcs].map((e) => e.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new DiagramParseError(`Duplicate id "${dup}".`);
  return cleanup({ version: DIAGRAM_VERSION, nodes, links, distributingFactors, exclusiveArcs });
}

function parseNode(raw: unknown, path: string): DiagramNode {
  const o = obj(raw, path);
  const base = {
    id: str(o.id, `${path}.id`),
    x: num(o.x, `${path}.x`),
    y: num(o.y, `${path}.y`),
    width: num(o.width ?? 150, `${path}.width`),
    name: typeof o.name === 'string' ? o.name : '',
  };
  switch (o.kind) {
    case 'level':
      return {
        ...base,
        kind: 'level',
        attributes: arr(o.attributes ?? [], `${path}.attributes`).map((a, i) => parseAttribute(a, `${path}.attributes[${i}]`)),
      };
    case 'fact':
      return {
        ...base,
        kind: 'fact',
        measures: arr(o.measures ?? [], `${path}.measures`).map((m, i) => str(m, `${path}.measures[${i}]`)),
      };
    case 'criterion':
      return {
        ...base,
        kind: 'criterion',
        height: num(o.height, `${path}.height`),
        orientation: o.orientation === 'vertical' ? 'vertical' : 'horizontal',
        attachedTo: parseAttachment(o.attachedTo, `${path}.attachedTo`),
      };
    default:
      throw new DiagramParseError(`${path}.kind must be "level", "fact" or "criterion".`);
  }
}

function parseAttachment(raw: unknown, path: string): { nodeId: string; side: Side } | null {
  if (raw === null || raw === undefined) return null;
  const o = obj(raw, path);
  if (!SIDES.includes(o.side as Side)) throw new DiagramParseError(`${path}.side must be top, right, bottom or left.`);
  return { nodeId: str(o.nodeId, `${path}.nodeId`), side: o.side as Side };
}

function parseAttribute(raw: unknown, path: string): Attribute {
  if (typeof raw === 'string') return { text: raw, key: false };
  const o = obj(raw, path);
  return { text: str(o.text, `${path}.text`), key: o.key === true };
}

function parseLink(raw: unknown, path: string): Link {
  const o = obj(raw, path);
  return {
    id: str(o.id, `${path}.id`),
    source: str(o.source, `${path}.source`),
    target: str(o.target, `${path}.target`),
    sourceCard: card(o.sourceCard, `${path}.sourceCard`),
    targetCard: card(o.targetCard, `${path}.targetCard`),
    sourceRole: optStr(o.sourceRole),
    targetRole: optStr(o.targetRole),
    sourceRoleOffset: optPoint(o.sourceRoleOffset, `${path}.sourceRoleOffset`),
    targetRoleOffset: optPoint(o.targetRoleOffset, `${path}.targetRoleOffset`),
    routing: o.routing === 'straight' ? 'straight' : 'orthogonal',
    waypoints: arr(o.waypoints ?? [], `${path}.waypoints`).map((p, i) => point(p, `${path}.waypoints[${i}]`)),
  };
}

function parseFactor(raw: unknown, path: string): DistributingFactor {
  const o = obj(raw, path);
  return {
    id: str(o.id, `${path}.id`),
    linkId: str(o.linkId, `${path}.linkId`),
    text: typeof o.text === 'string' ? o.text : '',
    t: Math.max(0, Math.min(1, num(o.t ?? 0.5, `${path}.t`))),
    dx: num(o.dx ?? 0, `${path}.dx`),
    dy: num(o.dy ?? 40, `${path}.dy`),
  };
}

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

function parseArc(raw: unknown, path: string): ExclusiveArc {
  const o = obj(raw, path);
  return {
    id: str(o.id, `${path}.id`),
    nodeId: str(o.nodeId, `${path}.nodeId`),
    linkIds: arr(o.linkIds, `${path}.linkIds`).map((id, i) => str(id, `${path}.linkIds[${i}]`)),
    side: SIDES.includes(o.side as Side) ? (o.side as Side) : 'right',
    distance: num(o.distance ?? 30, `${path}.distance`),
  };
}

function obj(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new DiagramParseError(`${path} must be an object.`);
  return v as Record<string, unknown>;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new DiagramParseError(`${path} must be an array.`);
  return v;
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string') throw new DiagramParseError(`${path} must be a string.`);
  return v;
}

function optStr(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

function num(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new DiagramParseError(`${path} must be a number.`);
  return v;
}

function point(v: unknown, path: string): Point {
  const o = obj(v, path);
  return { x: num(o.x, `${path}.x`), y: num(o.y, `${path}.y`) };
}

function optPoint(v: unknown, path: string): Point | null {
  return v === null || v === undefined ? null : point(v, path);
}

function card(v: unknown, path: string): Cardinality {
  if (!CARDINALITIES.includes(v as Cardinality)) {
    throw new DiagramParseError(`${path} must be one of ${CARDINALITIES.join(', ')}.`);
  }
  return v as Cardinality;
}
