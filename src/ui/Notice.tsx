import { useEffect } from 'react';
import { useEditor } from '../store/editor';

/** Transient message at the bottom of the canvas. */
export function Notice() {
  const notice = useEditor((s) => s.notice);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useEditor.setState({ notice: null }), notice.tone === 'error' ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [notice]);
  if (!notice) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center">
      <div
        className={`pointer-events-auto max-w-lg rounded-lg border px-3.5 py-2 text-[13px] shadow-lg ${
          notice.tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-zinc-200 bg-white text-zinc-700'
        }`}
      >
        {notice.text}
      </div>
    </div>
  );
}
