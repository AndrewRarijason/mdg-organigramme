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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-white/60"
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête de la modale */}
            <div className="p-6 border-b border-slate-100/80 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-md md:text-lg font-bold text-slate-800">Mes projets</h2>
                  <p className="text-[11px] md:text-xs text-slate-400 font-medium">
                    {projectList.length} {projectList.length > 1 ? 'projets enregistrés' : 'projet enregistré'}
                  </p>
                </div>
              </div>
              <motion.button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition p-2 rounded-2xl hover:bg-slate-100/80 cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Bouton Nouveau Projet */}
            <div className="p-6 pb-2">
              <motion.button
                onClick={onCreateNew}
                className="w-full text-center px-5 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
                <span className='text-[12px] md:text-sm tracking-[0.05em] md:tracking-normal'>Nouveau projet</span>
              </motion.button>
            </div>

            {/* Liste des projets */}
            <div className="flex-1 overflow-y-auto p-6 pt-3 flex flex-col gap-3 custom-scrollbar">
              {projectList.length === 0 && (
                <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="text-[13px] md:text-sm font-semibold text-slate-600">Aucun projet pour le moment</p>
                  <p className="text-[13px] md:text-sm text-slate-400 mt-1">Créez votre premier organigramme en un clic.</p>
                </div>
              )}

              {projectList.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <motion.div
                    key={p.id}
                    className={`group relative flex items-center justify-between gap-3 border rounded-2xl p-4 transition-all ${
                      isActive
                        ? 'border-blue-400/80 bg-gradient-to-r from-blue-50/70 to-indigo-50/30 shadow-md shadow-blue-500/5'
                        : 'border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-sm hover:shadow'
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
                        <span className="font-bold text-slate-800 text-[14px] md:text-[16px] truncate">
                          {p.title}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 text-[9px] md:text-[10px] font-bold bg-blue-600 text-white rounded-full tracking-wide shadow-xs uppercase">
                            Actif
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mt-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Modifié le {new Date(p.updated_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1">
                      <motion.button
                        onClick={() => onOpenProject(p)}
                        className={`p-2 rounded-xl transition-all ${
                          isActive
                            ? 'text-blue-600 bg-blue-100/60'
                            : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100'
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
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
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