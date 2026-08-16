import { Edge } from '@xyflow/react';

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