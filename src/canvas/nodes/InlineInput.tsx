import { useEffect, useRef, type KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called once when editing ends by Enter or blur. */
  onCommit: (reason: 'enter' | 'blur') => void;
  onCancel: () => void;
  /**
   * Extra key handling; return true when the key was consumed. Call `end`
   * with the action when the key also ends editing, so blur is ignored.
   */
  onKey?: (e: KeyboardEvent<HTMLInputElement>, end: (fn: () => void) => void) => boolean;
  className?: string;
  selectAll?: boolean;
}

/**
 * Borderless text input used for in-place editing on the canvas. Enter
 * commits, Escape cancels, blur commits. Only one of those fires.
 */
export function InlineInput({ value, onChange, onCommit, onCancel, onKey, className, selectAll }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A freshly added node stays hidden until React Flow has measured it, and
    // hidden inputs cannot take focus, so retry for a few frames.
    let frame = 0;
    let tries = 0;
    const focus = () => {
      el.focus();
      if (document.activeElement !== el && tries++ < 20) {
        frame = requestAnimationFrame(focus);
        return;
      }
      if (selectAll) el.select();
      else el.setSelectionRange(el.value.length, el.value.length);
    };
    focus();
    return () => cancelAnimationFrame(frame);
  }, [selectAll]);

  const finish = (fn: () => void) => {
    if (done.current) return;
    done.current = true;
    fn();
  };

  return (
    <input
      ref={ref}
      className={`md-input nodrag nopan ${className ?? ''}`}
      value={value}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => finish(() => onCommit('blur'))}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (onKey?.(e, finish)) {
          e.preventDefault();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(() => onCommit('enter'));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(onCancel);
        }
      }}
    />
  );
}
