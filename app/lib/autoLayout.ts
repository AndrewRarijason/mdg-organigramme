import dagre from '@dagrejs/dagre';
import { Node, Edge } from '@xyflow/react';

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 130;
const NODE_SEP = 60;
const RANK_SEP = 90;
const MARGIN_Y = 40;

// Distance entre le bord du diagramme (carte la plus à gauche/droite) et
// le premier "couloir" de contournement, puis écart entre couloirs
// successifs si plusieurs liaisons longues doivent coexister sans se
// chevaucher entre elles.
const BYPASS_GAP = 60;
const BYPASS_LANE_SPACING = 24;

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
 * Lit le niveau hiérarchique forcé par l'utilisateur sur un nœud, s'il en
 * a un (data.hierarchyLevel, 1-indexé : niveau 1 = sommet). Retourne la
 * profondeur 0-indexée correspondante, ou undefined si aucun niveau n'a
 * été fixé manuellement (comportement automatique inchangé).
 */
function getForcedDepth(node: Node): number | undefined {
  const level = (node.data as any)?.hierarchyLevel;
  if (typeof level !== 'number' || !Number.isFinite(level) || level < 1) return undefined;
  return Math.round(level) - 1;
}

/**
 * Calcule la profondeur hiérarchique (index de niveau) de chaque nœud via
 * un tri topologique en "plus long chemin" depuis les racines. Un nœud
 * avec plusieurs supérieurs prend la profondeur MAX de ses parents + 1.
 *
 * Si un nœud porte un niveau hiérarchique forcé (data.hierarchyLevel), sa
 * profondeur est imposée à cette valeur au lieu d'être calculée — la
 * propagation vers SES propres enfants repart ensuite normalement depuis
 * cette valeur forcée.
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

  const forcedDepths = new Map<string, number>();
  nodes.forEach((n) => {
    const forced = getForcedDepth(n);
    if (forced !== undefined) forcedDepths.set(n.id, forced);
  });

  const depths = new Map<string, number>(
    nodes.map((n) => [n.id, forcedDepths.get(n.id) ?? 0])
  );
  const remainingInDegree = new Map(inDegree);

  const queue: string[] = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0).map((n) => n.id);
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const idDepth = forcedDepths.get(id) ?? depths.get(id) ?? 0;
    depths.set(id, idDepth);

    (adjacency.get(id) || []).forEach((childId) => {
      if (!forcedDepths.has(childId)) {
        depths.set(childId, Math.max(depths.get(childId) || 0, idDepth + 1));
      }
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

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  // --- 1) Profondeur "logique" calculée EN PREMIER, pour pouvoir la
  //     communiquer à dagre via `minlen` ---
  const depths = computeDepths(nodes, edges);
  const maxDepth = nodes.length > 0 ? Math.max(...Array.from(depths.values())) : 0;

  // --- 2) X via dagre ---
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
    if (!graph.hasEdge(edge.source, edge.target)) {
      const sourceDepth = depths.get(edge.source) ?? 0;
      const targetDepth = depths.get(edge.target) ?? sourceDepth + 1;
      const minlen = Math.max(1, targetDepth - sourceDepth);
      graph.setEdge(edge.source, edge.target, { minlen });
    }
  });

  dagre.layout(graph);

  // --- 3) Regroupement par profondeur ---
  const nodesByDepth = new Map<number, Node[]>();
  nodes.forEach((n) => {
    const d = depths.get(n.id) ?? 0;
    if (!nodesByDepth.has(d)) nodesByDepth.set(d, []);
    nodesByDepth.get(d)!.push(n);
  });

  // --- 4) Y unifié par rangée ---
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

  let layoutedNodes = nodes.map((node) => {
    const graphNode = graph.node(node.id);
    const { width } = getSize(node);
    const depth = depths.get(node.id) ?? 0;

    return {
      ...node,
      position: {
        x: Math.round((graphNode?.x ?? 0) - width / 2),
        y: Math.round(rowTop.get(depth) ?? MARGIN_Y),
      },
    };
  });

  // --- 4b) Résolution Anti-chevauchement Horizontal par Niveau ---
  const nodesByDepthMap = new Map<number, Node[]>();
  layoutedNodes.forEach((node) => {
    const d = depths.get(node.id) ?? 0;
    if (!nodesByDepthMap.has(d)) nodesByDepthMap.set(d, []);
    nodesByDepthMap.get(d)!.push(node);
  });

  const adjustedXMap = new Map<string, number>();

  nodesByDepthMap.forEach((rowNodes) => {
    // Trier les cartes de la ligne de gauche à droite selon leur position X initiale
    rowNodes.sort((a, b) => a.position.x - b.position.x);

    // Repousser toute carte qui chevauche sa voisine de gauche
    for (let i = 0; i < rowNodes.length; i++) {
      const curr = rowNodes[i];
      if (i === 0) {
        adjustedXMap.set(curr.id, curr.position.x);
        continue;
      }
      const prev = rowNodes[i - 1];
      const prevX = adjustedXMap.get(prev.id)!;
      const prevWidth = getSize(prev).width;
      const minX = prevX + prevWidth + NODE_SEP;

      adjustedXMap.set(curr.id, Math.max(curr.position.x, minX));
    }
  });

  // Appliquer les coordonnées X corrigées
  layoutedNodes = layoutedNodes.map((node) => {
    const newX = adjustedXMap.get(node.id);
    return newX !== undefined ? { ...node, position: { ...node.position, x: newX } } : node;
  });
  
  // --- 5) Bornes globales du diagramme (toutes cartes confondues) : les
  //     couloirs de contournement sont placés en dehors de ces bornes,
  //     donc garantis de ne croiser AUCUNE carte, quel que soit son
  //     niveau. ---
  let globalMinX = Infinity;
  let globalMaxX = -Infinity;
  layoutedNodes.forEach((n) => {
    const { width } = getSize(n);
    globalMinX = Math.min(globalMinX, n.position.x);
    globalMaxX = Math.max(globalMaxX, n.position.x + width);
  });
  if (!Number.isFinite(globalMinX)) {
    globalMinX = 0;
    globalMaxX = 0;
  }

  // --- 6) Liaisons "longues" (qui sautent au moins un niveau intermédiaire) :
  //     on leur assigne un couloir vertical dédié, hors de la zone
  //     occupée par toutes les cartes, en alternant gauche/droite pour
  //     que plusieurs liaisons longues ne se chevauchent pas entre elles. ---
  let leftLaneCount = 0;
  let rightLaneCount = 0;

  const layoutedEdges = edges.map((edge) => {
    const sourceDepth = depths.get(edge.source) ?? 0;
    const targetDepth = depths.get(edge.target) ?? sourceDepth + 1;

    // Y de branchement juste sous la rangée du parent
    const sourceRowBottom = (rowTop.get(sourceDepth) ?? 0) + (rowHeight.get(sourceDepth) ?? DEFAULT_NODE_HEIGHT);
    const sourceBranchY = sourceRowBottom + RANK_SEP / 2;

    // Y de branchement juste au-dessus de la rangée de l'enfant
    const targetRowTop = rowTop.get(targetDepth) ?? sourceRowBottom + RANK_SEP;
    const targetBranchY = targetRowTop - RANK_SEP / 2;

    const levelSpan = targetDepth - sourceDepth;
    const isBypass = levelSpan > 1;

    if (!isBypass) {
      return {
        ...edge,
        data: { ...(edge.data || {}), branchY: sourceBranchY, bypassX: undefined },
      };
    }

    // Alterne les couloirs à gauche et à droite hors des bornes de toutes les cartes
    let bypassX: number;
    if (leftLaneCount <= rightLaneCount) {
      bypassX = globalMinX - BYPASS_GAP - leftLaneCount * BYPASS_LANE_SPACING;
      leftLaneCount += 1;
    } else {
      bypassX = globalMaxX + BYPASS_GAP + rightLaneCount * BYPASS_LANE_SPACING;
      rightLaneCount += 1;
    }

    return {
      ...edge,
      data: {
        ...(edge.data || {}),
        branchY: sourceBranchY,
        sourceBranchY,
        targetBranchY,
        bypassX,
      },
    };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
}