# MultiDim Editor — Implementation Plan

Source of truth for requirements: `SPEC.md`. Reference images: `images/`.

## Observations from the reference images

- **Level**: 1px black border, name centered in header, divider line, attributes left-aligned, keys underlined. Helvetica/Arial-like sans.
- **Fact**: same box + 3D faces offset (+8, −8): grey top parallelogram and grey right parallelogram.
- **Criterion**: light-grey stadium, thin black border. Vertical ones (Geography, Categories) read bottom-to-top and sit flush against a level side. Links attach to the pill itself (e.g. Geography → City, crow's foot on the pill side).
- **Markers** (drawn at the node boundary, pointing outward):
  - (1,1) plain; (0,1) open circle touching the boundary;
  - (1,n) crow's foot, prongs on the boundary, apex ~12px out, line continues through the middle prong;
  - (0,n) crow's foot + open circle just beyond the apex.
- **Parallel links** (Sales–Time ×3): horizontal lines ~30px apart, roles above the line.
- **Supervision** in Northwind is actually a link *criterion → Employee* routed as a loop, with "Supervisor" rotated vertically. True self-links (source = target) also get an automatic orthogonal loop.
- **Exclusive arcs** are always a straight dashed line **parallel to one side of the shared node**, at some distance from it, crossing every link in the group (dot at each crossing, ⊗ in the middle). E.g. State: horizontal line below State crossing State→Region and the vertical leg of State→Country. So an arc = `(nodeId, side, distance)`, not "N px along each link".

## Stack

React + TS + Vite, `@xyflow/react`, Zustand (store), Tailwind v4 (chrome only), Vitest, `html-to-image` + `jspdf`.
Vite `base: './'` (relative) → works on GitHub Pages without hardcoding the repo name.

## State model

```
Diagram (the JSON document, versioned)          ← persisted, undoable
  nodes: LevelNode | FactNode | CriterionNode   (x, y, width; criterion also height + orientation)
  links: { id, source, target, sourceCard, targetCard,
           sourceRole, targetRole, sourceRoleOffset, targetRoleOffset,
           routing: 'orthogonal'|'straight', waypoints: {x,y}[] }   (absolute flow coords)
  distributingFactors: { id, linkId, text, t, dx, dy }
  exclusiveArcs: { id, nodeId, linkIds, side, distance }

History { past: Diagram[], present: Diagram, future: Diagram[] }   ← undo/redo
UI state (not undoable): selection, editing target, measured node sizes, hover
```

- `model/reducer.ts`: pure `(Diagram, Action) → Diagram`. Cascades live here (delete node → its links → their factors; arcs with < 2 links auto-removed).
- `model/history.ts`: normal actions push one step. Gestures (drag node, drag segment, drag label, resize) use `beginGesture()` → many `apply(..., {record:false})` → `endGesture()` = **one step**. Text edits are local input state until commit → one step.
- Selection is kept in the store and fed to React Flow as `selected` flags (controlled mode). Delete key handled by us (skip when an input is focused).

## Rendering approach

- **Nodes**: custom RF node types `level`, `fact`, `criterion`, plain HTML/CSS (+ small inline SVG for the 3D faces). Height auto (RF measures it); width via horizontal-only `NodeResizeControl`. Criterion resizes along its long axis.
- **Geometry is centralized and pure** (`geometry/`): one memoized `computeRoutes(diagram, sizes)` returns, for every link, its polyline, both endpoints + outward directions, and label anchors. Centralizing is required for parallel-link offsets and for arcs/factors that depend on link paths. Unit-testable.
  - Floating endpoints: attach to the side facing the other end (or the first/last waypoint); re-computed on every move.
  - Auto orthogonal route: if the two boxes overlap on y → one horizontal segment inside the overlap (parallel links spread across the overlap); overlap on x → vertical; else L/Z shape. With waypoints: ends snap to align with the adjacent waypoint.
  - Self-link: orthogonal loop on one side of the node.
- **One custom edge type** `link` draws: invisible wide hit path, the visible polyline, markers as **inline SVG paths** (not `<marker>` — easier hit-testing and reliable export), role labels, and — when selected — end grips and segment handles.
  - End grip: click (no movement) = cycle cardinality; drag = reconnect to whatever node is under the pointer (our own hit test, not RF's reconnect, since ends are floating).
  - Orthogonal: drag a segment = move it perpendicular (auto route is materialized into waypoints on first edit). Straight: drag midpoint = new bend, drag bend = move, double-click bend = remove.
- **Connecting**: on hover, each node shows a ~10px connect band around its border + dots at side midpoints (all RF source handles, `ConnectionMode.Loose`). While a connection is in progress, every node renders a full-size invisible target handle → drop anywhere on the node. Link kind + default cardinalities inferred on connect.
- **Exclusive arcs / distributing factors**: rendered in a `ViewportPortal` SVG layer from the same computed routes (so they're inside the viewport → included in export). Arc: dashed line parallel to `side` at `distance`, dot at each link crossing, ⊗ at middle; dragging the ⊗ picks side (by region around the node) + distance.
- **Export**: `html-to-image` on `.react-flow__viewport`, transform set to the diagram bounding box + padding, white bg, a `data-exporting` class hides selection/hover/grips. PDF = PNG placed in a page sized to the diagram (`jspdf`).

## File layout

```
src/
  model/       types.ts reducer.ts history.ts serialize.ts validate.ts ids.ts  (+ *.test.ts)
  geometry/    polyline.ts floating.ts route.ts markers.ts arcs.ts             (+ *.test.ts)
  store/       editor.ts            (zustand: history + UI state + actions)
  canvas/      Canvas.tsx
               nodes/   LevelNode FactNode CriterionNode EditableText LineList ConnectHandles
               edges/   LinkEdge Marker RoleLabel EndGrip SegmentHandles
               overlays/ ExclusiveArcs DistributingFactors
  ui/          Toolbar SidePanel ValidationPanel
  io/          file.ts (save/open json) autosave.ts export.ts
```

## Milestones (stop after each for review)

- [x] **M1** Scaffold (Vite/TS/Tailwind/RF/Zustand/Vitest), Level + Fact nodes, inline editing (name, lines, Enter/Backspace/Escape, "+" add, key toggle icon + `Ctrl+K`), width resize, JSON save/open, localStorage autosave, New diagram. Tests: reducer + JSON round-trip.
- [x] **M2** Links: connect by drag (band handles, drop anywhere), floating endpoints, markers, click-to-cycle, roles (dbl-click edit, drag offset), parallel offsets, self-loop, reconnect by dragging an end.
- [x] **M3** Criterion node (orientation toggle, long-axis resize, linkable).
- [~] **M4** Deferred by the user: automatic orthogonal routing (done in M2) is enough for now. Not built: editable waypoints / segment dragging, per-link straight toggle. `routing` and `waypoints` stay in the JSON (ignored by the renderer).
- [x] **M5** Undo/redo (gestures = 1 step), side panel, validation panel. Tests: history + validation.
- [x] **M6** Export PNG/SVG (PDF dropped by the user). `io/export.ts`: html-to-image on `.react-flow__viewport`; html-to-image deep-copies `<svg>` without inlining CSS, so drawn SVG shapes carry presentation attributes and SVG chrome is not rendered while `exporting` is set. SVG output uses foreignObject (fine in browsers, not in Inkscape/Word).
- [x] **M7** Distributing factors (rendered inside `LinkEdge`, box via EdgeLabelRenderer) and exclusive arcs (`canvas/overlays/ExclusiveArcs.tsx`, ViewportPortal SVG, z 2). Dragging ⊗ changes only the distance; the side is set in the side panel. Label layer is z 3 so links never steal clicks from labels/boxes.
- [x] **M8** GitHub Pages workflow (`.github/workflows/deploy.yml`: test, build, deploy on push to main) + README. Needs Settings → Pages → Source: GitHub Actions.
- [ ] **Final** Rebuild Northwind, fix friction.

## Decisions that override SPEC.md (requested by the user)

- New links start as **(1,1) at both ends** (SPEC had fact end / child end (1,n)).
- Validation rules (user's choice): level without key; empty name; levels/facts sharing a name (case-insensitive, one namespace); fact without links; unnamed links among several between the same fact and level (one warning per pair). The SPEC's "fact linked to a non-leaf level" rule is **not** implemented.
- A criterion dropped within 16px of a **level** side **snaps and attaches** to it (SPEC said never auto-attach): it spans the whole side, orientation follows the side, it moves/resizes with the level (`attachedTo: {nodeId, side}` on the criterion; geometry derived in `geometry/attach.ts#resolveAttachments`). Dragging it away detaches; Alt while dropping disables snapping. No link is created by attaching.

## Known limitations / candidates for the final Northwind pass

- ~~Links on the same node side overlapped~~ → fixed by `geometry/ports.ts#spreadPorts` (run at the end of `computeRoutes`): ends on one side get distinct spots ≥ 20px apart, ordered by where the links head; straight links stay pinned when possible; Z links leaving one side in the same direction get staggered middle segments.
- Smart guides (added after M8, user request): `geometry/guides.ts#snapToGuides` + `canvas/overlays/AlignmentGuides.tsx`. Dragging snaps the dragged group's left/center/right and top/middle/bottom to other boxes within 6 screen px (facts use their front face); Alt disables; keyboard nudges are not snapped.

## Status / notes for the next session

- M1 done. Run: `npm run dev` (port 5173), `npm test`.
- Controlled React Flow: RF measurements are stored in `useEditor().sizes` and fed back as `node.measured` (without it RF keeps nodes hidden).
- M2: routes computed centrally in `geometry/route.ts` (`computeRoutes`), passed to edges via `RoutesContext`. Edges have zIndex 1 (above nodes, `zIndexMode="manual"`) so end grips beat node border bands. `window.editor` = zustand store in dev.
- Undo/redo + Delete shortcuts are already wired in `App.tsx` (history layer exists); M5 adds side + validation panels.

Note: undo/redo is M5 per spec, but the history layer is built into the store from M1 so nothing needs rewiring later.
