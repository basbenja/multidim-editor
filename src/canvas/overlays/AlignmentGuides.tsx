import { ViewportPortal } from '@xyflow/react';
import { useEditor } from '../../store/editor';

/** How far guides reach past the boxes they align. */
const OVERHANG = 8;

/** Alignment guides shown while dragging boxes. */
export function AlignmentGuides() {
  const guides = useEditor((s) => s.guides);
  if (guides.length === 0) return null;
  return (
    <ViewportPortal>
      <svg className="md-guides md-chrome">
        {guides.map((g, i) =>
          g.axis === 'x' ? (
            <line key={i} x1={g.at} x2={g.at} y1={g.from - OVERHANG} y2={g.to + OVERHANG} />
          ) : (
            <line key={i} x1={g.from - OVERHANG} x2={g.to + OVERHANG} y1={g.at} y2={g.at} />
          ),
        )}
      </svg>
    </ViewportPortal>
  );
}
