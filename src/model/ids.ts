/** Returns an id with the given prefix that is not in `taken`. */
export function nextId(prefix: string, taken: Iterable<string>): string {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const id of taken) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}

/** Returns `base` followed by the first number that makes it unique among `names`. */
export function uniqueName(base: string, names: Iterable<string>): string {
  const set = new Set(names);
  for (let i = 1; ; i++) {
    const candidate = `${base}${i}`;
    if (!set.has(candidate)) return candidate;
  }
}
