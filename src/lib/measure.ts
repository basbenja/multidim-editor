import { FONT } from './style';

let ctx: CanvasRenderingContext2D | null = null;

/** Width in px of `text` rendered in the diagram font. */
export function textWidth(text: string, font = FONT): number {
  if (typeof document === 'undefined') return text.length * 7;
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return text.length * 7;
  ctx.font = font;
  return ctx.measureText(text).width;
}
