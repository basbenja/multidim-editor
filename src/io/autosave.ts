import { parseDiagram, serializeDiagram } from '../model/serialize';
import type { Diagram } from '../model/types';
import { documentForSave, useEditor } from '../store/editor';

const KEY = 'multidim-editor:diagram';
const NAME_KEY = 'multidim-editor:fileName';

export function loadAutosave(): { diagram: Diagram; docName: string | null } | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    return { diagram: parseDiagram(text), docName: localStorage.getItem(NAME_KEY) };
  } catch {
    return null;
  }
}

/** Persists the current diagram to localStorage shortly after every change. */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    const { docName } = useEditor.getState();
    try {
      localStorage.setItem(KEY, serializeDiagram(documentForSave()));
      localStorage.setItem(NAME_KEY, docName);
    } catch {
      // Storage full or unavailable: autosave is best-effort.
    }
  };
  const unsubscribe = useEditor.subscribe((s, prev) => {
    if (s.history.present === prev.history.present && s.docName === prev.docName) return;
    clearTimeout(timer);
    timer = setTimeout(save, 400);
  });
  const flush = () => {
    clearTimeout(timer);
    save();
  };
  window.addEventListener('beforeunload', flush);
  return () => {
    unsubscribe();
    window.removeEventListener('beforeunload', flush);
    clearTimeout(timer);
  };
}
