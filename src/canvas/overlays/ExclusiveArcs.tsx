import { useReactFlow, ViewportPortal } from '@xyflow/react';
import { useContext, useRef, type PointerEvent } from 'react';
import { arcDistanceAt, arcGeometry } from '../../geometry/arcs';
import { isHorizontalSide, nodeBox, type Box } from '../../geometry/route';
import type { Diagram, ExclusiveArc, Point } from '../../model/types';
import { useEditor } from '../../store/editor';
import { RoutesContext } from '../edges/LinkEdge';

const X_RADIUS = 7;

/** Where ⊗ goes when the arc line crosses none of its links: middle of the side. */
function fallbackCenter(arc: ExclusiveArc, box: Box): Point {
  const d = arc.distance;
  switch (arc.side) {
    case 'right':
      return { x: box.x + box.w + d, y: box.y + box.h / 2 };
    case 'left':
      return { x: box.x - d, y: box.y + box.h / 2 };
    case 'bottom':
      return { x: box.x + box.w / 2, y: box.y + box.h + d };
    case 'top':
      return { x: box.x + box.w / 2, y: box.y - d };
  }
}

function ArcView({ arc, view }: { arc: ExclusiveArc; view: Diagram }) {
  const routes = useContext(RoutesContext);
  const sizes = useEditor((s) => s.sizes);
  const selected = useEditor((s) => s.selection.length === 1 && s.selection[0] === arc.id);
  const exporting = useEditor((s) => s.exporting);
  const { screenToFlowPosition } = useReactFlow();
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const node = view.nodes.find((n) => n.id === arc.nodeId);
  if (!node) return null;
  const box = nodeBox(node, sizes[node.id]);
  const links = view.links.filter((l) => arc.linkIds.includes(l.id));
  const g = arcGeometry(arc, box, links, routes);
  const center = g?.center ?? fallbackCenter(arc, box);

  // Dragging ⊗ moves the arc towards or away from the node; the side is set in the panel.
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    useEditor.getState().setSelection([arc.id]);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 3) return;
    const s = useEditor.getState();
    if (!d.moved) s.beginGesture();
    d.moved = true;
    const distance = arcDistanceAt(box, arc.side, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    s.transient({ type: 'updateArc', id: arc.id, patch: { distance } });
  };
  const onPointerUp = () => {
    if (drag.current?.moved) useEditor.getState().endGesture();
    drag.current = null;
  };

  const r = X_RADIUS * 0.62;
  return (
    <g className="md-arc">
      {g && (
        <line
          className="md-arc-line"
          x1={g.from.x}
          y1={g.from.y}
          x2={g.to.x}
          y2={g.to.y}
          stroke="#000"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
      {g?.dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#000" />)}
      {selected && !exporting && (
        <circle className="md-chrome" cx={center.x} cy={center.y} r={X_RADIUS + 4} fill="rgb(59 130 246 / 0.25)" />
      )}
      <g className="md-arc-x">
        <circle cx={center.x} cy={center.y} r={X_RADIUS} fill="#fff" stroke="#000" strokeWidth={1} />
        <path
          d={`M${center.x - r} ${center.y - r} L${center.x + r} ${center.y + r} M${center.x - r} ${center.y + r} L${center.x + r} ${center.y - r}`}
          stroke="#000"
          strokeWidth={1}
        />
      </g>
      {!exporting && (
        <circle
          className="md-arc-grip md-chrome nodrag nopan"
          cx={center.x}
          cy={center.y}
          r={X_RADIUS + 3}
          fill="transparent"
          style={{ cursor: isHorizontalSide(arc.side) ? 'ns-resize' : 'ew-resize' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={(e) => e.stopPropagation()}
        >
          <title>Drag to move the exclusive relationship closer to or further from the node</title>
        </circle>
      )}
    </g>
  );
}

/** Exclusive relationships, drawn above links in diagram coordinates. */
export function ExclusiveArcs({ view }: { view: Diagram }) {
  if (view.exclusiveArcs.length === 0) return null;
  return (
    <ViewportPortal>
      <svg className="md-arcs">
        {view.exclusiveArcs.map((arc) => (
          <ArcView key={arc.id} arc={arc} view={view} />
        ))}
      </svg>
    </ViewportPortal>
  );
}
