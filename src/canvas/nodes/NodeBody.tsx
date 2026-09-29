import { KeyRound, Plus, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { lineCount } from '../../model/reducer';
import type { FactNode, LevelNode } from '../../model/types';
import { useEditor } from '../../store/editor';
import { renamePatch, widthFor } from './editing';
import { InlineInput } from './InlineInput';

type BoxNode = LevelNode | FactNode;

interface Line {
  text: string;
  key: boolean;
}

function linesOf(node: BoxNode): Line[] {
  return node.kind === 'level' ? node.attributes : node.measures.map((text) => ({ text, key: false }));
}

/** Centered name header of a level or fact. */
export function NameHeader({ node }: { node: BoxNode }) {
  const editing = useEditor((s) => s.editing?.kind === 'name' && s.editing.nodeId === node.id);
  const setEditing = useEditor((s) => s.setEditing);
  return (
    <div className="md-header" onDoubleClick={() => setEditing({ nodeId: node.id, kind: 'name' })}>
      {editing ? <NameEditor node={node} /> : node.name || ' '}
    </div>
  );
}

function NameEditor({ node }: { node: BoxNode }) {
  const [value, setValue] = useState(node.name);
  const { dispatch, setEditing } = useEditor.getState();
  return (
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
  );
}

/** Attribute or measure list, with in-place editing of each line. */
export function LineList({ node }: { node: BoxNode }) {
  const editing = useEditor((s) => (s.editing?.kind === 'line' && s.editing.nodeId === node.id ? s.editing : null));
  const lines = linesOf(node);
  const rows = lines.map((line, i) =>
    editing && !editing.draft && editing.index === i ? (
      <LineEditor key={`e${i}`} node={node} index={i} draft={false} initial={line} />
    ) : (
      <LineView key={i} node={node} index={i} line={line} />
    ),
  );
  if (editing?.draft) {
    rows.splice(editing.index, 0, <LineEditor key={`draft${editing.index}`} node={node} index={editing.index} draft initial={{ text: '', key: false }} />);
  }
  return (
    <div className="md-body">
      {rows}
      <button
        className="md-add-line md-chrome nodrag nopan"
        title="Add line"
        onClick={(e) => {
          e.stopPropagation();
          useEditor.getState().setEditing({ nodeId: node.id, kind: 'line', index: lineCount(node), draft: true });
        }}
      >
        <Plus size={11} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function LineView({ node, index, line }: { node: BoxNode; index: number; line: Line }) {
  const { dispatch, setEditing } = useEditor.getState();
  return (
    <div className="md-line" onDoubleClick={() => setEditing({ nodeId: node.id, kind: 'line', index, draft: false })}>
      <span className={line.key ? 'md-key' : undefined}>{line.text || ' '}</span>
      <span className="md-line-tools md-chrome nodrag nopan">
        {node.kind === 'level' && (
          <button
            title={line.key ? 'Unmark key (Ctrl+K while editing)' : 'Mark as key (Ctrl+K while editing)'}
            className={line.key ? 'is-on' : undefined}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'toggleKey', nodeId: node.id, index });
            }}
          >
            <KeyRound size={12} />
          </button>
        )}
        <button
          title="Delete line"
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: 'removeLine', nodeId: node.id, index });
          }}
        >
          <X size={12} />
        </button>
      </span>
    </div>
  );
}

interface EditorProps {
  node: BoxNode;
  index: number;
  draft: boolean;
  initial: Line;
}

/**
 * Enter commits and opens a new line below; Backspace on an empty line
 * deletes it; Escape cancels; Ctrl/Cmd+K toggles the key flag (levels);
 * arrow keys move to the neighbouring line.
 */
function LineEditor({ node, index, draft, initial }: EditorProps) {
  const [text, setText] = useState(initial.text);
  const [key, setKey] = useState(initial.key);
  const { dispatch, setEditing } = useEditor.getState();

  /** Writes the edit to the document. Returns whether a line now exists at `index`. */
  const save = (): boolean => {
    const value = text.trim();
    const width = widthFor(node, value);
    if (draft) {
      if (value === '') return false;
      dispatch({ type: 'insertLine', nodeId: node.id, index, text: value, key, width });
      return true;
    }
    if (value !== initial.text || key !== initial.key) {
      dispatch({ type: 'commitLine', nodeId: node.id, index, text: value, key, width });
    }
    return value !== '';
  };

  const editLine = (i: number) => setEditing({ nodeId: node.id, kind: 'line', index: i, draft: false });

  const onKey = (e: KeyboardEvent<HTMLInputElement>, end: (fn: () => void) => void): boolean => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      if (node.kind === 'level') setKey((k) => !k);
      return true;
    }
    if (e.key === 'Backspace' && text === '') {
      end(() => {
        if (!draft) dispatch({ type: 'removeLine', nodeId: node.id, index });
        if (index > 0) editLine(index - 1);
        else setEditing(null);
      });
      return true;
    }
    if (e.key === 'ArrowUp' && index > 0) {
      end(() => {
        save();
        editLine(index - 1);
      });
      return true;
    }
    if (e.key === 'ArrowDown') {
      end(() => {
        // A saved line sits at `index`; an empty one was dropped, so the next line moved up.
        const target = save() ? index + 1 : index;
        if (target < lineCount(currentNode(node.id))) editLine(target);
        else setEditing(null);
      });
      return true;
    }
    return false;
  };

  return (
    <div className="md-line is-editing">
      <InlineInput
        className={key ? 'md-key' : undefined}
        value={text}
        onChange={setText}
        onKey={onKey}
        onCommit={(reason) => {
          const kept = save();
          if (reason === 'enter' && kept) {
            // Open a fresh line right below the committed one.
            setEditing({ nodeId: node.id, kind: 'line', index: index + 1, draft: true });
          } else {
            setEditing(null);
          }
        }}
        onCancel={() => setEditing(null)}
      />
    </div>
  );
}

function currentNode(id: string): BoxNode {
  return useEditor.getState().history.present.nodes.find((n) => n.id === id) as BoxNode;
}
