# Build a MultiDim diagram editor

I want a web app for drawing **MultiDim conceptual schemas** for data warehouses. MultiDim is the ER-based multidimensional notation from Vaisman & Zimányi, *Data Warehouse Systems: Design and Implementation*. It models facts, measures, dimensions, levels and hierarchies. No existing online tool draws this notation well, so this app fills that gap.

I'm attaching four reference images: a simple hierarchy example, a fact with different dimension types, the notation summary, and the full Northwind schema. **The app is done when I can reproduce the Northwind diagram faithfully and comfortably.**

Users: me and my classmates. No accounts, no backend, no onboarding.

---

## Stack and deployment

- React + TypeScript + Vite + React Flow (`@xyflow/react`).
- Fully client-side. No server.
- Deployed to **GitHub Pages** through a GitHub Actions workflow on push to `main` (set Vite's `base` correctly).
- Modern, clean **light** UI for the editor. Tailwind is fine. **No dark mode.**
- Unit tests (Vitest) for the model logic: reducers, validation, JSON round-trip. No need for UI tests.

---

## Notation to support (all of it in v1)

Diagram elements are drawn in black and white exactly as in the reference images. Only the editor chrome (toolbar, panels) is "modern".

### Nodes

1. **Level**: rectangle split into a header (level name, centered) and a body listing attributes, one per line.
   - Attributes are **plain strings**.
   - Each attribute has one boolean flag, `key`. Key attributes render **underlined**.
   - Toggle the key flag with a small icon on hover or with a keyboard shortcut while editing the line.
2. **Fact**: same box layout (fact name in header, measures in body), but drawn as a **3D box**: grey parallelogram faces on the top and right side, as in the images.
   - Measures are **plain strings** rendered exactly as typed, e.g. `UnitPrice: Avg +!`, `/NetAmount`. No structured measure types or aggregation-function fields.
3. **Criterion** (analysis criterion): light-grey rounded pill (stadium shape) with a thin black border and a text label (e.g. `Geography`, `Calendar`).
   - It is a **free, independent node**. Do **not** auto-attach it to any level. I place it myself, typically against a level's side.
   - Orientation is toggleable: horizontal or vertical (text rotated 90°, as in the Northwind diagram). The pill is resizable along its long axis.
   - Links can connect to a criterion just like to a level.

Nodes auto-size their height to content. Width is resizable, with a sensible minimum.

### Inline editing

- Double-click a node name to edit it.
- Double-click an attribute or measure line to edit it. Enter commits and creates a new line below. Backspace on an empty line deletes it. Escape cancels.
- A small "+" appears on hover at the bottom of the body to add a line.

### Links

A link connects two nodes. It is drawn as a black line with a **cardinality marker at each end**:

| Cardinality | End marker |
|---|---|
| (1,1) | plain line |
| (0,1) | small open circle |
| (1,n) | crow's foot |
| (0,n) | open circle followed by crow's foot |

The circle sits just before the crow's foot, as in the notation summary image.

- **Link kind is inferred from the endpoints.** If either end is a fact, it's a fact link. Otherwise it's a hierarchy link. It's recursive if source and target are the same node.
- **Defaults when drawing a link:**
  - Hierarchy link (drag from child to parent): child end (1,n), parent end (1,1). This matches the images, where the crow's foot is on the child side.
  - Fact link: fact end (1,n), level end (1,1).
- **Changing cardinality:** clicking a link end cycles through (1,1) → (0,1) → (1,n) → (0,n). The side panel also has dropdowns for both ends.
- **Role names:** each link has optional `sourceRole` and `targetRole` text labels, drawn near their respective ends. They are editable by double-click or in the side panel, and draggable to adjust position.
  - Examples: `OrderDate` / `DueDate` / `ShippedDate` on three Sales–Time links.
  - Example: `Supervisor` / `Subordinate` on the recursive Employee link.
- **Parallel links** between the same two nodes must not overlap. Offset them automatically, like the three Sales–Time links.
- **Recursive links** render as an orthogonal loop on one side of the node, with the two role labels near each end (see Employee / Supervision in Northwind).

### Connecting with the mouse (important)

Connecting must be effortless:

- Hovering a node shows connection affordances.
- Dragging from a node onto **anywhere on another node** creates a link. Don't require precise tiny handles.
- **Floating endpoints:** a link end attaches to whichever side of the node is closest, and it re-attaches as nodes move.
- Allow reconnecting either end of an existing link by dragging it to another node.

### Routing

- Default routing is **orthogonal** (right angles), like the Northwind diagram.
- Users can adjust routes: drag a segment to move it, and drag segment midpoints to add bends. Persist the waypoints.
- Per-link toggle between orthogonal and straight.
- Custom edges are needed. React Flow's built-in smoothstep edge doesn't support editable waypoints.

### Edge-attached elements

These attach to links, not nodes, so they need custom handling. Build them last, so they don't destabilize the rest.

1. **Distributing factor**
   - Select a link and click "Add distributing factor".
   - Draws a short **dashed** line from a point on the link to a small rectangle containing editable text (e.g. `percentage ÷`).
   - The attachment point is draggable along the link, and the box is draggable.
   - It is deleted when its link is deleted.
2. **Exclusive relationship**
   - Select two or more links that share a common node and click "Add exclusive relationship".
   - Draws a **dashed** line crossing those links near the shared node, with a small filled dot where it meets each link and a circled ⊗ in the middle. See City→State/Country and the State/Region/Country arcs in Northwind.
   - The distance from the shared node is adjustable by dragging.
   - It auto-removes if fewer than two of its links remain.

---

## Editor features

- **Palette/toolbar:** add Level, Fact, Criterion (click to add at center, or drag onto the canvas). Plus buttons for distributing factor and exclusive relationship, enabled only when the selection allows them.
- **Canvas:** pan and zoom, box-select, shift-click multi-select, move selections together.
- **Delete:** the Delete/Backspace key deletes the selection (when not editing text).
- **Undo/redo:** Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (and Ctrl+Y).
  - A whole drag counts as one step.
  - A committed text edit counts as one step.
- **Side panel:** shows properties of the current selection:
  - name
  - link cardinalities and role names
  - routing mode
  - criterion orientation
  - distributing-factor text
- **Validation panel:** non-blocking list of warnings. It never prevents any action, and clicking a warning selects the offending element. Rules:
  - level with no key attribute
  - node with an empty name
  - duplicate level names
  - fact with no links
  - level linked to a fact that is a *parent* in some direct level-to-level hierarchy link, i.e. not a leaf (skip links that go through a criterion)
  - empty role name when two links connect the same fact and level (roles are needed to distinguish them)

Out of scope: auto-layout, snap-to-grid, copy/paste, multiple diagrams/tabs, collaboration, SQL/DDL generation, any import format other than JSON.

---

## Persistence and export

- **JSON is the only file format.**
  - Save = download a `.json` file. Open = upload a `.json` file.
  - The document has a `version` field.
  - Autosave the current diagram to `localStorage` and restore it on load. Include a "New diagram" action with confirmation.
- **Export PNG, SVG and PDF** of the diagram. What is exported is **exactly what is drawn**, with no separate export styling:
  - White background.
  - Cropped to the diagram's bounding box plus padding.
  - No selection outlines, hover affordances or other UI chrome.
  - Keep this simple, e.g. `html-to-image` for PNG/SVG and `jspdf` for PDF.

### Suggested JSON shape (adapt if needed, but keep it readable)

```json
{
  "version": 1,
  "nodes": [
    { "id": "n1", "kind": "level", "x": 0, "y": 0, "width": 180, "name": "Product",
      "attributes": [ { "text": "ProductID", "key": true }, { "text": "ProductName", "key": false } ] },
    { "id": "n2", "kind": "fact", "x": 300, "y": 0, "width": 180, "name": "Sales",
      "measures": [ "Quantity", "UnitPrice: Avg +!", "/NetAmount" ] },
    { "id": "n3", "kind": "criterion", "x": 180, "y": 0, "width": 30, "height": 140,
      "name": "Categories", "orientation": "vertical" }
  ],
  "links": [
    { "id": "l1", "source": "n2", "target": "n1",
      "sourceCard": "1,n", "targetCard": "1,1",
      "sourceRole": null, "targetRole": null,
      "routing": "orthogonal", "waypoints": [] }
  ],
  "distributingFactors": [ { "id": "d1", "linkId": "l1", "text": "percentage ÷", "t": 0.5, "dx": 0, "dy": 40 } ],
  "exclusiveArcs": [ { "id": "x1", "nodeId": "n1", "linkIds": ["l1", "l2"], "distance": 30 } ]
}
```

---

## How to work

1. Start by reading the reference images carefully and writing a short plan: component structure, state model, custom edge approach and milestones. Show it to me before coding.
2. Implement in milestones, running the app and checking each one before moving on:
   1. Scaffold, Level/Fact nodes, inline editing, JSON save/load, autosave.
   2. Links: floating endpoints, cardinality markers, click-to-cycle, roles, parallel and recursive links.
   3. Criterion node.
   4. Orthogonal routing with editable waypoints, straight toggle.
   5. Undo/redo, side panel, validation panel.
   6. Export (PNG/SVG/PDF).
   7. Distributing factors and exclusive relationships.
   8. GitHub Pages workflow and README.
3. Final check: rebuild the Northwind schema from the reference image in the app, and fix whatever makes that awkward or visually off.
