import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { Canvas } from './canvas/Canvas';
import { toggleOrientation } from './canvas/nodes/CriterionNode';
import { useEditor } from './store/editor';
import { Notice } from './ui/Notice';
import { SidePanel } from './ui/SidePanel';
import { Toolbar } from './ui/Toolbar';

function isTextInput(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextInput(e.target) || document.querySelector('[role="dialog"]')) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
      } else if (key === 'r' && !mod && !e.altKey) {
        // Rotate the selected criteria.
        const { nodes } = s.history.present;
        const selected = new Set(s.selection);
        for (const n of nodes) {
          if (n.kind === 'criterion' && !n.attachedTo && selected.has(n.id)) toggleOrientation(n);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        if (s.selection.length === 0) return;
        e.preventDefault();
        s.dispatch({ type: 'deleteElements', ids: s.selection });
        s.setSelection([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  useShortcuts();
  const panelOpen = useEditor((s) => s.panelOpen);
  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-zinc-50 text-zinc-900">
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          <main className="relative min-w-0 flex-1">
            <Canvas />
            <Notice />
          </main>
          {panelOpen && <SidePanel />}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
