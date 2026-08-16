'use client';

import React from 'react';
import { BaseEdge, EdgeProps } from '@xyflow/react';

/**
 * Dessine une liaison en "T" façon organigramme classique : un segment
 * vertical depuis la carte parent jusqu'à une ligne de branchement
 * horizontale commune (`data.branchY`, calculée par getLayoutedElements
 * pour être identique à TOUTES les liaisons entre deux niveaux
 * adjacents), puis un segment vertical jusqu'à la carte enfant.
 *
 * Deux raffinements visuels pour un rendu plus professionnel :
 * - les coins du "T" sont légèrement arrondis (CORNER_RADIUS), comme
 *   dans les logiciels d'organigramme classiques, plutôt que des angles
 *   droits ;
 * - un petit point plein marque le point d'attache sur la carte enfant,
 *   utile pour repérer d'un coup d'œil où une branche se termine quand
 *   plusieurs liaisons convergent au même niveau.
 *
 * Deux précautions pour éviter une "coupure" visible près des points de
 * connexion lors de la capture (export PDF via domToPng) :
 * - toutes les coordonnées sont arrondies à l'entier (les valeurs
 *   sub-pixel produisent des micro-décalages qui deviennent visibles une
 *   fois rastérisés à scale=2) ;
 * - le trait déborde très légèrement (OVERLAP) dans la carte à chaque
 *   extrémité, pour garantir qu'il touche bien le point de connexion
 *   même en cas d'arrondi.
 *
 * La couleur des liaisons est pilotée par le CSS global
 * (.react-flow__edge-path dans page.tsx) pour rester synchronisée avec
 * les états hover/sélection ; seul le point d'attache est coloré ici
 * directement, car il n'est pas couvert par cette règle CSS.
 */
const OVERLAP = 2;
const CORNER_RADIUS = 10;
const THEME_COLOR = '#205170';
const DANGER_COLOR = '#e11d48';

function buildOrgPath(sx: number, sy: number, tx: number, ty: number, by: number, radius: number): string {
  const dir = tx === sx ? 0 : tx > sx ? 1 : -1;

  // Pas de branchement horizontal (enfant directement sous le parent) :
  // une simple ligne verticale suffit, pas besoin de coins.
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
  const branchY = (data?.branchY as number | undefined) ?? sourceY + (targetY - sourceY) / 2;

  const sx = Math.round(sourceX);
  const sy = Math.round(sourceY) - OVERLAP;
  const tx = Math.round(targetX);
  const ty = Math.round(targetY) + OVERLAP;
  const by = Math.round(branchY);

  const path = buildOrgPath(sx, sy, tx, ty, by, CORNER_RADIUS);

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