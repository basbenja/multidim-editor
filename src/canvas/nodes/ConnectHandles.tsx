import { Handle, Position, useConnection } from '@xyflow/react';
import { useEditor } from '../../store/editor';

const SIDES = [
  ['top', Position.Top],
  ['right', Position.Right],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
] as const;

/**
 * Connection affordances of a node: a band along each border to start a
 * link from, and — while a link is being drawn or reconnected — an overlay
 * covering the whole node so it can be dropped anywhere on it.
 */
export function ConnectHandles({ nodeId }: { nodeId: string }) {
  const connecting = useConnection((c) => c.inProgress);
  const reconnectOver = useEditor((s) => s.reconnect !== null && s.reconnect.overNode === nodeId);
  return (
    <>
      {SIDES.map(([side, position]) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={position}
          className={`md-band md-band-${side} md-chrome`}
          isConnectableEnd={false}
        />
      ))}
      {connecting && (
        <Handle id="drop" type="target" position={Position.Top} className="md-drop md-chrome" isConnectableStart={false} />
      )}
      {reconnectOver && <div className="md-drop-highlight md-chrome" />}
    </>
  );
}
