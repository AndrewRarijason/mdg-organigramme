import dagre from '@dagrejs/dagre';
import { Node, Edge } from '@xyflow/react';

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 130;
const NODE_SEP = 60;
const RANK_SEP = 90;
const MARGIN_Y = 40;

const OUTER_BYPASS_GAP = 60;
const OUTER_BYPASS_LANE_SPACING = 24;

const INNER_GAP_MARGIN = 14;
const MIN_INNER_GAP_WIDTH = 28;
const MIN_LANE_SEPARATION = 18;

const EDGE_LANE_WIDTH = NODE_SEP * 3;

const BYPASS_Y_BASE_OFFSET = 16;
const BYPASS_Y_STEP = 8;

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

function getForcedDepth(node: Node): number | undefined {
  const level = (node.data as any)?.hierarchyLevel;
  if (typeof level !== 'number' || !Number.isFinite(level) || level < 1) return undefined;
  return Math.round(level) - 1;
}

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

type Interval = [number, number];

function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const result: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i][0], b[j][0]);
    const end = Math.min(a[i][1], b[j][1]);
    if (start < end) result.push([start, end]);
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return result;
}

/** Centre géométrique X d'un groupe de filles (médiane des centres). */
function getDaughtersCenterX(layoutedNodes: Node[], targetIds: string[]): number {
  const centers = targetIds
    .map((id) => layoutedNodes.find((n) => n.id === id))
    .filter((n): n is Node => !!n)
    .map((n) => n.position.x + getSize(n).width / 2)
    .sort((a, b) => a - b);

  if (centers.length === 0) return 0;

  const mid = Math.floor(centers.length / 2);
  return centers.length % 2 === 1
    ? Math.round(centers[mid])
    : Math.round((centers[mid - 1] + centers[mid]) / 2);
}

/** Fille centrale du groupe (tronc partagé dessiné une seule fois). */
function getSharedTrunkTargetId(layoutedNodes: Node[], targetIds: string[]): string {
  const sorted = [...targetIds].sort((a, b) => {
    const na = layoutedNodes.find((n) => n.id === a);
    const nb = layoutedNodes.find((n) => n.id === b);
    return (na?.position.x ?? 0) - (nb?.position.x ?? 0);
  });
  return sorted[Math.floor(sorted.length / 2)];
}

function buildSharedRouteKey(
  sourceId: string,
  targetDepth: number,
  side: 'left' | 'right' | null | undefined
): string {
  return `${sourceId}:${targetDepth}:${side ?? 'auto'}`;
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const depths = computeDepths(nodes, edges);
  const maxDepth = nodes.length > 0 ? Math.max(...Array.from(depths.values())) : 0;

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

  const nodesByDepth = new Map<number, Node[]>();
  nodes.forEach((n) => {
    const d = depths.get(n.id) ?? 0;
    if (!nodesByDepth.has(d)) nodesByDepth.set(d, []);
    nodesByDepth.get(d)!.push(n);
  });

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

  const nodesByDepthMap = new Map<number, Node[]>();
  layoutedNodes.forEach((node) => {
    const d = depths.get(node.id) ?? 0;
    if (!nodesByDepthMap.has(d)) nodesByDepthMap.set(d, []);
    nodesByDepthMap.get(d)!.push(node);
  });

  const adjustedXMap = new Map<string, number>();

  nodesByDepthMap.forEach((rowNodes) => {
    rowNodes.sort((a, b) => a.position.x - b.position.x);

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

  layoutedNodes = layoutedNodes.map((node) => {
    const newX = adjustedXMap.get(node.id);
    return newX !== undefined ? { ...node, position: { ...node.position, x: newX } } : node;
  });

  const incomingEdges = new Map<string, Edge[]>();
  edges.forEach((edge) => {
    if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, []);
    incomingEdges.get(edge.target)!.push(edge);
  });

  const centeredIds = new Set<string>();
  const sideById = new Map<string, 'left' | 'right'>();

  layoutedNodes.forEach((node) => {
    const nodeDepth = depths.get(node.id) ?? 0;
    const parents = incomingEdges.get(node.id) || [];
    const hasShortestBypass = parents.some((edge) => {
      const parentDepth = depths.get(edge.source) ?? nodeDepth - 1;
      return (
        nodeDepth - parentDepth > 1 &&
        edge.data?.isShortestDistance === true
      );
    });
    if (
      nodeDepth === 0 ||
      hasShortestBypass ||
      parents.some((edge) => nodeDepth - (depths.get(edge.source) ?? nodeDepth - 1) === 1)
    ) {
      centeredIds.add(node.id);
    }
    const side = (node.data as any)?.layoutSide;
    if (!centeredIds.has(node.id) && (side === 'left' || side === 'right')) {
      sideById.set(node.id, side);
    }
  });

  const indirectParentDepth = (node: Node) => {
    const nodeDepth = depths.get(node.id) ?? 0;
    const parentDepths = (incomingEdges.get(node.id) || [])
      .map((edge) => depths.get(edge.source) ?? 0)
      .filter((parentDepth) => nodeDepth - parentDepth > 1);
    return parentDepths.length > 0 ? Math.min(...parentDepths) : Number.MAX_SAFE_INTEGER;
  };

  const primaryBypassParent = (node: Node) => {
    const nodeDepth = depths.get(node.id) ?? 0;
    return (incomingEdges.get(node.id) || [])
      .filter((edge) => nodeDepth - (depths.get(edge.source) ?? nodeDepth - 1) > 1)
      .sort(
        (a, b) =>
          (depths.get(a.source) ?? 0) - (depths.get(b.source) ?? 0) ||
          a.source.localeCompare(b.source)
      )[0]?.source ?? '';
  };

  /**
   * Mode de la liaison qui détermine la position latérale de la fille.
   * En cas de plusieurs mères indirectes, on retient la mère prioritaire
   * (la plus haute, puis son id pour un ordre stable), comme pour
   * `primaryBypassParent`.
   */
  const bypassRoutingMode = (node: Node): 'independent' | 'shared' => {
    const nodeDepth = depths.get(node.id) ?? 0;
    const primaryEdge = (incomingEdges.get(node.id) || [])
      .filter((edge) => nodeDepth - (depths.get(edge.source) ?? nodeDepth - 1) > 1)
      .sort(
        (a, b) =>
          (depths.get(a.source) ?? 0) - (depths.get(b.source) ?? 0) ||
          a.source.localeCompare(b.source)
      )[0];

    return primaryEdge?.data?.routingMode === 'shared' ? 'shared' : 'independent';
  };

  const rebalancedX = new Map<string, number>();

  nodesByDepthMap.forEach((rowNodes) => {
    const centered = rowNodes
      .filter((node) => centeredIds.has(node.id))
      .sort((a, b) => a.position.x - b.position.x);

    const totalWidth =
      centered.reduce((sum, node) => sum + getSize(node).width, 0) +
      Math.max(0, centered.length - 1) * NODE_SEP;

    let cursor = -totalWidth / 2;
    centered.forEach((node) => {
      rebalancedX.set(node.id, Math.round(cursor));
      cursor += getSize(node).width + NODE_SEP;
    });

    const centerLeft = -totalWidth / 2;
    const centerRight = totalWidth / 2;
    let leftCursor = centerLeft - NODE_SEP;
    let rightCursor = centerRight + NODE_SEP;

    // Les éléments sont posés du centre vers l'extérieur, à gauche comme à droite.
    // On inverse donc l'ordre des index de mère : la mère la plus haute est posée
    // en dernier et occupe toujours la colonne la plus externe. À mère égale,
    // les liens partagés sont eux aussi posés en dernier, donc à l'extérieur des
    // liens indépendants. Cela laisse les accès individuels côté intérieur sans
    // modifier le tracé (tronc/branches) des liens partagés.
    const byOuterPriority = (a: Node, b: Node) =>
      indirectParentDepth(b) - indirectParentDepth(a) ||
      primaryBypassParent(a).localeCompare(primaryBypassParent(b)) ||
      (bypassRoutingMode(a) === 'shared' ? 1 : 0) -
        (bypassRoutingMode(b) === 'shared' ? 1 : 0) ||
      a.position.x - b.position.x;

    const left = rowNodes.filter((node) => sideById.get(node.id) === 'left').sort(byOuterPriority);
    const right = rowNodes.filter((node) => sideById.get(node.id) === 'right').sort(byOuterPriority);

    left.forEach((node) => {
      leftCursor -= getSize(node).width;
      rebalancedX.set(node.id, Math.round(leftCursor));
      leftCursor -= NODE_SEP;
    });

    right.forEach((node) => {
      rebalancedX.set(node.id, Math.round(rightCursor));
      rightCursor += getSize(node).width + NODE_SEP;
    });
  });

  layoutedNodes = layoutedNodes.map((node) =>
    rebalancedX.has(node.id)
      ? { ...node, position: { ...node.position, x: rebalancedX.get(node.id)! } }
      : node
  );

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

  const spansByDepth = new Map<number, { minX: number; maxX: number }[]>();
  layoutedNodes.forEach((n) => {
    const d = depths.get(n.id) ?? 0;
    const { width } = getSize(n);
    if (!spansByDepth.has(d)) spansByDepth.set(d, []);
    spansByDepth.get(d)!.push({ minX: n.position.x, maxX: n.position.x + width });
  });
  spansByDepth.forEach((spans) => spans.sort((a, b) => a.minX - b.minX));

  function getInnerGapsForDepth(depth: number): Interval[] {
    const spans = spansByDepth.get(depth) || [];
    if (spans.length === 0) return [];

    const gaps: Interval[] = [];

    const leftEnd = spans[0].minX - INNER_GAP_MARGIN;
    const leftStart = leftEnd - EDGE_LANE_WIDTH;
    if (leftEnd - leftStart >= MIN_INNER_GAP_WIDTH) gaps.push([leftStart, leftEnd]);

    for (let i = 0; i < spans.length - 1; i++) {
      const start = spans[i].maxX + INNER_GAP_MARGIN;
      const end = spans[i + 1].minX - INNER_GAP_MARGIN;
      if (end - start >= MIN_INNER_GAP_WIDTH) gaps.push([start, end]);
    }

    const rightStart = spans[spans.length - 1].maxX + INNER_GAP_MARGIN;
    const rightEnd = rightStart + EDGE_LANE_WIDTH;
    if (rightEnd - rightStart >= MIN_INNER_GAP_WIDTH) gaps.push([rightStart, rightEnd]);

    return gaps;
  }

  // Index des groupes partagés (même mère, même profondeur cible, même côté)
  const sharedGroupByKey = new Map<string, string[]>();
  const sharedTrunkTargetByKey = new Map<string, string>();

  edges.forEach((edge) => {
    const routingMode = (edge.data as any)?.routingMode;
    if (routingMode !== 'shared') return;

    const sourceDepth = depths.get(edge.source) ?? 0;
    const targetDepth = depths.get(edge.target) ?? sourceDepth + 1;
    if (targetDepth - sourceDepth <= 1) return;

    const targetNode = layoutedNodes.find((n) => n.id === edge.target);
    const side = (targetNode?.data as any)?.layoutSide as 'left' | 'right' | null;
    const key = buildSharedRouteKey(edge.source, targetDepth, side);

    if (!sharedGroupByKey.has(key)) sharedGroupByKey.set(key, []);
    const group = sharedGroupByKey.get(key)!;
    if (!group.includes(edge.target)) group.push(edge.target);
  });

  sharedGroupByKey.forEach((targetIds, key) => {
    sharedTrunkTargetByKey.set(key, getSharedTrunkTargetId(layoutedNodes, targetIds));
  });

  let outerLeftLaneCount = 0;
  let outerRightLaneCount = 0;
  const usedInnerLanes: { x: number; minDepth: number; maxDepth: number }[] = [];

  function pickInnerLaneX(
    commonGaps: Interval[],
    desiredX: number,
    minDepth: number,
    maxDepthCrossed: number
  ): number | null {
    let best: Interval | null = null;
    let bestDist = Infinity;
    for (const gap of commonGaps) {
      const clamped = Math.min(Math.max(desiredX, gap[0]), gap[1]);
      const dist = Math.abs(clamped - desiredX);
      if (dist < bestDist) {
        bestDist = dist;
        best = gap;
      }
    }
    if (!best) return null;

    let candidate = Math.min(Math.max(desiredX, best[0]), best[1]);

    const conflicts = () =>
      usedInnerLanes.some(
        (lane) =>
          lane.minDepth <= maxDepthCrossed &&
          lane.maxDepth >= minDepth &&
          Math.abs(lane.x - candidate) < MIN_LANE_SEPARATION
      );

    if (conflicts()) {
      const tryRight = candidate + MIN_LANE_SEPARATION;
      const tryLeft = candidate - MIN_LANE_SEPARATION;
      if (
        tryRight <= best[1] &&
        !usedInnerLanes.some(
          (lane) =>
            lane.minDepth <= maxDepthCrossed &&
            lane.maxDepth >= minDepth &&
            Math.abs(lane.x - tryRight) < MIN_LANE_SEPARATION
        )
      ) {
        candidate = tryRight;
      } else if (
        tryLeft >= best[0] &&
        !usedInnerLanes.some(
          (lane) =>
            lane.minDepth <= maxDepthCrossed &&
            lane.maxDepth >= minDepth &&
            Math.abs(lane.x - tryLeft) < MIN_LANE_SEPARATION
        )
      ) {
        candidate = tryLeft;
      } else {
        return null;
      }
    }

    return candidate;
  }

  /**
   * Canal d'un lien indépendant placé entre la structure centrale et sa fille.
   * Il reste ainsi plus intérieur que la colonne des liens partagés, qui est
   * placée à l'extérieur des filles indépendantes.
   * Les intervalles sont communs à toutes les lignes traversées : le canal ne
   * peut donc pas couper un nœud intermédiaire.
   */
  function pickIndependentSideLaneX(
    commonGaps: Interval[],
    targetNode: Node,
    side: 'left' | 'right',
    minDepth: number,
    maxDepthCrossed: number
  ): number | null {
    const { width } = getSize(targetNode);
    const targetBoundary =
      side === 'left'
        ? targetNode.position.x + width + INNER_GAP_MARGIN
        : targetNode.position.x - INNER_GAP_MARGIN;

    const sideGaps = commonGaps.filter(([start, end]) =>
      side === 'left' ? start >= targetBoundary : end <= targetBoundary
    );

    return pickInnerLaneX(sideGaps, targetBoundary, minDepth, maxDepthCrossed);
  }

  const bypassExitCountByDepth = new Map<number, number>();
  const bypassEntryCountByDepth = new Map<number, number>();
  const sharedRoutes = new Map<
    string,
    { sourceBranchY: number; targetBranchY: number; bypassX: number; trunkTargetId: string }
  >();

  const layoutedEdges = [...edges]
    .sort((a, b) => {
      const sideA = (layoutedNodes.find((node) => node.id === a.target)?.data as any)?.layoutSide;
      const sideB = (layoutedNodes.find((node) => node.id === b.target)?.data as any)?.layoutSide;
      if (sideA !== sideB) return String(sideA).localeCompare(String(sideB));
      const depthDifference = (depths.get(a.source) ?? 0) - (depths.get(b.source) ?? 0);
      return -depthDifference;
    })
    .map((edge) => {
      const sourceDepth = depths.get(edge.source) ?? 0;
      const targetDepth = depths.get(edge.target) ?? sourceDepth + 1;

      const sourceRowBottom =
        (rowTop.get(sourceDepth) ?? 0) + (rowHeight.get(sourceDepth) ?? DEFAULT_NODE_HEIGHT);
      const targetRowTop = rowTop.get(targetDepth) ?? sourceRowBottom + RANK_SEP;

      const levelSpan = targetDepth - sourceDepth;
      const isBypass = levelSpan > 1;
      const targetNode = layoutedNodes.find((node) => node.id === edge.target);
      const requestedSide = (targetNode?.data as any)?.layoutSide as 'left' | 'right' | null;
      const routingMode = (edge.data as any)?.routingMode;
      const isShortestDistance = edge.data?.isShortestDistance === true;
      const sharedRouteKey =
        routingMode === 'shared' && isBypass
          ? buildSharedRouteKey(edge.source, targetDepth, requestedSide)
          : null;

      if (!isBypass) {
        const sourceBranchY = sourceRowBottom + RANK_SEP / 2;
        return {
          ...edge,
          data: {
            ...(edge.data || {}),
            branchY: sourceBranchY,
            bypassX: undefined,
            isSharedTrunk: false,
            isSharedBranch: false,
          },
        };
      }

      const existingSharedRoute = sharedRouteKey ? sharedRoutes.get(sharedRouteKey) : undefined;
      if (existingSharedRoute) {
        const isSharedTrunk = existingSharedRoute.trunkTargetId === edge.target;
        return {
          ...edge,
          data: {
            ...(edge.data || {}),
            branchY: existingSharedRoute.sourceBranchY,
            sourceBranchY: existingSharedRoute.sourceBranchY,
            targetBranchY: existingSharedRoute.targetBranchY,
            bypassX: existingSharedRoute.bypassX,
            isSharedTrunk,
            isSharedBranch: !isSharedTrunk,
          },
        };
      }

      const exitIndex = bypassExitCountByDepth.get(sourceDepth) ?? 0;
      bypassExitCountByDepth.set(sourceDepth, exitIndex + 1);
      const entryIndex = bypassEntryCountByDepth.get(targetDepth) ?? 0;
      bypassEntryCountByDepth.set(targetDepth, entryIndex + 1);

      const sourceGapHalf = RANK_SEP / 2;
      const targetGapHalf = RANK_SEP / 2;

      const sourceOffset = Math.min(sourceGapHalf - 6, BYPASS_Y_BASE_OFFSET + exitIndex * BYPASS_Y_STEP);
      const targetOffset = Math.min(targetGapHalf - 6, BYPASS_Y_BASE_OFFSET + entryIndex * BYPASS_Y_STEP);

      const sourceBranchY = sourceRowBottom + sourceGapHalf - sourceOffset;
      const targetBranchY = targetRowTop - targetGapHalf + targetOffset;
      // Les liens indépendants passent sous les sorties partagées, tout en
      // restant dans l'espace libre de la rangée de leur mère.
      const independentClearanceY =
        routingMode === 'independent' ? sourceRowBottom + sourceGapHalf - 6 : undefined;

      let bypassX: number;

      if (sharedRouteKey) {
        const groupTargetIds = sharedGroupByKey.get(sharedRouteKey) ?? [edge.target];
        bypassX = getDaughtersCenterX(layoutedNodes, groupTargetIds);
      } else {
        const sourceNode = layoutedNodes.find((n) => n.id === edge.source);
        const sourceCenterX = sourceNode ? sourceNode.position.x + getSize(sourceNode).width / 2 : 0;
        const targetCenterX = targetNode ? targetNode.position.x + getSize(targetNode).width / 2 : 0;
        const desiredX = (sourceCenterX + targetCenterX) / 2;

        const minDepth = sourceDepth + 1;
        const maxDepthCrossed = targetDepth - 1;
        let commonGaps: Interval[] | null = null;
        for (let d = minDepth; d <= maxDepthCrossed; d++) {
          const gaps = getInnerGapsForDepth(d);
          commonGaps = commonGaps === null ? gaps : intersectIntervals(commonGaps, gaps);
          if (commonGaps.length === 0) break;
        }

        const innerX =
          commonGaps && commonGaps.length > 0
            ? isShortestDistance
              ? pickInnerLaneX(commonGaps, desiredX, minDepth, maxDepthCrossed)
              : routingMode === 'independent' && requestedSide && targetNode
              ? pickIndependentSideLaneX(
                  commonGaps,
                  targetNode,
                  requestedSide,
                  minDepth,
                  maxDepthCrossed
                )
              : !requestedSide
                ? pickInnerLaneX(commonGaps, desiredX, minDepth, maxDepthCrossed)
                : null
            : null;

        if (innerX !== null) {
          bypassX = innerX;
          usedInnerLanes.push({ x: innerX, minDepth, maxDepth: maxDepthCrossed });
        } else if (
          requestedSide === 'left' ||
          (!requestedSide && outerLeftLaneCount <= outerRightLaneCount)
        ) {
          bypassX = globalMinX - OUTER_BYPASS_GAP - outerLeftLaneCount * OUTER_BYPASS_LANE_SPACING;
          outerLeftLaneCount += 1;
        } else {
          bypassX = globalMaxX + OUTER_BYPASS_GAP + outerRightLaneCount * OUTER_BYPASS_LANE_SPACING;
          outerRightLaneCount += 1;
        }
      }

      const trunkTargetId = sharedRouteKey
        ? sharedTrunkTargetByKey.get(sharedRouteKey) ?? edge.target
        : edge.target;
      const isSharedTrunk = sharedRouteKey ? trunkTargetId === edge.target : false;

      const routedEdge = {
        ...edge,
        data: {
          ...(edge.data || {}),
          branchY: sourceBranchY,
          sourceBranchY,
          targetBranchY,
          independentClearanceY,
          bypassX,
          isSharedTrunk,
          isSharedBranch: sharedRouteKey ? !isSharedTrunk : false,
        },
      };

      if (sharedRouteKey) {
        sharedRoutes.set(sharedRouteKey, {
          sourceBranchY,
          targetBranchY,
          bypassX,
          trunkTargetId,
        });
      }

      return routedEdge;
    });

  return { nodes: layoutedNodes, edges: layoutedEdges };
}
