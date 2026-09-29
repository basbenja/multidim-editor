import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './index.css';
import App from './App';
import { loadAutosave, startAutosave } from './io/autosave';
import { cleanDocName } from './lib/filename';
import { createHistory } from './model/history';
import { useEditor } from './store/editor';

const saved = loadAutosave();
if (saved) {
  useEditor.setState({ history: createHistory(saved.diagram), docName: cleanDocName(saved.docName ?? '') });
}
startAutosave();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.DEV) {
  // Handy for debugging from the browser console.
  (window as unknown as { editor: typeof useEditor }).editor = useEditor;
}
