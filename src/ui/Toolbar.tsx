import { useReactFlow } from '@xyflow/react';
import { ChevronDown, Download, FilePlus2, FileText, FolderOpen, PanelRight, Redo2, Save, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { addArcToSelection, addFactorToSelection, factorTarget } from '../canvas/actions';
import { addNodeAt, PALETTE_MIME } from '../canvas/Canvas';
import { exclusiveArcCandidate } from '../model/factory';
import { exportImage, type ImageFormat } from '../io/export';
import { DEFAULT_DOC_NAME } from '../lib/filename';
import { downloadBlob, pickFile } from '../io/file';
import { DiagramParseError, parseDiagram, serializeDiagram } from '../model/serialize';
import { emptyDiagram, type NodeKind } from '../model/types';
import { documentForSave, useEditor } from '../store/editor';
import { ConfirmDialog } from './ConfirmDialog';

function LevelIcon() {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="1.5" y="1.5" width="15" height="13" rx="0.5" />
      <line x1="1.5" y1="5.5" x2="16.5" y2="5.5" />
    </svg>
  );
}

function FactIcon() {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M1.5 4.5 L4.5 1.5 H16.5 V11.5 L13.5 14.5" fill="currentColor" fillOpacity="0.25" />
      <rect x="1.5" y="4.5" width="12" height="10" fill="white" />
      <line x1="1.5" y1="8" x2="13.5" y2="8" />
    </svg>
  );
}

function CriterionIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="1.5" y="4.5" width="17" height="7" rx="3.5" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

function FactorIcon() {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <line x1="1" y1="3.5" x2="17" y2="3.5" />
      <line x1="9" y1="3.5" x2="9" y2="9" strokeDasharray="2 1.5" />
      <rect x="4" y="9.5" width="10" height="5" />
    </svg>
  );
}

function ArcIcon() {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <line x1="2.5" y1="1" x2="2.5" y2="15" />
      <line x1="15.5" y1="1" x2="15.5" y2="15" />
      <line x1="2.5" y1="8" x2="5" y2="8" strokeDasharray="2 1.5" />
      <line x1="13" y1="8" x2="15.5" y2="8" strokeDasharray="2 1.5" />
      <circle cx="9" cy="8" r="3.6" />
      <path d="M6.6 5.6 L11.4 10.4 M6.6 10.4 L11.4 5.6" />
    </svg>
  );
}

function ToolButton(props: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  label?: string;
  dragKind?: NodeKind;
}) {
  return (
    <button
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
      draggable={props.dragKind !== undefined}
      onDragStart={(e) => {
        if (!props.dragKind) return;
        e.dataTransfer.setData(PALETTE_MIME, props.dragKind);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200 disabled:pointer-events-none disabled:opacity-35"
    >
      {props.children}
      {props.label && <span>{props.label}</span>}
    </button>
  );
}

/** "Export" button with a small menu of image formats. */
function ExportMenu() {
  const { screenToFlowPosition } = useReactFlow();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  const run = async (format: ImageFormat) => {
    setOpen(false);
    const { docName, notify, setEditing } = useEditor.getState();
    setEditing(null);
    // Let an in-progress edit commit and the canvas settle.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const ok = await exportImage(format, docName, screenToFlowPosition);
      if (!ok) notify('Nothing to export yet.');
    } catch (err) {
      notify(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <ToolButton title="Export the diagram as an image" label="Export" onClick={() => setOpen(!open)}>
        <Download size={16} />
      </ToolButton>
      <ChevronDown size={12} className="pointer-events-none absolute top-1/2 -right-0.5 -translate-y-1/2 text-zinc-400" />
      {open && (
        <div className="absolute top-10 right-0 z-50 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
          {(
            [
              ['png', 'PNG image', 'Bitmap, 2× resolution'],
              ['svg', 'SVG image', 'Scalable, for the web'],
            ] as const
          ).map(([format, label, hint]) => (
            <button
              key={format}
              onClick={() => run(format)}
              className="flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left hover:bg-zinc-100"
            >
              <span className="text-[13px] text-zinc-800">{label}</span>
              <span className="text-[11px] text-zinc-400">{hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Name of the diagram, used for Save (name.json) and Export (name.png /
 * name.svg). Looks like plain text until hovered; Enter or blur saves,
 * Escape cancels.
 */
function DocNameField() {
  const docName = useEditor((s) => s.docName);
  const [draft, setDraft] = useState(docName);
  const [focused, setFocused] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!focused) setDraft(docName);
  }, [docName, focused]);
  useEffect(() => {
    document.title = `${docName} · MultiDim Editor`;
  }, [docName]);

  return (
    <label
      className="mr-1 flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2 text-zinc-400 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 hover:border-zinc-200"
      title="File name used by Save (.json) and Export (.png / .svg). Click to rename."
    >
      <FileText size={14} className="shrink-0" />
      <input
        aria-label="File name"
        className="min-w-0 bg-transparent text-[13px] text-zinc-700 outline-none"
        size={Math.min(28, Math.max(6, draft.length + 1))}
        value={draft}
        spellCheck={false}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          if (cancelled.current) {
            cancelled.current = false;
            setDraft(docName);
          } else {
            useEditor.getState().setDocName(draft);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function Divider() {
  return <div className="mx-1.5 h-5 w-px bg-zinc-200" />;
}

export function Toolbar() {
  const { screenToFlowPosition } = useReactFlow();
  const canUndo = useEditor((s) => s.history.past.length > 0 || s.history.gestureBase !== null);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  const panelOpen = useEditor((s) => s.panelOpen);
  const canAddFactor = useEditor((s) => factorTarget(s.history.present, s.selection) !== null);
  const canAddArc = useEditor((s) => exclusiveArcCandidate(s.history.present, s.selection) !== null);
  const [confirmNew, setConfirmNew] = useState(false);

  const addAtCenter = (kind: NodeKind) => {
    const rect = document.getElementById('md-canvas')?.getBoundingClientRect();
    if (!rect) return;
    addNodeAt(kind, screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }));
  };

  const open = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    const { load, notify } = useEditor.getState();
    try {
      load(parseDiagram(await file.text()), file.name);
      notify(`Opened ${file.name}`);
    } catch (err) {
      notify(err instanceof DiagramParseError ? `Could not open ${file.name}: ${err.message}` : String(err), 'error');
    }
  };

  const save = () => {
    const { docName } = useEditor.getState();
    downloadBlob(`${docName}.json`, new Blob([serializeDiagram(documentForSave())], { type: 'application/json' }));
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-0.5 border-b border-zinc-200 bg-white px-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mr-3 flex items-center gap-2 select-none">
        <img src="./favicon.svg" alt="" className="h-5 w-5" />
        <span className="text-sm font-semibold tracking-tight text-zinc-900">MultiDim</span>
      </div>
      <Divider />
      <ToolButton title="Add level (click, or drag onto the canvas)" label="Level" dragKind="level" onClick={() => addAtCenter('level')}>
        <LevelIcon />
      </ToolButton>
      <ToolButton title="Add fact (click, or drag onto the canvas)" label="Fact" dragKind="fact" onClick={() => addAtCenter('fact')}>
        <FactIcon />
      </ToolButton>
      <ToolButton
        title="Add analysis criterion (click, or drag onto the canvas)"
        label="Criterion"
        dragKind="criterion"
        onClick={() => addAtCenter('criterion')}
      >
        <CriterionIcon />
      </ToolButton>
      <Divider />
      <ToolButton title="Add distributing factor (select one link first)" disabled={!canAddFactor} onClick={addFactorToSelection}>
        <FactorIcon />
      </ToolButton>
      <ToolButton
        title="Add exclusive relationship (Shift-click two or more links that share a node first)"
        disabled={!canAddArc}
        onClick={addArcToSelection}
      >
        <ArcIcon />
      </ToolButton>
      <Divider />
      <ToolButton title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => useEditor.getState().undo()}>
        <Undo2 size={16} />
      </ToolButton>
      <ToolButton title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => useEditor.getState().redo()}>
        <Redo2 size={16} />
      </ToolButton>
      <div className="flex-1" />
      <DocNameField />
      <ToolButton title="New diagram" label="New" onClick={() => setConfirmNew(true)}>
        <FilePlus2 size={16} />
      </ToolButton>
      <ToolButton title="Open a .json diagram" label="Open" onClick={open}>
        <FolderOpen size={16} />
      </ToolButton>
      <ToolButton title="Save as .json" label="Save" onClick={save}>
        <Save size={16} />
      </ToolButton>
      <ExportMenu />
      <Divider />
      <ToolButton title={panelOpen ? 'Hide side panel' : 'Show side panel'} onClick={() => useEditor.getState().togglePanel()}>
        <PanelRight size={16} className={panelOpen ? 'text-zinc-900' : 'text-zinc-400'} />
      </ToolButton>
      {confirmNew && (
        <ConfirmDialog
          title="Start a new diagram?"
          message="The current diagram will be cleared. Save it first if you want to keep it. You can still undo this."
          confirmLabel="New diagram"
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => {
            setConfirmNew(false);
            useEditor.getState().load(emptyDiagram(), DEFAULT_DOC_NAME);
          }}
        />
      )}
    </header>
  );
}
