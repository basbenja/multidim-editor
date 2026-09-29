import { toPng, toSvg } from 'html-to-image';
import type { Point } from '../model/types';
import { useEditor } from '../store/editor';
import { downloadBlob } from './file';

export type ImageFormat = 'png' | 'svg';

const PADDING = 20;
/** Elements that make up the drawing (as opposed to editor chrome). */
const DRAWN = '.md-node, .md-link-line, .md-marker, .md-role, .md-factor-line, .md-factor-box, .md-arc-line, .md-arc-x';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Bounding box of everything drawn, in diagram coordinates. */
function drawingBounds(viewport: HTMLElement, toFlow: (p: Point) => Point): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of viewport.querySelectorAll(DRAWN)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const a = toFlow({ x: r.left, y: r.top });
    const b = toFlow({ x: r.right, y: r.bottom });
    minX = Math.min(minX, a.x);
    minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, b.x);
    maxY = Math.max(maxY, b.y);
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Renders the diagram exactly as drawn — white background, cropped to its
 * bounding box plus padding, without selection or other editor chrome —
 * and downloads it.
 */
export async function exportImage(format: ImageFormat, baseName: string, toFlow: (p: Point) => Point): Promise<boolean> {
  const root = document.querySelector<HTMLElement>('.react-flow');
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!root || !viewport) return false;
  const bounds = drawingBounds(viewport, toFlow);
  if (!bounds) return false;

  const width = Math.ceil(bounds.w + 2 * PADDING);
  const height = Math.ceil(bounds.h + 2 * PADDING);
  const options = {
    backgroundColor: '#ffffff',
    width,
    height,
    skipFonts: true,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)`,
    },
    filter: (node: Node) =>
      !(node instanceof Element) ||
      !(
        node.classList.contains('md-chrome') ||
        node.classList.contains('react-flow__handle') ||
        node.classList.contains('react-flow__resize-control')
      ),
  };

  // Editor chrome is not rendered while exporting; CSS-only chrome
  // (selection outlines, hover hints) is switched off by the attribute.
  useEditor.setState({ exporting: true });
  root.setAttribute('data-exporting', '');
  try {
    await nextFrame();
    await nextFrame();
    if (format === 'png') {
      const dataUrl = await toPng(viewport, { ...options, pixelRatio: 2 });
      downloadBlob(`${baseName}.png`, await (await fetch(dataUrl)).blob());
    } else {
      const dataUrl = await toSvg(viewport, options);
      const svg = decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1));
      // The background colour only covers the (translated) root element, so
      // paint the whole canvas white explicitly.
      const withBackground = svg.replace('<foreignObject', '<rect width="100%" height="100%" fill="#ffffff"/><foreignObject');
      downloadBlob(`${baseName}.svg`, new Blob([withBackground], { type: 'image/svg+xml' }));
    }
    return true;
  } finally {
    root.removeAttribute('data-exporting');
    useEditor.setState({ exporting: false });
  }
}
