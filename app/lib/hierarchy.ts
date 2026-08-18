import { Edge, Node } from '@xyflow/react';

/** Calcule les niveaux affichés (1-indexés), y compris les niveaux forcés. */
export function getHierarchyLevels(nodes: Node[], edges: Edge[]): Map<string, number> {
  const children = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  const levels = new Map<string, number>();
  const forced = (node: Node) => {
    const value = (node.data as any)?.hierarchyLevel;
    return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.round(value) : undefined;
  };
  nodes.forEach((node) => { children.set(node.id, []); incoming.set(node.id, 0); levels.set(node.id, forced(node) ?? 1); });
  edges.forEach((edge) => {
    if (!children.has(edge.source) || !incoming.has(edge.target)) return;
    children.get(edge.source)!.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const queue = nodes.filter((node) => (incoming.get(node.id) || 0) === 0).map((node) => node.id);
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of children.get(id) || []) {
      if (forced(byId.get(child)! ) === undefined) levels.set(child, Math.max(levels.get(child) || 1, (levels.get(id) || 1) + 1));
      const remaining = (incoming.get(child) || 0) - 1;
      incoming.set(child, remaining);
      if (remaining === 0) queue.push(child);
    }
  }
  return levels;
}

/**
 * Retourne l'ensemble des ids des descendants (directs et indirects) d'un
 * nœud, à partir de la liste des liaisons. Utilisé pour empêcher de
 * choisir comme "supérieur hiérarchique" un nœud qui est en réalité un
 * descendant du nœud édité (ce qui créerait un cycle dans l'arbre).
 */
export function getDescendantIds(nodeId: string, edges: Edge[]): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  });

  const result = new Set<string>();
  const stack = [...(childrenByParent.get(nodeId) || [])];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (result.has(current)) continue;
    result.add(current);
    stack.push(...(childrenByParent.get(current) || []));
  }

  return result;
}
