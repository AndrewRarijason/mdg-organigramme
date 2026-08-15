'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { X } from 'lucide-react';
import type { CustomNodeData } from '@/app/types/organigramme';

export const PersonNode = ({
  id,
  data,
  selected,
}: {
  id: string;
  data: CustomNodeData;
  selected?: boolean;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div
      className="w-full h-auto min-w-[90px] md:min-w-[120px] box-border bg-white border-2 border-slate-300 rounded-lg p-1.5 md:p-2 shadow-md flex flex-col items-center gap-0.5 md:gap-1 relative group"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2, type: 'spring', stiffness: 500 }}
    >
      {/* Bouton de suppression */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          data.onDeleteNode?.(id);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          data.onDeleteNode?.(id);
        }}
        title="Supprimer la carte"
        className={`absolute -top-2 -right-2 w-5 h-5 md:w-6 md:h-6 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center transition shadow-md z-30 cursor-pointer ${
          selected ? 'opacity-100 scale-110' : 'opacity-80 sm:opacity-0 sm:group-hover:opacity-100'
        }`}
      >
        <X className="w-3 h-3" />
      </button>

      {/* Poignées de redimensionnement */}
      <NodeResizer
        isVisible={selected}
        minWidth={90}
        maxWidth={400}
        minHeight={90}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#2563eb', border: '1px solid white' }}
        lineStyle={{ borderColor: '#2563eb' }}
      />

      {/* Points d'ancrage */}
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 !bg-blue-600 !border-2 !border-white cursor-pointer" />
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 !bg-blue-600 !border-2 !border-white cursor-pointer" />

      {/* Photo de profil */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="w-8 h-8 md:w-12 md:h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 cursor-pointer relative group-hover:opacity-90 transition"
        title="Cliquer pour changer la photo"
      >
        <img
          src={data.photoUrl || 'https://via.placeholder.com/150?text=Photo'}
          alt={`${data.lastName} ${data.firstName}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-[8px] md:text-[9px] text-center font-medium">
          Changer
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            data.onPhotoUpload(id, e.target.files[0]);
          }
        }}
      />

      {/* Champs éditables */}
      <div className="w-full flex flex-col gap-0.5 md:gap-1 text-[9px] md:text-[11px]">
        <div className="flex gap-0.5 md:gap-1 justify-center">
          <input
            type="text"
            value={data.lastName}
            onChange={(e) => data.onChange(id, 'lastName', e.target.value)}
            placeholder="Nom"
            className="w-1/2 text-right font-bold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent"
          />
          <input
            type="text"
            value={data.firstName}
            onChange={(e) => data.onChange(id, 'firstName', e.target.value)}
            placeholder="Prénom"
            className="w-1/2 font-bold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent"
          />
        </div>
        <textarea
          value={data.jobTitle}
          onChange={(e) => data.onChange(id, 'jobTitle', e.target.value)}
          placeholder="Intitulé du poste"
          rows={2}
          className="text-slate-500 text-center text-[8px] md:text-[10px] border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent resize-none w-full overflow-hidden leading-tight"
        />
      </div>
    </motion.div>
  );
};

export const nodeTypes = { personNode: PersonNode };