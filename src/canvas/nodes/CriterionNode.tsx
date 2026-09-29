import { NodeResizeControl, NodeToolbar, Position, ResizeControlVariant, type NodeProps } from '@xyflow/react';
import { RotateCw } from 'lucide-react';
import { memo, useState } from 'react';
import type { CriterionNode } from '../../model/types';
import { useEditor } from '../../store/editor';
import { ConnectHandles } from './ConnectHandles';
import { criterionLength, renamePatch } from './editing';
import { InlineInput } from './InlineInput';
import type { MDNode } from './nodes';

export function toggleOrientation(node: CriterionNode) {
  useEditor.getState().dispatch({
    type: 'setOrientation',
    id: node.id,
    orientation: node.orientation === 'vertical' ? 'horizontal' : 'vertical',
  });
}

/** Resize grips at both ends of the pill's long axis. */
function LengthResizer({ node }: { node: CriterionNode }) {
  const vertical = node.orientation === 'vertical';
  const min = criterionLength(node.name);
  const { beginGesture, endGesture } = useEditor.getState();
  return (
    <>
      {(vertical ? (['top', 'bottom'] as const) : (['left', 'right'] as const)).map((position) => (
        <NodeResizeControl
          key={position}
          className="md-resize md-chrome"
          position={position}
          variant={ResizeControlVariant.Handle}
          resizeDirection={vertical ? 'vertical' : 'horizontal'}
          minWidth={vertical ? undefined : min}
          minHeight={vertical ? min : undefined}
          onResizeStart={beginGesture}
          onResizeEnd={endGesture}
        />
      ))}
    </>
  );
}

function NameEditor({ node }: { node: CriterionNode }) {
  const [value, setValue] = useState(node.name);
  const { dispatch, setEditing } = useEditor.getState();
  return (
    <div className="md-criterion-editor">
      <InlineInput
        className="text-center"
        value={value}
        selectAll
        onChange={setValue}
        onCommit={() => {
          const name = value.trim();
          if (name !== node.name) dispatch({ type: 'updateNode', id: node.id, patch: renamePatch(node, name) });
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    </div>
  );
}

/** Analysis criterion: grey stadium with a label, horizontal or vertical. */
export const CriterionNodeView = memo(function CriterionNodeView({ id, data, selected, dragging }: NodeProps<MDNode>) {
  const node = data.node as CriterionNode;
  const editing = useEditor((s) => s.editing?.kind === 'name' && s.editing.nodeId === id);
  const vertical = node.orientation === 'vertical';
  // An attached criterion takes its length and orientation from the level side.
  const attached = node.attachedTo !== null;
  return (
    <div
      className={`md-node md-criterion${vertical ? ' is-vertical' : ''}`}
      onDoubleClick={() => useEditor.getState().setEditing({ kind: 'name', nodeId: id })}
    >
      <span className="md-criterion-label">{node.name || ' '}</span>
      {editing && <NameEditor node={node} />}
      <ConnectHandles nodeId={id} />
      {selected && !attached && <LengthResizer node={node} />}
      <NodeToolbar
        isVisible={selected && !dragging && !editing && !attached}
        position={vertical ? Position.Right : Position.Top}
        offset={10}
      >
        <button
          className="md-node-toolbar-btn"
          title="Rotate (R)"
          onClick={() => toggleOrientation(node)}
        >
          <RotateCw size={13} />
          {vertical ? 'Horizontal' : 'Vertical'}
        </button>
      </NodeToolbar>
    </div>
  );
});
