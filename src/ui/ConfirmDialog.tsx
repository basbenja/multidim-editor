import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-[1px]" onMouseDown={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-[360px] rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="h-8 rounded-md px-3 text-[13px] text-zinc-700 hover:bg-zinc-100" onClick={onCancel}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            className="h-8 rounded-md bg-zinc-900 px-3 text-[13px] font-medium text-white hover:bg-zinc-700"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
