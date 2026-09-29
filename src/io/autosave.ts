import { parseDiagram, serializeDiagram } from '../model/serialize';
import type { Diagram } from '../model/types';
import { documentForSave, useEditor } from '../store/editor';

const KEY = 'multidim-editor:diagram';
const FILE_KEY = 'multidim-editor:fileName';

export function loadAutosave(): { diagram: Diagram; fileName: string | null } | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    return { diagram: parseDiagram(text), fileName: localStorage.getItem(FILE_KEY) };
  } catch {
    return null;
  }
}

/** Persists the current diagram to localStorage shortly after every change. */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    const { fileName } = useEditor.getState();
    try {
      localStorage.setItem(KEY, serializeDiagram(documentForSave()));
      localStorage.setItem(FILE_KEY, fileName);
    } catch {
      // Storage full or unavailable: autosave is best-effort.
    }
  };
  const unsubscribe = useEditor.subscribe((s, prev) => {
    if (s.history.present === prev.history.present && s.fileName === prev.fileName) return;
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
