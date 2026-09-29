import { resolveAttachments } from '../geometry/attach';
import { defaultArcPlacement } from '../geometry/arcs';
import { pointAt } from '../geometry/polyline';
import { computeRoutes } from '../geometry/route';
import { createArc, createFactor, exclusiveArcCandidate } from '../model/factory';
import type { Diagram } from '../model/types';
import { useEditor } from '../store/editor';

/** The link a distributing factor can be added to: exactly one selected link. */
export function factorTarget(d: Diagram, selection: string[]): string | null {
  return selection.length === 1 && d.links.some((l) => l.id === selection[0]) ? selection[0] : null;
}

function currentRoutes() {
  const { history, sizes } = useEditor.getState();
  const view = resolveAttachments(history.present, sizes);
  return { view, routes: computeRoutes(view, sizes) };
}

/** Adds a distributing factor halfway along the selected link and selects it. */
export function addFactorToSelection() {
  const { history, selection, dispatch, setSelection } = useEditor.getState();
  const linkId = factorTarget(history.present, selection);
  if (!linkId) return;
  const route = currentRoutes().routes.get(linkId);
  // Put the box beside the link: below a horizontal segment, right of a vertical one.
  const dir = route ? pointAt(route.points, 0.5).dir : { x: 1, y: 0 };
  const offset = Math.abs(dir.x) >= Math.abs(dir.y) ? { x: 0, y: 32 } : { x: 70, y: 0 };
  const factor = createFactor(history.present, linkId, offset);
  dispatch({ type: 'addFactor', factor });
  setSelection([factor.id]);
}

/** Adds an exclusive relationship over the selected links (which must share a node) and selects it. */
export function addArcToSelection() {
  const { history, selection, dispatch, setSelection } = useEditor.getState();
  const candidate = exclusiveArcCandidate(history.present, selection);
  if (!candidate) return;
  const { view, routes } = currentRoutes();
  const links = view.links.filter((l) => candidate.linkIds.includes(l.id));
  const { side, distance } = defaultArcPlacement(candidate.nodeId, links, routes);
  const arc = createArc(history.present, candidate.nodeId, candidate.linkIds, side, distance);
  dispatch({ type: 'addArc', arc });
  setSelection([arc.id]);
}
