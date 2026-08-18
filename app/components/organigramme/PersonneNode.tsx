'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Handle, Position, NodeResizer, useNodeConnections } from '@xyflow/react';
import { Briefcase, Users } from 'lucide-react';
import type { CustomNodeData } from '@/app/types/organigramme';
import { useExportMode } from '@/app/lib/exportMode';

/**
 * Carte "personne" de l'organigramme.
 *
 * Identité visuelle (couleur de marque #205170) :
 * - Les nœuds SANS supérieur (sommet de la hiérarchie) reçoivent un fond
 *   plein #205170 : au premier coup d'œil, la ou les têtes de
 *   l'organigramme se distinguent instantanément du reste des équipes.
 * - Tous les autres nœuds gardent une carte claire avec une fine liséré
 *   d'accent en haut et des touches #205170 (avatar, badge poste,
 *   points d'ancrage), pour rester cohérents avec les liaisons.
 * - Un badge discret indique le nombre de subordonnés directs, pour lire
 *   la taille de chaque équipe sans avoir à compter les branches.
 */
export const PersonNode = ({
  data,
  selected,
}: {
  id: string;
  data: CustomNodeData;
  selected?: boolean;
}) => {
  const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Sans nom';
  const initials =
    `${(data.firstName || '').trim().charAt(0)}${(data.lastName || '').trim().charAt(0)}`.toUpperCase() || '?';
  const isExporting = useExportMode();

  // Connexions réelles de ce nœud (le hook déduit automatiquement le
  // nœud courant depuis le contexte React Flow interne)
  const targetConnections = useNodeConnections({ handleType: 'target' }); // liaisons vers la mère
  const sourceConnections = useNodeConnections({ handleType: 'source' }); // liaisons vers les filles

  const hasParent = targetConnections.length > 0;
  const hasChildren = sourceConnections.length > 0;
  const directReportsCount = sourceConnections.length;

  // Sommet de la hiérarchie = aucun supérieur.
  const isTopLevel = !hasParent;

  // Sur le canevas interactif, les points restent toujours visibles (on
  // doit pouvoir créer une liaison même sur un nœud qui n'en a pas
  // encore). Seul l'export PDF masque les points inutilisés.
  const showTopHandle = !isExporting || hasParent;
  const showBottomHandle = !isExporting || hasChildren;

  return (
    <motion.div
      className={`w-full h-auto min-w-[160px] md:min-w-[200px] box-border rounded-2xl p-3 md:p-4 flex flex-col items-center gap-2 relative group border transition-colors duration-300 ${isTopLevel
          ? 'bg-[#205170] border-[#163c53] shadow-lg shadow-[#205170]/20'
          : 'bg-white/95 backdrop-blur-md border-slate-200/80 shadow-sm hover:border-[#205170]/40'
        } ${selected ? 'border-[#205170] ring-2 ring-[#205170]/25' : ''}`}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.85, opacity: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, type: 'spring', stiffness: 400 }}
    >
      {/* Liséré d'accent supérieur — uniquement sur les cartes claires,
          la carte "sommet" étant déjà pleine couleur */}
      {!isTopLevel && (
        <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl bg-gradient-to-r from-[#205170] to-[#2d6d94]" />
      )}

      {/* Poignées de redimensionnement */}
      <NodeResizer
        isVisible={selected}
        minWidth={150}
        maxWidth={400}
        minHeight={130}
        handleStyle={{
          width: 9,
          height: 9,
          borderRadius: 3,
          backgroundColor: '#205170',
          border: '2px solid white',
        }}
        lineStyle={{ borderColor: '#205170', strokeWidth: 1.5 }}
      />

      {/* Points d'ancrage (masqués uniquement à l'export PDF si non utilisés) */}
      {showTopHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 md:!w-3.5 md:!h-3.5 !bg-white !border-2 !border-[#205170] !shadow-sm hover:!scale-125 transition-transform cursor-pointer"
        />
      )}
      {showBottomHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 md:!w-3.5 md:!h-3.5 !bg-white !border-2 !border-[#205170] !shadow-sm hover:!scale-125 transition-transform cursor-pointer"
        />
      )}

      {/* Photo de profil (ou initiales si aucune photo n'a été ajoutée) */}
      <div className="relative mt-1">
        <div
          className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden p-0.5 flex-shrink-0 shadow-md ${isTopLevel ? 'bg-white/15 ring-2 ring-white/30' : 'bg-gradient-to-tr from-[#205170] to-[#2d6d94]'
            }`}
        >
          <div className="w-full h-full rounded-full overflow-hidden bg-slate-50 flex items-center justify-center">
            {data.photoUrl ? (
              <img src={data.photoUrl} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg md:text-xl font-bold text-[#205170] select-none">{initials}</span>
            )}
          </div>
        </div>
      </div>

      {/* Informations (lecture seule) */}
      <div className="w-full flex flex-col gap-1 text-[14px] md:text-[16px] items-center">
        <div className="text-center px-1 w-full">
          <span className={`font-semibold ${isTopLevel ? 'text-white/90' : 'text-slate-800'}`}>
            {data.firstName}
          </span>{' '}
          <span
            className={`inline-block max-w-full break-all font-bold uppercase tracking-wide ${isTopLevel ? 'text-white' : 'text-slate-900'
              }`}
          >
            {data.lastName}
          </span>
        </div>

        {data.jobTitle && (
          <div
            className={`w-full rounded-md px-2 py-1 border flex items-start gap-1.5 mt-0.5 justify-center ${isTopLevel ? 'bg-white/10 border-white/15' : 'bg-[#205170] border-[#205170]/10'
              }`}
          >
            <span
              className={`text-center text-[11px] md:text-[12px] font-medium leading-tight whitespace-normal break-words max-w-full ${isTopLevel ? 'text-white/85' : 'text-slate-100'
                }`}
            >
              {data.jobTitle}
            </span>
          </div>
        )}
      </div>

      {/* Badge "nombre de subordonnés directs" — masqué pendant la
          sélection (chevauche les poignées de redimensionnement) et
          pendant l'export PDF (élément d'interface, pas d'organigramme) */}
      {hasChildren && !selected && !isExporting && (
        <div className="absolute -bottom-2.5 right-3 flex items-center gap-1 bg-white border border-[#205170]/20 text-[#205170] text-[12px] md:text-[13px] font-semibold px-1.5 py-0.5 rounded-full shadow-sm">
          <Users className="w-3 h-3 md:w-3.5 md:h-3.5" />
          {directReportsCount}
        </div>
      )}
    </motion.div>
  );
};

export const nodeTypes = { personNode: PersonNode };
