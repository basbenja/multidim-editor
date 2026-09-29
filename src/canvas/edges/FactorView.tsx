import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import { useRef, useState, type PointerEvent } from 'react';
import { pointAt, project } from '../../geometry/polyline';
import type { Route } from '../../geometry/route';
import type { DistributingFactor, Point } from '../../model/types';
import { useEditor } from '../../store/editor';
import { InlineInput } from '../nodes/InlineInput';

/**
 * Pointer drag that becomes one undo step. `onMove` receives the pointer
 * position in diagram coordinates; a press without movement is a click.
 */
function useDrag(onMove: (p: Point, start: Point) => void, onClick?: () => void) {
  const { screenToFlowPosition } = useReactFlow();
  const state = useRef<{ start: Point; screen: Point; moved: boolean } | null>(null);
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      state.current = {
        start: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
        screen: { x: e.clientX, y: e.clientY },
        moved: false,
      };
    },
    onPointerMove: (e: PointerEvent) => {
      const s = state.current;
      if (!s) return;
      if (!s.moved && Math.hypot(e.clientX - s.screen.x, e.clientY - s.screen.y) < 3) return;
      if (!s.moved) useEditor.getState().beginGesture();
      s.moved = true;
      onMove(screenToFlowPosition({ x: e.clientX, y: e.clientY }), s.start);
    },
    onPointerUp: () => {
      const s = state.current;
      state.current = null;
      if (s?.moved) useEditor.getState().endGesture();
      else if (s) onClick?.();
    },
  };
}

function FactorText({ factor }: { factor: DistributingFactor }) {
  const [value, setValue] = useState(factor.text);
  const { dispatch, setEditing } = useEditor.getState();
  return (
    <InlineInput
      className="md-factor-input"
      value={value}
      selectAll
      onChange={setValue}
      onCommit={() => {
        if (value.trim() !== factor.text) dispatch({ type: 'updateFactor', id: factor.id, patch: { text: value.trim() } });
        setEditing(null);
      }}
      onCancel={() => setEditing(null)}
    />
  );
}

/**
 * Distributing factor: a dashed line from a point on the link to a box with
 * text. The box and the attachment point can both be dragged.
 */
export function FactorView({ factor, route }: { factor: DistributingFactor; route: Route }) {
  const selected = useEditor((s) => s.selection.length === 1 && s.selection[0] === factor.id);
  const editing = useEditor((s) => s.editing?.kind === 'factor' && s.editing.factorId === factor.id);
  const exporting = useEditor((s) => s.exporting);
  const select = () => useEditor.getState().setSelection([factor.id]);

  const at = pointAt(route.points, factor.t).point;
  const box = { x: at.x + factor.dx, y: at.y + factor.dy };

  const origin = useRef(factor);
  const boxDrag = useDrag((p, start) => {
    const o = origin.current;
    useEditor.getState().transient({
      type: 'updateFactor',
      id: factor.id,
      patch: { dx: Math.round(o.dx + p.x - start.x), dy: Math.round(o.dy + p.y - start.y) },
    });
  }, select);
  // Sliding the attachment point along the link keeps the box where it was
  // when the drag started.
  const pointDrag = useDrag((p) => {
    const o = origin.current;
    const start = pointAt(route.points, o.t).point;
    const t = project(route.points, p);
    const moved = pointAt(route.points, t).point;
    useEditor.getState().transient({
      type: 'updateFactor',
      id: factor.id,
      patch: { t, dx: Math.round(start.x + o.dx - moved.x), dy: Math.round(start.y + o.dy - moved.y) },
    });
  }, select);

  const startDrag = (drag: ReturnType<typeof useDrag>) => (e: PointerEvent) => {
    origin.current = factor;
    drag.onPointerDown(e);
  };

  return (
    <>
      <path
        className="md-factor-line"
        d={`M${at.x} ${at.y} L${box.x} ${box.y}`}
        fill="none"
        stroke="#000"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {!exporting && (
        <circle
          className={`md-factor-point md-chrome nodrag nopan${selected ? ' is-selected' : ''}`}
          cx={at.x}
          cy={at.y}
          r={5}
          fill="transparent"
          {...pointDrag}
          onPointerDown={startDrag(pointDrag)}
          onClick={(e) => e.stopPropagation()}
        >
          <title>Drag along the link to move the attachment point</title>
        </circle>
      )}
      <EdgeLabelRenderer>
        <div
          className={`md-factor-box nodrag nopan${selected ? ' is-selected' : ''}`}
          style={{ transform: `translate(${box.x}px, ${box.y}px) translate(-50%, -50%)` }}
          {...boxDrag}
          onPointerDown={editing ? undefined : startDrag(boxDrag)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            useEditor.getState().setEditing({ kind: 'factor', factorId: factor.id });
          }}
        >
          {editing ? <FactorText factor={factor} /> : factor.text || ' '}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
