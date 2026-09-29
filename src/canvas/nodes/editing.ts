import { textWidth } from '../../lib/measure';
import { CRITERION_PAD, FACT_DEPTH, MIN_NODE_WIDTH, PAD_X } from '../../lib/style';
import type { NodePatch } from '../../model/reducer';
import type { DiagramNode } from '../../model/types';

/** Length a criterion pill needs along its long axis to fit `name`. */
export function criterionLength(name: string): number {
  return Math.max(40, Math.ceil(textWidth(name) + 2 * CRITERION_PAD));
}

/** Horizontal space a level/fact needs so that no text is clipped. */
export function contentWidth(node: DiagramNode, extra: string[] = []): number {
  if (node.kind === 'criterion') return criterionLength(node.name);
  const lines = node.kind === 'level' ? node.attributes.map((a) => a.text) : node.measures;
  const widest = Math.max(0, ...[node.name, ...lines, ...extra].map((t) => textWidth(t)));
  const depth = node.kind === 'fact' ? FACT_DEPTH : 0;
  return Math.max(MIN_NODE_WIDTH, Math.ceil(widest + 2 * PAD_X + 6 + depth));
}

/** Width to store after committing `text`, or undefined when the node is wide enough. */
export function widthFor(node: DiagramNode, text: string): number | undefined {
  const needed = contentWidth(node, [text]);
  return needed > node.width ? needed : undefined;
}

/** Patch for renaming a node, growing it when the new name does not fit. */
export function renamePatch(node: DiagramNode, name: string): NodePatch {
  if (node.kind !== 'criterion') return { name, width: widthFor(node, name) };
  const need = criterionLength(name);
  if (node.orientation === 'vertical') return need > node.height ? { name, height: need } : { name };
  return need > node.width ? { name, width: need } : { name };
}
