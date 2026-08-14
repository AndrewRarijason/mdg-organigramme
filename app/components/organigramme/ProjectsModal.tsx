'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Plus, Trash2, X } from 'lucide-react';
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
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-white/30"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                Mes projets
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <motion.button
                onClick={onCreateNew}
                className="w-full text-center px-4 py-3 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Plus className="w-4 h-4" />
                Nouveau projet
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2">
              {projectList.length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-400 text-center">Aucun projet</div>
              )}
              {projectList.map((p) => (
                <motion.div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 border rounded-xl px-4 py-3 transition ${
                    p.id === activeProjectId
                      ? 'border-blue-400 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 hover:bg-slate-50/80'
                  }`}
                  whileHover={{ scale: 1.01 }}
                  transition={{ duration: 0.15 }}
                >
                  <button onClick={() => onOpenProject(p)} className="flex-1 text-left flex flex-col min-w-0">
                    <span className="font-semibold text-slate-800 truncate">{p.title}</span>
                    <span className="text-xs text-slate-400">
                      Modifié le {new Date(p.updated_at).toLocaleDateString('fr-FR')}
                    </span>
                  </button>
                  <button
                    onClick={() => onRequestDelete({ id: p.id, title: p.title })}
                    title="Supprimer ce projet"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}