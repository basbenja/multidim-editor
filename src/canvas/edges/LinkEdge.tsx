import { EdgeLabelRenderer, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react';
import { createContext, memo, useContext, useRef, useState, type PointerEvent } from 'react';
import { roleAnchor } from '../../geometry/labels';
import { markerShape } from '../../geometry/markers';
import { pathD, type End, type Route } from '../../geometry/route';
import { nextCardinality } from '../../model/factory';
import type { Cardinality, Link, Point } from '../../model/types';
import { useEditor, type LinkEnd } from '../../store/editor';
import { InlineInput } from '../nodes/InlineInput';
import { FactorView } from './FactorView';

export type MDEdge = Edge<{ link: Link }>;

export const RoutesContext = createContext<Map<string, Route>>(new Map());

/** Id of the diagram node under a screen point, if any. */
export function nodeAtPoint(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const node = el.closest('.react-flow__node');
    if (node) return node.getAttribute('data-id');
  }
  return null;
}

function Marker({ end, card }: { end: End; card: Cardinality }) {
  const { foot, circle } = markerShape(end, card);
  return (
    <g className="md-marker">
      {foot && <path d={foot} fill="none" stroke="#000" strokeWidth={1} />}
      {circle && <circle {...circle} fill="#fff" stroke="#000" strokeWidth={1} />}
    </g>
  );
}

/**
 * Hit zone over a link end. Click cycles the cardinality; dragging moves the
 * end to whichever node it is dropped on.
 */
function EndGrip({ link, end, at }: { link: Link; end: LinkEnd; at: End }) {
  const { screenToFlowPosition } = useReactFlow();
  const start = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const c = { x: at.point.x + at.dir.x * 9, y: at.point.y + at.dir.y * 9 };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, dragging: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const s = start.current;
    if (!s) return;
    if (!s.dragging && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 4) return;
    s.dragging = true;
    useEditor.getState().setReconnect({
      linkId: link.id,
      end,
      pointer: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      overNode: nodeAtPoint(e.clientX, e.clientY),
    });
  };
  const onPointerUp = (e: PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    e.stopPropagation();
    const { dispatch, setReconnect, setSelection } = useEditor.getState();
    if (s.dragging) {
      setReconnect(null);
      const target = nodeAtPoint(e.clientX, e.clientY);
      if (target && target !== link[end]) dispatch({ type: 'updateLink', id: link.id, patch: { [end]: target } });
    } else {
      const key = end === 'source' ? 'sourceCard' : 'targetCard';
      dispatch({ type: 'updateLink', id: link.id, patch: { [key]: nextCardinality(link[key]) } });
    }
    setSelection([link.id]);
  };

  return (
    <circle
      className="md-grip md-chrome nodrag nopan"
      cx={c.x}
      cy={c.y}
      r={9}
      fill="transparent"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
        useEditor.getState().setReconnect(null);
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <title>Click: change cardinality · Drag: attach to another node</title>
    </circle>
  );
}

/** Role name near a link end: double-click to edit, drag to move. */
function RoleLabel({ link, end, at }: { link: Link; end: LinkEnd; at: End }) {
  const role = end === 'source' ? link.sourceRole : link.targetRole;
  const offsetKey = end === 'source' ? 'sourceRoleOffset' : 'targetRoleOffset';
  const offset = link[offsetKey] ?? { x: 0, y: 0 };
  const card = end === 'source' ? link.sourceCard : link.targetCard;
  const editing = useEditor((s) => s.editing?.kind === 'role' && s.editing.linkId === link.id && s.editing.end === end);
  const { getZoom } = useReactFlow();
  const drag = useRef<{ x: number; y: number; origin: Point; moved: boolean } | null>(null);

  if (!role && !editing) return null;
  const a = roleAnchor(at, card);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || editing) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, origin: offset, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const zoom = getZoom();
    const dx = (e.clientX - d.x) / zoom;
    const dy = (e.clientY - d.y) / zoom;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    const s = useEditor.getState();
    if (!d.moved) s.beginGesture();
    d.moved = true;
    s.transient({
      type: 'updateLink',
      id: link.id,
      patch: { [offsetKey]: { x: Math.round(d.origin.x + dx), y: Math.round(d.origin.y + dy) } },
    });
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) useEditor.getState().endGesture();
    else useEditor.getState().setSelection([link.id]);
  };

  return (
    <div
      className="md-role nodrag nopan"
      style={{ transform: `translate(${a.x + offset.x}px, ${a.y + offset.y}px) translate(${a.tx}%, ${a.ty}%)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useEditor.getState().setEditing({ kind: 'role', linkId: link.id, end });
      }}
    >
      {editing ? <RoleEditor link={link} end={end} initial={role ?? ''} /> : role}
    </div>
  );
}

function RoleEditor({ link, end, initial }: { link: Link; end: LinkEnd; initial: string }) {
  const [value, setValue] = useState(initial);
  const { dispatch, setEditing } = useEditor.getState();
  return (
    <InlineInput
      className="md-role-input"
      value={value}
      selectAll
      onChange={setValue}
      onCommit={() => {
        const role = value.trim() || null;
        const key = end === 'source' ? 'sourceRole' : 'targetRole';
        if (role !== link[key]) dispatch({ type: 'updateLink', id: link.id, patch: { [key]: role } });
        setEditing(null);
      }}
      onCancel={() => setEditing(null)}
    />
  );
}

/** Preview while one end of the link is dragged to another node. */
function ReconnectPreview({ route, end, pointer }: { route: Route; end: LinkEnd; pointer: Point }) {
  const fixed = end === 'source' ? route.target.point : route.source.point;
  return <path className="md-reconnect md-chrome" d={pathD([fixed, pointer])} />;
}

export const LinkEdge = memo(function LinkEdge({ id, data, selected }: EdgeProps<MDEdge>) {
  const route = useContext(RoutesContext).get(id);
  const reconnect = useEditor((s) => (s.reconnect?.linkId === id ? s.reconnect : null));
  const exporting = useEditor((s) => s.exporting);
  const allFactors = useEditor((s) => s.history.present.distributingFactors);
  const link = data?.link;
  if (!route || !link) return null;
  const factors = allFactors.filter((f) => f.linkId === id);
  const d = pathD(route.points);
  // While exporting, only the drawing itself is rendered.
  const chrome = !exporting;
  return (
    <>
      {chrome && <path className="md-link-hit" d={d} fill="none" stroke="transparent" />}
      {chrome && selected && <path className="md-link-selection md-chrome" d={d} fill="none" />}
      <g className={reconnect ? 'md-link-reconnecting' : undefined}>
        <path className="md-link-line" d={d} fill="none" stroke="#000" strokeWidth={1} />
        <Marker end={route.source} card={link.sourceCard} />
        <Marker end={route.target} card={link.targetCard} />
      </g>
      {chrome && <EndGrip link={link} end="source" at={route.source} />}
      {chrome && <EndGrip link={link} end="target" at={route.target} />}
      {chrome && reconnect && <ReconnectPreview route={route} end={reconnect.end} pointer={reconnect.pointer} />}
      {factors.map((f) => (
        <FactorView key={f.id} factor={f} route={route} />
      ))}
      <EdgeLabelRenderer>
        <RoleLabel link={link} end="source" at={route.source} />
        <RoleLabel link={link} end="target" at={route.target} />
      </EdgeLabelRenderer>
    </>
  );
});

export const edgeTypes = { link: LinkEdge };
