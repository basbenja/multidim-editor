import type { Diagram, DiagramNode } from './types';

export interface Warning {
  /** Stable key for rendering. */
  key: string;
  message: string;
  /** Elements to select when the warning is clicked. */
  elementIds: string[];
}

const KIND_LABEL: Record<DiagramNode['kind'], string> = { level: 'level', fact: 'fact', criterion: 'criterion' };

/** Non-blocking modelling warnings, in a stable order. */
export function validate(d: Diagram): Warning[] {
  const warnings: Warning[] = [];
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const label = (id: string) => {
    const n = byId.get(id);
    return n?.name.trim() ? `"${n.name.trim()}"` : `an unnamed ${n ? KIND_LABEL[n.kind] : 'node'}`;
  };

  // Nodes with an empty name.
  for (const n of d.nodes) {
    if (!n.name.trim()) {
      warnings.push({ key: `empty-name:${n.id}`, message: `A ${KIND_LABEL[n.kind]} has no name.`, elementIds: [n.id] });
    }
  }

  // Levels and facts sharing a name (case-insensitive).
  const byName = new Map<string, DiagramNode[]>();
  for (const n of d.nodes) {
    const name = n.name.trim().toLowerCase();
    if (n.kind === 'criterion' || !name) continue;
    byName.set(name, [...(byName.get(name) ?? []), n]);
  }
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    warnings.push({
      key: `duplicate:${group.map((n) => n.id).join(',')}`,
      message: `${group.length} levels/facts are named "${group[0].name.trim()}".`,
      elementIds: group.map((n) => n.id),
    });
  }

  // Levels without a key attribute.
  for (const n of d.nodes) {
    if (n.kind === 'level' && !n.attributes.some((a) => a.key && a.text.trim())) {
      warnings.push({ key: `no-key:${n.id}`, message: `Level ${label(n.id)} has no key attribute.`, elementIds: [n.id] });
    }
  }

  // Facts without links.
  const linked = new Set(d.links.flatMap((l) => [l.source, l.target]));
  for (const n of d.nodes) {
    if (n.kind === 'fact' && !linked.has(n.id)) {
      warnings.push({ key: `no-links:${n.id}`, message: `Fact ${label(n.id)} has no links.`, elementIds: [n.id] });
    }
  }

  // Several links between the same fact and level need role names to tell them apart.
  const pairs = new Map<string, string[]>();
  for (const l of d.links) {
    const kinds = [byId.get(l.source)?.kind, byId.get(l.target)?.kind];
    if (!(kinds.includes('fact') && kinds.includes('level'))) continue;
    const key = [l.source, l.target].sort().join('|');
    pairs.set(key, [...(pairs.get(key) ?? []), l.id]);
  }
  for (const ids of pairs.values()) {
    if (ids.length < 2) continue;
    const links = ids.map((id) => d.links.find((x) => x.id === id)!);
    const unnamed = links.filter((l) => !l.sourceRole?.trim() && !l.targetRole?.trim());
    if (unnamed.length === 0) continue;
    const { source, target } = links[0];
    warnings.push({
      key: `role:${unnamed.map((l) => l.id).join(',')}`,
      message:
        `${unnamed.length} of the ${links.length} links between ${label(source)} and ${label(target)} ` +
        `${unnamed.length === 1 ? 'has' : 'have'} no role name.`,
      elementIds: unnamed.map((l) => l.id),
    });
  }

  return warnings;
}
