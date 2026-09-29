export const DEFAULT_DOC_NAME = 'diagram';

/**
 * Base name used for saved and exported files: without extension and
 * without characters that file systems reject. Falls back to "diagram".
 */
export function cleanDocName(input: string): string {
  const name = input
    .trim()
    .replace(/\.(json|png|svg)$/i, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/^\.+/, '')
    .trim();
  return name || DEFAULT_DOC_NAME;
}
