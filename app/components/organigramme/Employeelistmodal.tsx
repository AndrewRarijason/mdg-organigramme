'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Pencil, Trash2, Briefcase, Sparkles, UserPlus } from 'lucide-react';
import type { Node } from '@xyflow/react';

export function EmployeeListModal({
  open,
  onClose,
  nodes,
  onEdit,
  onRequestDelete,
  onAddEmployee,
}: {
  open: boolean;
  onClose: () => void;
  nodes: Node[];
  onEdit: (node: Node) => void;
  onRequestDelete: (node: { id: string; label: string }) => void;
  onAddEmployee?: () => void;
}) {
  const sortedNodes = [...nodes].sort((a, b) => {
    const da = a.data as any;
    const db = b.data as any;
    return `${da.lastName}${da.firstName}`.localeCompare(`${db.lastName}${db.firstName}`, 'fr');
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[85vh] flex flex-col overflow-hidden border border-slate-200/80"
            initial={{ scale: 0.9, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Moderne & Stylisé */}
            <div className="relative p-4 sm:p-6 bg-gradient-to-br from-[#205170] to-[#123746] text-white overflow-hidden flex items-center justify-between shadow-md shrink-0">
              {/* Effets lumineux d'arrière-plan */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex items-center gap-3.5">
                <motion.div
                  className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner"
                  whileHover={{ scale: 1.08, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Users className="w-5 h-5 text-white" />
                </motion.div>

                <div>
                  <h2 className="text-[17px] tracking-[0.05em] md:tracking-normal md:text-[18px] font-bold text-white">
                    Liste des employés
                  </h2>
                  <div className="flex text-[10px] md:text-[11px] items-center gap-1.5 text-indigo-200 font-semibold tracking-wide uppercase mb-0.5">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    {nodes.length} {nodes.length > 1 ? 'membres enregistrés' : 'membre enregistré'}
                  </div>
                </div>
              </div>

              <motion.button
                onClick={onClose}
                className="relative z-10 p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 backdrop-blur-sm transition-all cursor-pointer"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Bouton d'ajout d'employé en haut de la liste */}
            {onAddEmployee && (
              <div className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 shrink-0">
                <motion.button
                  onClick={() => {
                    onClose();
                    onAddEmployee();
                  }}
                  className="w-full text-center px-5 py-3.5 text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md hover:shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer group font-semibold"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <UserPlus className="w-4.5 h-4.5" />
                  <span className="text-[13px] md:text-sm tracking-[0.05em] md:tracking-normal">
                    Ajouter un employé
                  </span>
                </motion.button>
              </div>
            )}

            {/* Liste des employés avec défilement (Scrollbar) */}
            <div className="flex-1 overflow-y-auto p-4 pt-3 sm:p-6 sm:pt-3 flex flex-col gap-3 custom-scrollbar pb-[max(1rem,env(safe-area-inset-bottom))]">
              {sortedNodes.length === 0 && (
                <div className="py-12 text-center text-xs md:text-sm text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Aucun employé pour le moment
                </div>
              )}

              {sortedNodes.map((node) => {
                const data = node.data as any;
                const label = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Sans nom';
                return (
                  <div
                    key={node.id}
                    className="flex items-center gap-3.5 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-200/70 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="w-11 h-11 rounded-2xl overflow-hidden bg-white border border-slate-200 flex-shrink-0 shadow-xs">
                      <img
                        src={data.photoUrl || 'https://via.placeholder.com/80?text=?'}
                        alt={label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-[13px] md:text-sm truncate">
                        {label}
                      </p>
                      {data.jobTitle && (
                        <p className="text-[11px] md:text-xs text-slate-500 flex items-center gap-1 truncate mt-0.5">
                          <Briefcase className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                          {data.jobTitle}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <motion.button
                        onClick={() => onEdit(node)}
                        title="Modifier"
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer border border-transparent hover:border-indigo-100"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Pencil className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => onRequestDelete({ id: node.id, label })}
                        title="Supprimer"
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer border border-transparent hover:border-red-100"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}