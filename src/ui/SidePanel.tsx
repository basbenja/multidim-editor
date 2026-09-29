import { useReactFlow } from '@xyflow/react';
import { AlertTriangle, CheckCircle2, ChevronDown, Link2Off, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addArcToSelection, addFactorToSelection } from '../canvas/actions';
import { renamePatch } from '../canvas/nodes/editing';
import { resolveAttachments } from '../geometry/attach';
import { nodeBox } from '../geometry/route';
import { exclusiveArcCandidate, linkKind } from '../model/factory';
import {
  CARDINALITIES,
  type Cardinality,
  type CriterionNode,
  type Diagram,
  type DiagramNode,
  type DistributingFactor,
  type ExclusiveArc,
  type Link,
  type Side,
} from '../model/types';
import { validate, type Warning } from '../model/validate';
import { selectDiagram, useEditor, type LinkEnd } from '../store/editor';
import { Field, PanelButton, Section, Segmented, Select, TextInput } from './fields';

const KIND_TITLE: Record<DiagramNode['kind'], string> = { level: 'Level', fact: 'Fact', criterion: 'Criterion' };
const CARD_OPTIONS = CARDINALITIES.map((c) => ({ value: c, label: `(${c})` }));

function deleteSelection() {
  const { selection, dispatch, setSelection } = useEditor.getState();
  dispatch({ type: 'deleteElements', ids: selection });
  setSelection([]);
}

function NameField({ node }: { node: DiagramNode }) {
  return (
    <Field label="Name">
      <TextInput
        key={node.id}
        value={node.name}
        placeholder="Unnamed"
        onCommit={(name) => useEditor.getState().dispatch({ type: 'updateNode', id: node.id, patch: renamePatch(node, name) })}
      />
    </Field>
  );
}

function NodeProperties({ node, diagram }: { node: DiagramNode; diagram: Diagram }) {
  const linkCount = diagram.links.filter((l) => l.source === node.id || l.target === node.id).length;
  return (
    <>
      <Section title={KIND_TITLE[node.kind]}>
        <NameField node={node} />
        {node.kind === 'criterion' && <CriterionFields node={node} diagram={diagram} />}
        <p className="text-xs leading-relaxed text-zinc-500">
          {node.kind === 'level' &&
            `${node.attributes.length} attribute${node.attributes.length === 1 ? '' : 's'}, ${node.attributes.filter((a) => a.key).length} key. `}
          {node.kind === 'fact' && `${node.measures.length} measure${node.measures.length === 1 ? '' : 's'}. `}
          {linkCount} link{linkCount === 1 ? '' : 's'}.
          {node.kind !== 'criterion' && ' Double-click a line on the canvas to edit it.'}
        </p>
      </Section>
      <Section title="Actions">
        <PanelButton tone="danger" onClick={deleteSelection}>
          <Trash2 size={14} /> Delete {KIND_TITLE[node.kind].toLowerCase()}
        </PanelButton>
      </Section>
    </>
  );
}

function CriterionFields({ node, diagram }: { node: CriterionNode; diagram: Diagram }) {
  const level = node.attachedTo && diagram.nodes.find((n) => n.id === node.attachedTo!.nodeId);
  return (
    <>
      <Field label="Orientation">
        <Segmented
          value={node.orientation}
          disabled={!!node.attachedTo}
          options={[
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical', label: 'Vertical' },
          ]}
          onChange={(orientation) => useEditor.getState().dispatch({ type: 'setOrientation', id: node.id, orientation })}
        />
      </Field>
      {level && node.attachedTo && (
        <div className="rounded-md bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600">
          <p className="mb-2">
            Attached to the {node.attachedTo.side} side of <span className="font-medium text-zinc-900">{level.name || 'a level'}</span>
            . It follows the level; its orientation comes from the side.
          </p>
          <PanelButton
            onClick={() => {
              // Keep the criterion where it is drawn now.
              const { history, sizes, dispatch } = useEditor.getState();
              const placed = resolveAttachments(history.present, sizes).nodes.find((n) => n.id === node.id) as CriterionNode;
              const { x, y, width, height, orientation } = placed;
              dispatch({ type: 'updateNode', id: node.id, patch: { attachedTo: null, x, y, width, height, orientation } });
            }}
          >
            <Link2Off size={14} /> Detach
          </PanelButton>
        </div>
      )}
    </>
  );
}

function LinkEndFields({ link, end, node }: { link: Link; end: LinkEnd; node: DiagramNode | undefined }) {
  const cardKey = end === 'source' ? 'sourceCard' : 'targetCard';
  const roleKey = end === 'source' ? 'sourceRole' : 'targetRole';
  const { dispatch } = useEditor.getState();
  return (
    <div className="space-y-2.5 rounded-md border border-zinc-100 bg-zinc-50/60 p-3">
      <p className="truncate text-xs font-medium text-zinc-700">
        {node?.name || 'Unnamed'} end <span className="font-normal text-zinc-400">({node ? KIND_TITLE[node.kind].toLowerCase() : '?'})</span>
      </p>
      <Field label="Cardinality">
        <Select<Cardinality>
          value={link[cardKey]}
          options={CARD_OPTIONS}
          onChange={(c) => dispatch({ type: 'updateLink', id: link.id, patch: { [cardKey]: c } })}
        />
      </Field>
      <Field label="Role name">
        <TextInput
          key={`${link.id}-${end}`}
          value={link[roleKey] ?? ''}
          placeholder="None"
          onCommit={(role) => dispatch({ type: 'updateLink', id: link.id, patch: { [roleKey]: role || null } })}
        />
      </Field>
    </div>
  );
}

function LinkProperties({ link, diagram }: { link: Link; diagram: Diagram }) {
  const source = diagram.nodes.find((n) => n.id === link.source);
  const target = diagram.nodes.find((n) => n.id === link.target);
  const kind = link.source === link.target ? 'Recursive link' : linkKind(diagram, link) === 'fact' ? 'Fact link' : 'Hierarchy link';
  const moved = link.sourceRoleOffset !== null || link.targetRoleOffset !== null;
  return (
    <>
      <Section title={kind}>
        <LinkEndFields link={link} end="source" node={source} />
        <LinkEndFields link={link} end="target" node={target} />
        <p className="text-xs leading-relaxed text-zinc-500">
          On the canvas: click a link end to cycle its cardinality, drag it to attach it elsewhere, double-click the link to name a
          role.
        </p>
      </Section>
      <Section title="Actions">
        {moved && (
          <PanelButton
            onClick={() =>
              useEditor.getState().dispatch({
                type: 'updateLink',
                id: link.id,
                patch: { sourceRoleOffset: null, targetRoleOffset: null },
              })
            }
          >
            <RotateCcw size={14} /> Reset role positions
          </PanelButton>
        )}
        <PanelButton onClick={addFactorToSelection}>Add distributing factor</PanelButton>
        <PanelButton tone="danger" onClick={deleteSelection}>
          <Trash2 size={14} /> Delete link
        </PanelButton>
      </Section>
    </>
  );
}

function linkLabel(d: Diagram, linkId: string): string {
  const l = d.links.find((x) => x.id === linkId);
  const name = (id: string | undefined) => d.nodes.find((n) => n.id === id)?.name || 'unnamed';
  return l ? `${name(l.source)} – ${name(l.target)}` : 'missing link';
}

function FactorProperties({ factor, diagram }: { factor: DistributingFactor; diagram: Diagram }) {
  return (
    <>
      <Section title="Distributing factor">
        <Field label="Text">
          <TextInput
            key={factor.id}
            value={factor.text}
            placeholder="percentage ÷"
            onCommit={(text) => useEditor.getState().dispatch({ type: 'updateFactor', id: factor.id, patch: { text } })}
          />
        </Field>
        <p className="text-xs leading-relaxed text-zinc-500">
          On the link {linkLabel(diagram, factor.linkId)}. Drag the box to move it, drag the point where the dashed line meets
          the link to slide it along, double-click the box to edit the text.
        </p>
      </Section>
      <Section title="Actions">
        <PanelButton tone="danger" onClick={deleteSelection}>
          <Trash2 size={14} /> Delete distributing factor
        </PanelButton>
      </Section>
    </>
  );
}

const SIDE_OPTIONS: { value: Side; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'right', label: 'Right' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
];

function ArcProperties({ arc, diagram }: { arc: ExclusiveArc; diagram: Diagram }) {
  const node = diagram.nodes.find((n) => n.id === arc.nodeId);
  const { dispatch } = useEditor.getState();
  return (
    <>
      <Section title="Exclusive relationship">
        <p className="text-xs leading-relaxed text-zinc-600">
          At <span className="font-medium text-zinc-900">{node?.name || 'unnamed'}</span>, across {arc.linkIds.length} links:
        </p>
        <ul className="space-y-0.5 text-xs text-zinc-500">
          {arc.linkIds.map((id) => (
            <li key={id}>• {linkLabel(diagram, id)}</li>
          ))}
        </ul>
        <Field label="Side of the node">
          <Segmented<Side> value={arc.side} options={SIDE_OPTIONS} onChange={(side) => dispatch({ type: 'updateArc', id: arc.id, patch: { side } })} />
        </Field>
        <Field label="Distance from the node">
          <TextInput
            key={arc.id}
            value={String(arc.distance)}
            onCommit={(v) => {
              const distance = Math.round(Number(v));
              if (Number.isFinite(distance) && distance > 0) dispatch({ type: 'updateArc', id: arc.id, patch: { distance } });
            }}
          />
        </Field>
        <p className="text-xs leading-relaxed text-zinc-500">Or drag the ⊗ on the canvas. It is removed automatically when fewer than two of its links remain.</p>
      </Section>
      <Section title="Actions">
        <PanelButton tone="danger" onClick={deleteSelection}>
          <Trash2 size={14} /> Delete exclusive relationship
        </PanelButton>
      </Section>
    </>
  );
}

const HELP: [string, string][] = [
  ['Edit text', 'Double-click a name or a line. Enter adds a line below, Ctrl+K toggles the key.'],
  ['Link', 'Drag from the border of a node onto another node.'],
  ['Cardinality', 'Click a link end to cycle it; drag the end to another node to move it.'],
  ['Roles', 'Double-click a link near an end to name that role.'],
  ['Criterion', 'Drop it next to a level to attach it (hold Alt to avoid). R rotates a free one.'],
  ['Distributing factor', 'Select a link, then use the toolbar button.'],
  ['Exclusive relationship', 'Shift-click two or more links sharing a node, then use the toolbar button.'],
  ['Select', 'Drag on empty canvas to box-select; Shift-click to add.'],
  ['Navigate', 'Scroll to pan, Ctrl+scroll or pinch to zoom.'],
];

function DiagramOverview({ diagram }: { diagram: Diagram }) {
  const count = (k: DiagramNode['kind']) => diagram.nodes.filter((n) => n.kind === k).length;
  return (
    <>
      <Section title="Diagram">
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ['Facts', count('fact')],
            ['Levels', count('level')],
            ['Criteria', count('criterion')],
            ['Links', diagram.links.length],
          ].map(([label, n]) => (
            <div key={label} className="rounded-md bg-zinc-50 py-2">
              <div className="text-base font-semibold text-zinc-900 tabular-nums">{n}</div>
              <div className="text-[11px] text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="How to">
        <dl className="space-y-2 text-xs leading-relaxed">
          {HELP.map(([term, text]) => (
            <div key={term}>
              <dt className="font-medium text-zinc-800">{term}</dt>
              <dd className="text-zinc-500">{text}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}

function Properties() {
  const diagram = useEditor(selectDiagram);
  const selection = useEditor((s) => s.selection);
  if (selection.length === 0) return <DiagramOverview diagram={diagram} />;
  if (selection.length > 1) {
    const arcCandidate = exclusiveArcCandidate(diagram, selection);
    return (
      <Section title="Selection">
        <p className="text-[13px] text-zinc-600">{selection.length} elements selected.</p>
        {arcCandidate && <PanelButton onClick={addArcToSelection}>Add exclusive relationship</PanelButton>}
        <PanelButton tone="danger" onClick={deleteSelection}>
          <Trash2 size={14} /> Delete {selection.length} elements
        </PanelButton>
      </Section>
    );
  }
  const node = diagram.nodes.find((n) => n.id === selection[0]);
  if (node) return <NodeProperties node={node} diagram={diagram} />;
  const link = diagram.links.find((l) => l.id === selection[0]);
  if (link) return <LinkProperties link={link} diagram={diagram} />;
  const factor = diagram.distributingFactors.find((f) => f.id === selection[0]);
  if (factor) return <FactorProperties factor={factor} diagram={diagram} />;
  const arc = diagram.exclusiveArcs.find((x) => x.id === selection[0]);
  if (arc) return <ArcProperties arc={arc} diagram={diagram} />;
  return null;
}

function Warnings() {
  const diagram = useEditor(selectDiagram);
  const warnings = useMemo(() => validate(diagram), [diagram]);
  const [open, setOpen] = useState(true);
  const { setCenter, getZoom } = useReactFlow();

  const reveal = (w: Warning) => {
    const { history, sizes, setSelection } = useEditor.getState();
    setSelection(w.elementIds);
    // Center the view on the first element (a link: between its two nodes).
    const view = resolveAttachments(history.present, sizes);
    const link = view.links.find((l) => l.id === w.elementIds[0]);
    const ids = link ? [link.source, link.target] : [w.elementIds[0]];
    const boxes = ids.flatMap((id) => {
      const n = view.nodes.find((x) => x.id === id);
      return n ? [nodeBox(n, sizes[id])] : [];
    });
    if (boxes.length === 0) return;
    const cx = boxes.reduce((s, b) => s + b.x + b.w / 2, 0) / boxes.length;
    const cy = boxes.reduce((s, b) => s + b.y + b.h / 2, 0) / boxes.length;
    setCenter(cx, cy, { zoom: getZoom(), duration: 300 });
  };

  return (
    <div className="flex max-h-[45%] min-h-0 shrink-0 flex-col border-t border-zinc-200">
      <button className="flex h-10 shrink-0 items-center gap-2 px-4 text-left hover:bg-zinc-50" onClick={() => setOpen(!open)}>
        <span className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">Warnings</span>
        <span
          className={`rounded-full px-1.5 text-[11px] font-medium tabular-nums ${
            warnings.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {warnings.length}
        </span>
        <ChevronDown size={14} className={`ml-auto text-zinc-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="min-h-0 overflow-y-auto px-2 pb-2">
          {warnings.length === 0 ? (
            <p className="flex items-center gap-2 px-2 pb-2 text-xs text-zinc-500">
              <CheckCircle2 size={14} className="text-emerald-600" /> No problems found.
            </p>
          ) : (
            warnings.map((w) => (
              <button
                key={w.key}
                onClick={() => reveal(w)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs leading-snug text-zinc-700 hover:bg-amber-50"
              >
                <AlertTriangle size={13} className="mt-px shrink-0 text-amber-500" />
                {w.message}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function SidePanel() {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Properties />
      </div>
      <Warnings />
    </aside>
  );
}
