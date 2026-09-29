import { NodeResizeControl, ResizeControlVariant, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { FACT_DEPTH } from '../../lib/style';
import type { DiagramNode, FactNode, LevelNode } from '../../model/types';
import { useEditor } from '../../store/editor';
import { ConnectHandles } from './ConnectHandles';
import { CriterionNodeView } from './CriterionNode';
import { contentWidth } from './editing';
import { LineList, NameHeader } from './NodeBody';

export type MDNode = Node<{ node: DiagramNode }>;

/** Horizontal-only resize grips on the left and right borders of a selected node. */
function WidthResizer({ node, selected }: { node: DiagramNode; selected: boolean }) {
  const minWidth = contentWidth(node);
  const { beginGesture, endGesture } = useEditor.getState();
  if (!selected) return null;
  return (
    <>
      {(['left', 'right'] as const).map((position) => (
        <NodeResizeControl
          key={position}
          className="md-resize md-chrome"
          position={position}
          variant={ResizeControlVariant.Handle}
          resizeDirection="horizontal"
          minWidth={minWidth}
          onResizeStart={beginGesture}
          onResizeEnd={endGesture}
        />
      ))}
    </>
  );
}

/** Highlights the side a dragged criterion will snap to. */
function SnapHint({ nodeId }: { nodeId: string }) {
  const side = useEditor((s) => (s.snap?.nodeId === nodeId ? s.snap.side : null));
  return side ? <div className={`md-snap md-snap-${side} md-chrome`} /> : null;
}

export const LevelNodeView = memo(function LevelNodeView({ id, data, selected }: NodeProps<MDNode>) {
  const node = data.node as LevelNode;
  return (
    <div className="md-node">
      <SnapHint nodeId={id} />
      <div className="md-box">
        <NameHeader node={node} />
        <LineList node={node} />
      </div>
      <ConnectHandles nodeId={id} />
      <WidthResizer node={node} selected={selected} />
    </div>
  );
});

export const FactNodeView = memo(function FactNodeView({ id, data, selected, width, height }: NodeProps<MDNode>) {
  const node = data.node as FactNode;
  const w = width ?? node.width;
  const h = height ?? 0;
  const d = FACT_DEPTH;
  return (
    <div className="md-node md-fact" style={{ paddingTop: d, paddingRight: d }}>
      {h > 0 && (
        <svg className="md-fact-faces" width={w} height={h} fill="#c8c8c8" stroke="#000" strokeWidth={1}>
          {/* top face */}
          <polygon points={`0.5,${d + 0.5} ${d + 0.5},0.5 ${w - 0.5},0.5 ${w - d - 0.5},${d + 0.5}`} />
          {/* right face */}
          <polygon points={`${w - d - 0.5},${d + 0.5} ${w - 0.5},0.5 ${w - 0.5},${h - d - 0.5} ${w - d - 0.5},${h - 0.5}`} />
        </svg>
      )}
      <div className="md-box">
        <NameHeader node={node} />
        <LineList node={node} />
      </div>
      <ConnectHandles nodeId={id} />
      <WidthResizer node={node} selected={selected} />
    </div>
  );
});

export const nodeTypes = {
  level: LevelNodeView,
  fact: FactNodeView,
  criterion: CriterionNodeView,
};
