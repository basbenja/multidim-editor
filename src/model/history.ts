import { reduce, type Action } from './reducer';
import type { Diagram } from './types';

const LIMIT = 200;

export interface History {
  past: Diagram[];
  present: Diagram;
  future: Diagram[];
  /** Snapshot taken when a gesture (drag, resize) started; null otherwise. */
  gestureBase: Diagram | null;
}

export function createHistory(present: Diagram): History {
  return { past: [], present, future: [], gestureBase: null };
}

/** Applies an action as one undoable step. */
export function commit(h: History, action: Action): History {
  const base = h.gestureBase ? endGesture(h) : h;
  const next = reduce(base.present, action);
  if (next === base.present) return base;
  return { past: pushCapped(base.past, base.present), present: next, future: [], gestureBase: null };
}

/** Starts a gesture: subsequent `transient` actions collapse into a single step. */
export function beginGesture(h: History): History {
  return h.gestureBase ? h : { ...h, gestureBase: h.present };
}

/** Applies an action without recording it (use inside a gesture). */
export function transient(h: History, action: Action): History {
  const next = reduce(h.present, action);
  return next === h.present ? h : { ...h, present: next };
}

/** Ends a gesture, recording one step if anything changed. */
export function endGesture(h: History): History {
  const base = h.gestureBase;
  if (!base) return h;
  if (base === h.present) return { ...h, gestureBase: null };
  return { past: pushCapped(h.past, base), present: h.present, future: [], gestureBase: null };
}

export function undo(h: History): History {
  const settled = endGesture(h);
  if (settled.past.length === 0) return settled;
  const previous = settled.past[settled.past.length - 1];
  return {
    past: settled.past.slice(0, -1),
    present: previous,
    future: [settled.present, ...settled.future],
    gestureBase: null,
  };
}

export function redo(h: History): History {
  const settled = endGesture(h);
  if (settled.future.length === 0) return settled;
  const [next, ...future] = settled.future;
  return { past: pushCapped(settled.past, settled.present), present: next, future, gestureBase: null };
}

function pushCapped(past: Diagram[], d: Diagram): Diagram[] {
  const next = [...past, d];
  return next.length > LIMIT ? next.slice(next.length - LIMIT) : next;
}
