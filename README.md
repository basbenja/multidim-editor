# MultiDim Editor

A small web app for drawing **MultiDim conceptual schemas** for data warehouses — the ER-based
multidimensional notation from Vaisman & Zimányi, *Data Warehouse Systems: Design and
Implementation*. Diagrams are drawn in black and white, the way they look in the book.

Everything runs in the browser: no accounts, no server. Your diagram is saved automatically in
the browser, and you can save/open it as a `.json` file or export it as PNG or SVG.

## What you can draw

| Element | How it looks |
|---|---|
| **Level** | Box with the name on top and one attribute per line; key attributes are underlined. |
| **Fact** | Same box drawn as a 3D box (grey top and right faces), with measures as plain text (`UnitPrice: Avg +!`, `/NetAmount`). |
| **Analysis criterion** | Grey pill with a label, horizontal or vertical. Drop it next to a level and it attaches to that side. |
| **Link** | Line with a cardinality marker at each end: (1,1) plain, (0,1) circle, (1,n) crow's foot, (0,n) circle + crow's foot. Optional role names at both ends. Parallel links are spread apart; a link from a node to itself is drawn as a loop. |
| **Distributing factor** | Dashed line from a link to a box with text such as `percentage ÷`. |
| **Exclusive relationship** | Dashed line with ⊗ crossing two or more links that share a node. |

## How to use it

| To… | Do this |
|---|---|
| Add a level, fact or criterion | Click it in the toolbar (or drag it onto the canvas). |
| Edit a name or a line | Double-click it. **Enter** saves and starts a new line, **Backspace** on an empty line deletes it, **Esc** cancels, **Ctrl/Cmd+K** toggles the key flag. |
| Link two nodes | Hover a node, drag from its border and drop anywhere on the other node. |
| Change a cardinality | Click the link end (it cycles (1,1) → (0,1) → (1,n) → (0,n)), or use the side panel. |
| Move a link end to another node | Drag the link end onto that node. |
| Name a role | Double-click the link near that end, or use the side panel. Drag the label to move it. |
| Attach a criterion | Drag it next to a level side (it turns vertical on left/right sides). Hold **Alt** to drop without attaching; drag it away to detach. |
| Add a distributing factor | Select a link, then click the factor button in the toolbar. |
| Add an exclusive relationship | Click a link, **Shift**-click the others that share a node, then click the ⊗ button. Drag the ⊗ to move it; pick the side in the side panel. |
| Align boxes | Drag a box near another one's edge or center line: it snaps into line and a red guide appears. Hold **Alt** to place it freely. |
| Select several things | Drag on empty canvas, or **Shift**-click. |
| Delete | **Delete** / **Backspace**. |
| Undo / redo | **Ctrl/Cmd+Z**, **Ctrl/Cmd+Shift+Z** or **Ctrl+Y**. |
| Pan / zoom | Scroll to pan, **Ctrl**+scroll or pinch to zoom. |
| Name the file | Click the name in the toolbar (next to *New*). **Save** downloads `name.json`, **Export** downloads `name.png` / `name.svg`. Opening a file takes its name. |

The side panel shows the properties of the selection and a list of warnings (levels without a key,
empty or duplicate names, facts without links, several links between the same fact and level
without role names). Warnings never block anything; click one to jump to it.

## File format

Diagrams are saved as readable JSON with a `version` field:

```json
{
  "version": 1,
  "nodes": [
    { "id": "n1", "kind": "level", "x": 0, "y": 0, "width": 160, "name": "Product",
      "attributes": [{ "text": "ProductID", "key": true }, { "text": "ProductName", "key": false }] },
    { "id": "n2", "kind": "fact", "x": 300, "y": 0, "width": 170, "name": "Sales",
      "measures": ["Quantity", "UnitPrice: Avg +!", "/NetAmount"] },
    { "id": "n3", "kind": "criterion", "x": 159, "y": 0, "width": 24, "height": 90,
      "name": "Categories", "orientation": "vertical", "attachedTo": { "nodeId": "n1", "side": "right" } }
  ],
  "links": [
    { "id": "l1", "source": "n2", "target": "n1", "sourceCard": "1,n", "targetCard": "1,1",
      "sourceRole": null, "targetRole": null, "sourceRoleOffset": null, "targetRoleOffset": null,
      "routing": "orthogonal", "waypoints": [] }
  ],
  "distributingFactors": [{ "id": "d1", "linkId": "l1", "text": "percentage ÷", "t": 0.5, "dx": 0, "dy": 32 }],
  "exclusiveArcs": []
}
```

## Development

Requires Node 22+.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (Vitest)
npm run build    # production build in dist/
```

Stack: React, TypeScript, Vite, [React Flow](https://reactflow.dev) (`@xyflow/react`), Zustand,
Tailwind CSS, `html-to-image` for exports.

The code is organised as:

- `src/model` — the document types, a pure reducer, undo history, JSON parsing and validation.
- `src/geometry` — link routing, markers, criterion attachment, exclusive arcs.
- `src/canvas` — React Flow node and edge components.
- `src/ui` — toolbar and side panel.

## Deployment

Every push to `main` runs the tests, builds the app and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). In the repository settings, under **Pages**, set the source to
**GitHub Actions** once. The build uses relative paths, so it works under any repository name.
