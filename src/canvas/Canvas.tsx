import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type Connection,
  type ConnectionLineComponentProps,
  type EdgeChange,
  type NodeChange,
  type OnConnectStart,
  type OnNodeDrag,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, type DragEvent, type MouseEvent } from 'react';
import { attachCriterion, findAttachment, resolveAttachments, type Attachment } from '../geometry/attach';
import { snapToGuides, unionRect, visualBox, type Guide } from '../geometry/guides';
import { borderPoint, computeRoutes, nodeBox, pathD } from '../geometry/route';
import { approxSize, createLink, createNode } from '../model/factory';
import type { Diagram, DiagramNode, Link, NodeKind, Point } from '../model/types';
import { selectDiagram, useEditor, type Size } from '../store/editor';
import { edgeTypes, RoutesContext, type MDEdge } from './edges/LinkEdge';
import { AlignmentGuides } from './overlays/AlignmentGuides';
import { ExclusiveArcs } from './overlays/ExclusiveArcs';
import { nodeTypes, type MDNode } from './nodes/nodes';

export const PALETTE_MIME = 'application/x-multidim-node';

/** Adds a node of `kind` centered on `center` and starts editing its name. */
export function addNodeAt(kind: NodeKind, center: Point) {
  const { history, dispatch, setSelection, setEditing } = useEditor.getState();
  const size = approxSize(kind);
  const node = createNode(history.present, kind, { x: center.x - size.width / 2, y: center.y - size.height / 2 });
  dispatch({ type: 'addNode', node });
  setSelection([node.id]);
  setEditing({ kind: 'name', nodeId: node.id });
}

/** Maps diagram elements to React Flow objects, reusing unchanged ones. */
function useCached<S, R>(items: S[], getId: (s: S) => string, key: (s: S) => unknown[], build: (s: S) => R): R[] {
  const cache = useRef(new Map<string, { key: unknown[]; value: R }>());
  const next = new Map<string, { key: unknown[]; value: R }>();
  const out = items.map((item) => {
    const id = getId(item);
    const k = key(item);
    const hit = cache.current.get(id);
    if (hit && hit.key.length === k.length && hit.key.every((v, i) => v === k[i])) {
      next.set(id, hit);
      return hit.value;
    }
    const value = build(item);
    next.set(id, { key: k, value });
    return value;
  });
  cache.current = next;
  return out;
}

function useFlowNodes(nodes: DiagramNode[], selected: Set<string>, sizes: Record<string, Size>): MDNode[] {
  return useCached(
    nodes,
    (n) => n.id,
    (n) => [n, selected.has(n.id), sizes[n.id]],
    (n) => ({
      id: n.id,
      type: n.kind,
      position: { x: n.x, y: n.y },
      width: n.width,
      height: n.kind === 'criterion' ? n.height : undefined,
      // Feeding measurements back is what lets React Flow show the node.
      measured: sizes[n.id],
      data: { node: n },
      selected: selected.has(n.id),
      zIndex: 0,
    }),
  );
}

function useFlowEdges(links: Link[], selected: Set<string>): MDEdge[] {
  return useCached(
    links,
    (l) => l.id,
    (l) => [l, selected.has(l.id)],
    (l) => ({
      id: l.id,
      type: 'link',
      source: l.source,
      target: l.target,
      data: { link: l },
      selected: selected.has(l.id),
      // Above nodes, so that link ends stay clickable next to node borders.
      zIndex: 1,
    }),
  );
}

/** Dashed line from the border of the node being linked to the pointer. */
function ConnectionLine({ fromNode, toX, toY }: ConnectionLineComponentProps) {
  const box = {
    x: fromNode.internals.positionAbsolute.x,
    y: fromNode.internals.positionAbsolute.y,
    w: fromNode.measured.width ?? 0,
    h: fromNode.measured.height ?? 0,
    depth: 0,
  };
  const to = { x: toX, y: toY };
  return <path className="md-connection-line" d={pathD([borderPoint(box, to), to])} />;
}

/** Screen distance (px) within which a dragged box snaps into alignment. */
const GUIDE_SNAP_PX = 6;

/**
 * Smart guides: shifts the dragged nodes so that the group's left/center/
 * right or top/middle/bottom lines up with another box within `threshold`.
 */
function snapPositions(positions: Record<string, Point>, threshold: number): { positions: Record<string, Point>; guides: Guide[] } {
  const { history, sizes } = useEditor.getState();
  const view = resolveAttachments(history.present, sizes);
  const moving = [];
  const others = [];
  for (const n of view.nodes) {
    const p = positions[n.id];
    if (p) moving.push(visualBox({ ...n, x: p.x, y: p.y }, sizes[n.id]));
    // Criteria attached to a dragged level move with it.
    else if (!(n.kind === 'criterion' && n.attachedTo && positions[n.attachedTo.nodeId])) others.push(visualBox(n, sizes[n.id]));
  }
  if (moving.length === 0 || others.length === 0) return { positions, guides: [] };
  const { dx, dy, guides } = snapToGuides(unionRect(moving), others, threshold);
  if (dx === 0 && dy === 0) return { positions, guides };
  const shifted: Record<string, Point> = {};
  for (const [id, p] of Object.entries(positions)) shifted[id] = { x: Math.round(p.x + dx), y: Math.round(p.y + dy) };
  return { positions: shifted, guides };
}

/**
 * Where each dragged criterion would snap: the closest level side within
 * reach, ignoring levels that are being dragged along with it.
 */
function snapTargets(view: Diagram, draggedIds: Set<string>): Map<string, Attachment> {
  const { sizes } = useEditor.getState();
  const levels = view.nodes
    .filter((n) => n.kind === 'level' && !draggedIds.has(n.id))
    .map((n) => ({ id: n.id, box: nodeBox(n, sizes[n.id]) }));
  const out = new Map<string, Attachment>();
  for (const n of view.nodes) {
    if (n.kind !== 'criterion' || !draggedIds.has(n.id)) continue;
    const target = findAttachment(nodeBox(n, undefined), levels);
    if (target) out.set(n.id, target);
  }
  return out;
}

/**
 * Applies React Flow select changes to the store selection. Distributing
 * factors and exclusive arcs are selected on their own, so any node/link
 * selection change drops them.
 */
function applySelectChanges(changes: (NodeChange<MDNode> | EdgeChange<MDEdge>)[]) {
  const s = useEditor.getState();
  const { nodes, links } = s.history.present;
  const isFlowElement = (id: string) => nodes.some((n) => n.id === id) || links.some((l) => l.id === id);
  let selection: Set<string> | null = null;
  for (const c of changes) {
    if (c.type !== 'select') continue;
    selection ??= new Set(s.selection.filter(isFlowElement));
    if (c.selected) selection.add(c.id);
    else selection.delete(c.id);
  }
  if (selection) s.setSelection([...selection]);
}

export function Canvas() {
  const diagram = useEditor(selectDiagram);
  const selection = useEditor((s) => s.selection);
  const sizes = useEditor((s) => s.sizes);
  const selected = useMemo(() => new Set(selection), [selection]);
  // Attached criteria are placed against their level's current side.
  const view = useMemo(() => resolveAttachments(diagram, sizes), [diagram, sizes]);
  const flowNodes = useFlowNodes(view.nodes, selected, sizes);
  const flowEdges = useFlowEdges(view.links, selected);
  const routes = useMemo(() => computeRoutes(view, sizes), [view, sizes]);
  const { screenToFlowPosition, getZoom } = useReactFlow();

  // Mouse drag in progress (keyboard nudges are not snapped), and whether
  // Alt is held (disables snapping).
  const mouseDrag = useRef(false);
  const altDown = useRef(false);
  useEffect(() => {
    const track = (e: KeyboardEvent | PointerEvent) => (altDown.current = e.altKey);
    window.addEventListener('pointermove', track, true);
    window.addEventListener('keydown', track, true);
    window.addEventListener('keyup', track, true);
    return () => {
      window.removeEventListener('pointermove', track, true);
      window.removeEventListener('keydown', track, true);
      window.removeEventListener('keyup', track, true);
    };
  }, []);

  const onNodesChange = useCallback((changes: NodeChange<MDNode>[]) => {
    const s = useEditor.getState();
    let positions: Record<string, Point> = {};
    const measured: Record<string, Size> = {};
    for (const c of changes) {
      if (c.type === 'position' && c.position) {
        positions[c.id] = { x: Math.round(c.position.x), y: Math.round(c.position.y) };
      } else if (c.type === 'dimensions' && c.dimensions) {
        if (c.resizing !== undefined) {
          // Levels and facts only resize horizontally; criteria along their long axis.
          const isCriterion = s.history.present.nodes.some((n) => n.id === c.id && n.kind === 'criterion');
          const width = Math.round(c.dimensions.width);
          const height = Math.round(c.dimensions.height);
          s.transient({ type: 'updateNode', id: c.id, patch: isCriterion ? { width, height } : { width } });
        } else {
          measured[c.id] = c.dimensions;
        }
      }
    }
    if (Object.keys(positions).length) {
      // Criteria about to attach to a level side are placed by that instead.
      if (mouseDrag.current && !altDown.current && !s.snap) {
        const snapped = snapPositions(positions, GUIDE_SNAP_PX / getZoom());
        positions = snapped.positions;
        s.setGuides(snapped.guides);
      } else {
        s.setGuides([]);
      }
      s.transient({ type: 'moveNodes', positions });
    }
    if (Object.keys(measured).length) s.setSizes(measured);
    applySelectChanges(changes);
  }, [getZoom]);

  const onEdgesChange = useCallback((changes: EdgeChange<MDEdge>[]) => applySelectChanges(changes), []);

  // Dragging an attached criterion detaches it; dropping any criterion next
  // to a level side (Alt disables this) snaps it there.
  const onNodeDragStart: OnNodeDrag<MDNode> = useCallback((_, __, dragged) => {
    const s = useEditor.getState();
    mouseDrag.current = true;
    s.beginGesture();
    const current = resolveAttachments(s.history.present, s.sizes);
    for (const { id } of dragged) {
      const n = current.nodes.find((c) => c.id === id);
      if (n?.kind !== 'criterion' || !n.attachedTo) continue;
      s.transient({
        type: 'updateNode',
        id,
        patch: { attachedTo: null, x: n.x, y: n.y, width: n.width, height: n.height, orientation: n.orientation },
      });
    }
  }, []);

  const onNodeDrag: OnNodeDrag<MDNode> = useCallback((e, _, dragged) => {
    const s = useEditor.getState();
    const targets = e.altKey ? new Map() : snapTargets(s.history.present, new Set(dragged.map((n) => n.id)));
    s.setSnap(targets.values().next().value ?? null);
  }, []);

  const onNodeDragStop: OnNodeDrag<MDNode> = useCallback((e, _, dragged) => {
    const s = useEditor.getState();
    mouseDrag.current = false;
    s.setGuides([]);
    s.setSnap(null);
    if (!e.altKey) {
      const present = s.history.present;
      for (const [id, target] of snapTargets(present, new Set(dragged.map((n) => n.id)))) {
        const c = present.nodes.find((n) => n.id === id);
        const level = present.nodes.find((n) => n.id === target.nodeId);
        if (c?.kind !== 'criterion' || !level) continue;
        const { kind: _kind, id: _id, ...patch } = attachCriterion(c, nodeBox(level, s.sizes[level.id]), target);
        s.transient({ type: 'updateNode', id, patch });
      }
    }
    s.endGesture();
  }, []);

  // A link from a node to itself is only created if the pointer left the
  // node on the way, so a short drag on a border does not make a loop.
  const leftSource = useRef(false);
  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    leftSource.current = false;
    const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const m = 12;
      if (e.clientX < r.left - m || e.clientX > r.right + m || e.clientY < r.top - m || e.clientY > r.bottom + m) {
        leftSource.current = true;
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', onMove), { once: true });
  }, []);

  const onConnect = useCallback((c: Connection) => {
    if (c.source === c.target && !leftSource.current) return;
    const { history, dispatch, setSelection } = useEditor.getState();
    const link = createLink(history.present, c.source, c.target);
    if (!link) return;
    dispatch({ type: 'addLink', link });
    setSelection([link.id]);
  }, []);

  const onEdgeDoubleClick = useCallback(
    (e: MouseEvent, edge: MDEdge) => {
      // Edit the role of the end closest to the pointer.
      const route = routes.get(edge.id);
      if (!route) return;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const dist = (q: Point) => Math.hypot(q.x - p.x, q.y - p.y);
      const end = dist(route.source.point) <= dist(route.target.point) ? 'source' : 'target';
      useEditor.getState().setEditing({ kind: 'role', linkId: edge.id, end });
    },
    [routes, screenToFlowPosition],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      const kind = e.dataTransfer.getData(PALETTE_MIME) as NodeKind;
      if (!kind) return;
      e.preventDefault();
      addNodeAt(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [screenToFlowPosition],
  );

  return (
    <div id="md-canvas" className="h-full w-full">
      <RoutesContext.Provider value={routes}>
        <ReactFlow<MDNode, MDEdge>
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onConnectStart={onConnectStart}
          onConnect={onConnect}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onPaneClick={() => {
            const s = useEditor.getState();
            s.setEditing(null);
            s.setSelection([]);
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(PALETTE_MIME)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={onDrop}
          connectionMode={ConnectionMode.Loose}
          connectionLineComponent={ConnectionLine}
          connectionRadius={24}
          zIndexMode="manual"
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panOnDrag={[1, 2]}
          panOnScroll
          multiSelectionKeyCode="Shift"
          minZoom={0.1}
          maxZoom={4}
          defaultViewport={{ x: 40, y: 40, zoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <ExclusiveArcs view={view} />
          <AlignmentGuides />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d4d4d8" />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      </RoutesContext.Provider>
    </div>
  );
}
