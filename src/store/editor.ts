import { create } from 'zustand';
import { resolveAttachments } from '../geometry/attach';
import type { Guide } from '../geometry/guides';
import { cleanDocName, DEFAULT_DOC_NAME } from '../lib/filename';
import * as H from '../model/history';
import type { Action } from '../model/reducer';
import { emptyDiagram, type Diagram, type Point, type Side } from '../model/types';

export type LinkEnd = 'source' | 'target';

export type Editing =
  | { kind: 'name'; nodeId: string }
  /** `draft` = a new line to be inserted at `index` (not in the document yet). */
  | { kind: 'line'; nodeId: string; index: number; draft: boolean }
  | { kind: 'role'; linkId: string; end: LinkEnd }
  | { kind: 'factor'; factorId: string };

/** An existing link end being dragged to another node. */
export interface Reconnect {
  linkId: string;
  end: LinkEnd;
  pointer: Point;
  overNode: string | null;
}

export interface Size {
  width: number;
  height: number;
}

interface EditorState {
  history: H.History;
  /** Selected element ids (nodes, links, factors, arcs). */
  selection: string[];
  editing: Editing | null;
  reconnect: Reconnect | null;
  /** Alignment guides shown while dragging. */
  guides: Guide[];
  /** Level side a dragged criterion would snap to on drop. */
  snap: { nodeId: string; side: Side } | null;
  /** Rendered node sizes as measured by React Flow. */
  sizes: Record<string, Size>;
  /** Base name for Save (.json) and Export (.png/.svg), without extension. */
  docName: string;
  notice: { text: string; tone: 'info' | 'error' } | null;
  panelOpen: boolean;
  /** True while an image export renders the canvas without editor chrome. */
  exporting: boolean;

  dispatch: (a: Action) => void;
  /** Applies without recording while a gesture is active; records otherwise. */
  transient: (a: Action) => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  load: (d: Diagram, docName?: string) => void;
  setDocName: (name: string) => void;
  setSelection: (ids: string[]) => void;
  setEditing: (e: Editing | null) => void;
  setReconnect: (r: Reconnect | null) => void;
  setSnap: (snap: { nodeId: string; side: Side } | null) => void;
  setGuides: (guides: Guide[]) => void;
  setSizes: (sizes: Record<string, Size>) => void;
  notify: (text: string, tone?: 'info' | 'error') => void;
  togglePanel: () => void;
}

const PANEL_KEY = 'multidim-editor:panelOpen';

function readPanelPref(): boolean {
  try {
    return localStorage.getItem(PANEL_KEY) !== 'false';
  } catch {
    return true;
  }
}

export const useEditor = create<EditorState>((set, get) => ({
  history: H.createHistory(emptyDiagram()),
  selection: [],
  editing: null,
  reconnect: null,
  snap: null,
  guides: [],
  sizes: {},
  docName: DEFAULT_DOC_NAME,
  notice: null,
  panelOpen: readPanelPref(),
  exporting: false,

  dispatch: (a) => set((s) => ({ history: H.commit(s.history, a) })),
  transient: (a) =>
    set((s) => ({ history: s.history.gestureBase ? H.transient(s.history, a) : H.commit(s.history, a) })),
  beginGesture: () => set((s) => ({ history: H.beginGesture(s.history) })),
  endGesture: () => set((s) => ({ history: H.endGesture(s.history) })),
  undo: () => set((s) => ({ history: H.undo(s.history), editing: null })),
  redo: () => set((s) => ({ history: H.redo(s.history), editing: null })),
  load: (d, docName) =>
    set((s) => ({
      history: H.commit(s.history, { type: 'replace', diagram: d }),
      selection: [],
      editing: null,
      docName: docName === undefined ? s.docName : cleanDocName(docName),
    })),
  setSelection: (ids) => {
    const cur = get().selection;
    if (ids.length === cur.length && ids.every((id, i) => id === cur[i])) return;
    set({ selection: ids });
  },
  setEditing: (editing) => set({ editing }),
  setDocName: (name) => set({ docName: cleanDocName(name) }),
  setReconnect: (reconnect) => set({ reconnect }),
  setGuides: (guides) => {
    if (guides.length === 0 && get().guides.length === 0) return;
    set({ guides });
  },
  setSnap: (snap) => {
    const cur = get().snap;
    if (cur?.nodeId === snap?.nodeId && cur?.side === snap?.side) return;
    set({ snap });
  },
  setSizes: (sizes) => set((s) => ({ sizes: { ...s.sizes, ...sizes } })),
  notify: (text, tone = 'info') => set({ notice: { text, tone } }),
  togglePanel: () => {
    const panelOpen = !get().panelOpen;
    try {
      localStorage.setItem(PANEL_KEY, String(panelOpen));
    } catch {
      // Preference only.
    }
    set({ panelOpen });
  },
}));

export const selectDiagram = (s: EditorState) => s.history.present;

/** The document as saved: attached criteria written at their current place. */
export function documentForSave(): Diagram {
  const { history, sizes } = useEditor.getState();
  return resolveAttachments(history.present, sizes);
}
