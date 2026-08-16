'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Plus, Trash2, X, Sparkles, Calendar, ArrowRight } from 'lucide-react';
import type { ProjectSummary } from '@/app/types/organigramme';

export function ProjectsModal({
  open,
  onClose,
  projectList,
  activeProjectId,
  onCreateNew,
  onOpenProject,
  onRequestDelete,
}: {
  open: boolean;
  onClose: () => void;
  projectList: ProjectSummary[];
  activeProjectId: string | null;
  onCreateNew: () => void;
  onOpenProject: (project: ProjectSummary) => void;
  onRequestDelete: (project: { id: string; title: string }) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-slate-200/80"
            initial={{ scale: 0.9, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Moderne & Stylisé */}
            <div className="relative p-6 bg-gradient-to-br from-[#205170] to-[#123746] text-white overflow-hidden flex items-center justify-between shadow-md">
              {/* Effets lumineux d'arrière-plan */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex items-center gap-3.5">
                <motion.div
                  className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner"
                  whileHover={{ scale: 1.08, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FolderOpen className="w-5.5 h-5.5 text-white" />
                </motion.div>

                <div>
                  <h2 className="text-[17px] tracking-[0.05em] md:tracking-normal md:text-[18px] font-bold text-white">
                    Mes projets
                  </h2>
                  <div className="flex text-[10px] md:text-[11px] items-center gap-1.5 text-indigo-200 font-semibold tracking-wide uppercase mb-0.5">
                    {projectList.length} {projectList.length > 1 ? 'projets enregistrés' : 'projet enregistré'}
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

            {/* Bouton Nouveau Projet (Émeraude / Teal) */}
            <div className="p-6 pb-2">
              <motion.button
                onClick={onCreateNew}
                className="w-full text-center px-5 py-3.5 text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md hover:shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer group font-semibold"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
                <span className="text-[13px] md:text-sm tracking-[0.05em] md:tracking-normal">
                  Nouveau projet
                </span>
              </motion.button>
            </div>

            {/* Liste des projets */}
            <div className="flex-1 overflow-y-auto p-6 pt-3 flex flex-col gap-3 custom-scrollbar">
              {projectList.length === 0 && (
                <div className="py-12 px-4 text-center flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-[13px] md:text-sm font-semibold text-slate-700">
                    Aucun projet pour le moment
                  </p>
                  <p className="text-[11px] md:text-xs text-slate-400 mt-1">
                    Créez votre premier organigramme en un clic.
                  </p>
                </div>
              )}

              {projectList.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <motion.div
                    key={p.id}
                    className={`group relative flex items-center justify-between gap-3 border rounded-2xl p-3.5 transition-all duration-200 ${
                      isActive
                        ? 'border-indigo-400 bg-gradient-to-r from-indigo-50/80 to-purple-50/40 shadow-sm'
                        : 'border-slate-200/70 bg-slate-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-md'
                    }`}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      onClick={() => onOpenProject(p)}
                      className="flex-1 text-left flex flex-col min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-[13px] md:text-sm truncate">
                          {p.title}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 text-[9px] md:text-[10px] font-bold bg-indigo-600 text-white rounded-full tracking-wide uppercase shadow-xs">
                            Actif
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mt-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>
                          Modifié le {new Date(p.updated_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <motion.button
                        onClick={() => onOpenProject(p)}
                        className={`p-2 rounded-xl transition-all ${
                          isActive
                            ? 'text-indigo-600 bg-indigo-100/70'
                            : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100'
                        }`}
                        title="Ouvrir ce projet"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </motion.button>

                      <motion.button
                        onClick={() => onRequestDelete({ id: p.id, title: p.title })}
                        title="Supprimer ce projet"
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-100"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}