'use client';

import React from 'react';
import { BaseEdge, EdgeProps } from '@xyflow/react';

const OVERLAP = 2;
const CORNER_RADIUS = 10;
const THEME_COLOR = '#205170';
const DANGER_COLOR = '#e11d48';

function buildOrgPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  by: number,
  radius: number
): string {
  const dir = tx === sx ? 0 : tx > sx ? 1 : -1;
  if (dir === 0) {
    return `M ${sx},${sy} L ${sx},${ty}`;
  }
  const r = Math.round(
    Math.max(0, Math.min(radius, Math.abs(tx - sx) / 2, Math.abs(by - sy), Math.abs(ty - by)))
  );

  return [
    `M ${sx},${sy}`,
    `L ${sx},${by - r}`,
    `Q ${sx},${by} ${sx + r * dir},${by}`,
    `L ${tx - r * dir},${by}`,
    `Q ${tx},${by} ${tx},${by + r}`,
    `L ${tx},${ty}`,
  ].join(' ');
}

/**
 * Contournement complet (mode indépendant ou tronc partagé) :
 * (a) horizontal mère → bypassX
 * (b) vertical tronc commun
 * (c) branche horizontale → fille
 */
function buildBypassPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sby: number,
  tby: number,
  bx: number,
  radius: number
): string {
  const dirS = bx === sx ? 0 : bx > sx ? 1 : -1;
  const dirT = tx === bx ? 0 : tx > bx ? 1 : -1;

  const r = Math.round(
    Math.max(
      0,
      Math.min(
        radius,
        dirS === 0 ? radius : Math.abs(bx - sx) / 2,
        dirT === 0 ? radius : Math.abs(tx - bx) / 2,
        Math.abs(sby - sy),
        Math.abs(tby - sby) / 2,
        Math.abs(ty - tby)
      )
    )
  );

  const segments = [`M ${sx},${sy}`, `L ${sx},${sby - r}`];

  if (dirS === 0) {
    segments.push(`L ${sx},${sby + r}`);
  } else {
    segments.push(
      `Q ${sx},${sby} ${sx + r * dirS},${sby}`,
      `L ${bx - r * dirS},${sby}`,
      `Q ${bx},${sby} ${bx},${sby + r}`
    );
  }

  segments.push(`L ${bx},${tby - r}`);

  if (dirT === 0) {
    segments.push(`L ${bx},${ty}`);
  } else {
    segments.push(
      `Q ${bx},${tby} ${bx + r * dirT},${tby}`,
      `L ${tx - r * dirT},${tby}`,
      `Q ${tx},${tby} ${tx},${tby + r}`,
      `L ${tx},${ty}`
    );
  }

  return segments.join(' ');
}

/**
 * Lien indépendant avec saut de niveau : la mère est quittée verticalement,
 * puis le palier horizontal est tracé dans son espace de rangée, sous les
 * sorties partagées, avant la dernière descente vers la fille. Les liens
 * partagés conservent buildBypassPath.
 */
function buildIndependentPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  clearanceY: number,
  radius: number
): string {
  const dir = tx === sx ? 0 : tx > sx ? 1 : -1;
  const r = Math.round(
    Math.max(
      0,
      Math.min(
        radius,
        dir === 0 ? radius : Math.abs(tx - sx) / 2,
        Math.abs(clearanceY - sy),
        Math.abs(ty - clearanceY)
      )
    )
  );

  if (dir === 0) return `M ${sx},${sy} L ${tx},${ty}`;

  return [
    `M ${sx},${sy}`,
    `L ${sx},${clearanceY - r}`,
    `Q ${sx},${clearanceY} ${sx + r * dir},${clearanceY}`,
    `L ${tx - r * dir},${clearanceY}`,
    `Q ${tx},${clearanceY} ${tx},${clearanceY + r}`,
    `L ${tx},${ty}`,
  ].join(' ');
}

/** Branche seule d'un groupe partagé : (bypassX, targetBranchY) → fille. */
function buildSharedBranchPath(
  tx: number,
  ty: number,
  tby: number,
  bx: number,
  radius: number
): string {
  const dirT = tx === bx ? 0 : tx > bx ? 1 : -1;

  if (dirT === 0) {
    return `M ${tx},${tby} L ${tx},${ty}`;
  }

  const r = Math.round(
    Math.max(0, Math.min(radius, Math.abs(tx - bx) / 2, Math.abs(ty - tby)))
  );

  return [
    `M ${bx},${tby}`,
    `L ${tx - r * dirT},${tby}`,
    `Q ${tx},${tby} ${tx},${tby + r}`,
    `L ${tx},${ty}`,
  ].join(' ');
}

export function OrgEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const sx = Math.round(sourceX);
  const sy = Math.round(sourceY) - OVERLAP;
  const tx = Math.round(targetX);
  const ty = Math.round(targetY) + OVERLAP;

  const bypassX = data?.bypassX as number | undefined;
  const isSharedBranch = data?.isSharedBranch === true;
  const isIndependentBypass = data?.routingMode === 'independent' && bypassX !== undefined;
  const isShortestDistance = data?.isShortestDistance === true;
  const independentClearanceY = data?.independentClearanceY as number | undefined;
  const sourceBranchY =
    (data?.sourceBranchY as number | undefined) ??
    (data?.branchY as number | undefined) ??
    sourceY + (targetY - sourceY) / 2;
  const targetBranchY = (data?.targetBranchY as number | undefined) ?? sourceBranchY;

  const sby = Math.round(sourceBranchY);
  const tby = Math.round(targetBranchY);

  let path: string;

  if (bypassX !== undefined && isSharedBranch) {
    path = buildSharedBranchPath(tx, ty, tby, Math.round(bypassX), CORNER_RADIUS);
  } else if (isIndependentBypass && !isShortestDistance) {
    const clearanceY = Math.min(Math.max(independentClearanceY ?? sby, sy), ty);
    path = buildIndependentPath(sx, sy, tx, ty, Math.round(clearanceY), CORNER_RADIUS);
  } else if (bypassX !== undefined) {
    path = buildBypassPath(sx, sy, tx, ty, sby, tby, Math.round(bypassX), CORNER_RADIUS);
  } else {
    path = buildOrgPath(sx, sy, tx, ty, sby, CORNER_RADIUS);
  }

  return (
    <>
      <BaseEdge
        path={path}
        style={{ ...style, strokeLinecap: 'round', strokeLinejoin: 'round' }}
        markerEnd={markerEnd}
      />
      <circle
        cx={tx}
        cy={Math.round(targetY)}
        r={selected ? 4 : 3}
        fill={selected ? DANGER_COLOR : THEME_COLOR}
        className="transition-all duration-200"
      />
    </>
  );
}

export const edgeTypes = { orgEdge: OrgEdge };
