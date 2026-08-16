import dagre from '@dagrejs/dagre';
import { Node, Edge } from '@xyflow/react';

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 130;
const NODE_SEP = 60; // espacement horizontal entre cartes de même niveau
const RANK_SEP = 90; // espacement vertical entre niveaux hiérarchiques
const MARGIN_Y = 40;

const getSize = (node: Node) => {
  const width =
    (typeof node.style?.width === 'number' ? node.style.width : undefined) ||
    node.measured?.width ||
    DEFAULT_NODE_WIDTH;
  const height =
    (typeof node.style?.height === 'number' ? node.style.height : undefined) ||
    node.measured?.height ||
    DEFAULT_NODE_HEIGHT;
  return { width, height };
};

/**
 * Calcule la profondeur hiérarchique (index de niveau) de chaque nœud via
 * un tri topologique en "plus long chemin" depuis les racines (nœuds sans
 * lien entrant). Un nœud avec plusieurs supérieurs (multi-parent) prend la
 * profondeur MAX de ses parents + 1, pour éviter qu'il ne "remonte" trop
 * haut à cause d'un lien plus court.
 */
function computeDepths(nodes: Node[], edges: Edge[]): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach((n) => {
    adjacency.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  edges.forEach((e) => {
    if (!adjacency.has(e.source) || !inDegree.has(e.target)) return;
    adjacency.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  });

  const depths = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const remainingInDegree = new Map(inDegree);

  const queue: string[] = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0).map((n) => n.id);
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const id = queue.shift()!;
    (adjacency.get(id) || []).forEach((childId) => {
      depths.set(childId, Math.max(depths.get(childId) || 0, (depths.get(id) || 0) + 1));
      const remaining = (remainingInDegree.get(childId) || 0) - 1;
      remainingInDegree.set(childId, remaining);
      if (remaining <= 0 && !visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    });
  }

  return depths;
}

/**
 * Recalcule la disposition de l'organigramme :
 * - X : délégué à dagre, qui répartit horizontalement les nœuds d'un même
 *   niveau sans chevauchement.
 * - Y : calculé nous-mêmes par "rangée de profondeur" — tous les nœuds
 *   d'un même niveau hiérarchique reçoivent EXACTEMENT le même Y (aligné
 *   sur le haut de la rangée, dont la hauteur = la carte la plus haute de
 *   ce niveau), quelle que soit leur propre taille.
 * - Chaque liaison reçoit aussi un `data.branchY` : la ligne de
 *   branchement horizontale commune à TOUTES les liaisons entre deux
 *   niveaux adjacents, pour que le tronc se divise proprement en branches
 *   (voir OrgEdge.tsx).
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  // --- 1) X via dagre (classique) ---
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
    marginx: 40,
    marginy: MARGIN_Y,
  });

  nodes.forEach((node) => {
    const { width, height } = getSize(node);
    graph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    // dagre n'accepte qu'un edge par paire source/target
    if (!graph.hasEdge(edge.source, edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(graph);

  // --- 2) Profondeur "logique" de chaque nœud (indépendante de dagre) ---
  const depths = computeDepths(nodes, edges);
  const maxDepth = nodes.length > 0 ? Math.max(...Array.from(depths.values())) : 0;

  const nodesByDepth = new Map<number, Node[]>();
  nodes.forEach((n) => {
    const d = depths.get(n.id) ?? 0;
    if (!nodesByDepth.has(d)) nodesByDepth.set(d, []);
    nodesByDepth.get(d)!.push(n);
  });

  // --- 3) Y unifié par rangée (top de rangée + hauteur max de la rangée) ---
  const rowTop = new Map<number, number>();
  const rowHeight = new Map<number, number>();
  let cumulativeY = MARGIN_Y;

  for (let d = 0; d <= maxDepth; d++) {
    const rowNodes = nodesByDepth.get(d) || [];
    const maxH = rowNodes.reduce((max, n) => Math.max(max, getSize(n).height), DEFAULT_NODE_HEIGHT);
    rowTop.set(d, cumulativeY);
    rowHeight.set(d, maxH);
    cumulativeY += maxH + RANK_SEP;
  }

  const layoutedNodes = nodes.map((node) => {
    const graphNode = graph.node(node.id);
    const { width } = getSize(node);
    const depth = depths.get(node.id) ?? 0;

    return {
      ...node,
      position: {
        // X : centre dagre converti en coin haut-gauche (arrondi pour
        // éviter les micro-décalages sub-pixel visibles à l'export)
        x: Math.round((graphNode?.x ?? 0) - width / 2),
        // Y : haut de la rangée de ce niveau de profondeur (identique
        // pour tous les nœuds du même niveau)
        y: Math.round(rowTop.get(depth) ?? MARGIN_Y),
      },
    };
  });

  // --- 4) branchY commun à toutes les liaisons entre deux niveaux adjacents ---
  const layoutedEdges = edges.map((edge) => {
    const sourceDepth = depths.get(edge.source) ?? 0;
    const targetDepth = depths.get(edge.target) ?? sourceDepth + 1;

    const sourceRowBottom = (rowTop.get(sourceDepth) ?? 0) + (rowHeight.get(sourceDepth) ?? DEFAULT_NODE_HEIGHT);
    const targetRowTop = rowTop.get(targetDepth) ?? sourceRowBottom + RANK_SEP;
    const branchY = sourceRowBottom + (targetRowTop - sourceRowBottom) / 2;

    return {
      ...edge,
      data: { ...(edge.data || {}), branchY },
    };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
}