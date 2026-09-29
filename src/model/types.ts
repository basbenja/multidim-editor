export interface Point {
  x: number;
  y: number;
}

export type Cardinality = '1,1' | '0,1' | '1,n' | '0,n';
export const CARDINALITIES: Cardinality[] = ['1,1', '0,1', '1,n', '0,n'];

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Orientation = 'horizontal' | 'vertical';
export type Routing = 'orthogonal' | 'straight';

export interface Attribute {
  text: string;
  key: boolean;
}

interface NodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  name: string;
}

export interface LevelNode extends NodeBase {
  kind: 'level';
  attributes: Attribute[];
}

export interface FactNode extends NodeBase {
  kind: 'fact';
  measures: string[];
}

export interface CriterionNode extends NodeBase {
  kind: 'criterion';
  height: number;
  orientation: Orientation;
  /**
   * Level whose side the criterion is snapped to. While attached, its
   * position and length follow that side (x/y/width/height are then only a
   * snapshot).
   */
  attachedTo: { nodeId: string; side: Side } | null;
}

export type DiagramNode = LevelNode | FactNode | CriterionNode;
export type NodeKind = DiagramNode['kind'];

export interface Link {
  id: string;
  source: string;
  target: string;
  sourceCard: Cardinality;
  targetCard: Cardinality;
  sourceRole: string | null;
  targetRole: string | null;
  /** Manual offset of the role label from its default position. */
  sourceRoleOffset: Point | null;
  targetRoleOffset: Point | null;
  routing: Routing;
  /** Interior bend points in absolute diagram coordinates. */
  waypoints: Point[];
}

export interface DistributingFactor {
  id: string;
  linkId: string;
  text: string;
  /** Attachment point as a fraction of the link's length (0..1). */
  t: number;
  /** Box offset from the attachment point. */
  dx: number;
  dy: number;
}

export interface ExclusiveArc {
  id: string;
  nodeId: string;
  linkIds: string[];
  /** Side of the shared node the arc runs parallel to. */
  side: Side;
  /** Distance of the arc from that side. */
  distance: number;
}

export const DIAGRAM_VERSION = 1;

export interface Diagram {
  version: typeof DIAGRAM_VERSION;
  nodes: DiagramNode[];
  links: Link[];
  distributingFactors: DistributingFactor[];
  exclusiveArcs: ExclusiveArc[];
}

export function emptyDiagram(): Diagram {
  return { version: DIAGRAM_VERSION, nodes: [], links: [], distributingFactors: [], exclusiveArcs: [] };
}
