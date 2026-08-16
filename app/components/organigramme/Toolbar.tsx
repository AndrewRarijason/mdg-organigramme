'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Plus,
  Save,
  FileDown,
  User,
  Undo2,
  Redo2,
  Loader2,
  MoreVertical,
  CheckCircle2,
  Sparkles,
  Users,
} from 'lucide-react';

export function Toolbar({
  projectTitle,
  onProjectTitleChange,
  onOpenProjectsModal,
  onAddPerson,
  onOpenEmployeeList,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  saving,
  autoSaving,
  lastAutoSavedAt,
  onExportPDF,
  exportingPdf,
  exportPdfProgress = 0,
  onOpenAccount,
}: {
  projectTitle: string;
  onProjectTitleChange: (title: string) => void;
  onOpenProjectsModal: () => void;
  onAddPerson: () => void;
  onOpenEmployeeList: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  saving: boolean;
  autoSaving?: boolean;
  lastAutoSavedAt?: Date | null;
  onExportPDF: () => void;
  exportingPdf?: boolean;
  exportPdfProgress?: number;
  onOpenAccount: () => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionsOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  return (
    <motion.header
      className="p-3 sm:p-4 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs flex items-center justify-between sticky top-0 z-30 transition-all gap-2"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Zone Gauche : Titre & Liste des Employés */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
        <motion.button
          onClick={onOpenEmployeeList}
          className="p-2 sm:px-3.5 sm:py-2 bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-700 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer border border-slate-200 shadow-xs"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          title="Voir les employés"
        >
          <Users className="w-4 h-4 text-indigo-600" />
          <span className="hidden lg:inline">Employés</span>
        </motion.button>

        <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />

        <div className="relative flex items-center min-w-0">
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => onProjectTitleChange(e.target.value)}
            placeholder="Nom du projet"
            className="text-[13px] sm:text-sm font-bold text-slate-800 placeholder-slate-400 bg-transparent px-1 sm:px-2 py-1 rounded-lg border-b-2 border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-slate-50 focus:outline-none transition-all duration-200 w-[180px] lg:min-w-[300px] truncate"
          />
        </div>
      </div>

      {/* Zone Droite : Outils & Actions */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Status de Sauvegarde Automatique */}
        {(autoSaving || lastAutoSavedAt) && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/80 border border-slate-200/80 text-xs text-slate-600 font-medium">
            {autoSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span>Sauvegarde...</span>
              </>
            ) : (
              lastAutoSavedAt && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Sauvegardé à{' '}
                    {lastAutoSavedAt.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </>
              )
            )}
          </div>
        )}

        {/* Progrès d'export PDF */}
        {exportingPdf && (
          <div className="min-w-[100px] sm:min-w-[200px] px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-blue-200 bg-slate-50 shadow-xs">
            <div className="text-[10px] sm:text-[11px] font-semibold text-blue-900 mb-0.5 sm:mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                <span className="hidden sm:inline">Export PDF...</span>
                <span className="sm:hidden">PDF</span>
              </span>
              <span>{Math.round(exportPdfProgress)}%</span>
            </div>
            <div className="h-1 sm:h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-200"
                style={{ width: `${exportPdfProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Groupe Undo / Redo */}
        <div className="flex items-center p-0.5 sm:p-1 rounded-xl sm:rounded-2xl bg-slate-100 border border-slate-200 shadow-xs">
          <motion.button
            onClick={onUndo}
            disabled={!canUndo}
            title="Annuler (Ctrl+Z)"
            className="p-1.5 sm:p-2 text-slate-700 hover:bg-white hover:text-blue-600 rounded-lg sm:rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-700 cursor-pointer disabled:cursor-not-allowed shadow-none"
            whileHover={{ scale: canUndo ? 1.05 : 1 }}
            whileTap={{ scale: canUndo ? 0.92 : 1 }}
          >
            <Undo2 className="w-4 h-4" />
          </motion.button>

          <div className="h-4 w-[1px] bg-slate-200 my-auto" />

          <motion.button
            onClick={onRedo}
            disabled={!canRedo}
            title="Rétablir (Ctrl+Y)"
            className="p-1.5 sm:p-2 text-slate-700 hover:bg-white hover:text-blue-600 rounded-lg sm:rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-700 cursor-pointer disabled:cursor-not-allowed shadow-none"
            whileHover={{ scale: canRedo ? 1.05 : 1 }}
            whileTap={{ scale: canRedo ? 0.92 : 1 }}
          >
            <Redo2 className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Bouton Ajouter */}
        <motion.button
          onClick={onAddPerson}
          className="p-2 sm:px-4 sm:py-2 bg-slate-900 text-white rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold hover:bg-slate-800 transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          title="Ajouter"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span className="hidden lg:inline">Ajouter</span>
        </motion.button>

        {/* Bouton Sauvegarder */}
        <motion.button
          onClick={onSave}
          disabled={saving}
          title="Enregistrer"
          className="p-2 sm:px-4 sm:py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
        </motion.button>

        {/* Menu Contextuel / Actions */}
        <div className="relative" ref={actionsMenuRef}>
          <motion.button
            type="button"
            onClick={() => setActionsOpen((v) => !v)}
            title="Plus d'actions"
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all cursor-pointer border shadow-xs ${
              actionsOpen
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MoreVertical className="w-4 h-4" />
          </motion.button>

          <AnimatePresence>
            {actionsOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-52 sm:w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden p-1.5"
              >
                <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Projets & Gestion
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onOpenProjectsModal();
                    setActionsOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                  <span>Mes projets</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Options d'export
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onExportPDF();
                    setActionsOpen(false);
                  }}
                  disabled={exportingPdf}
                  className="w-full px-3 py-2.5 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded-xl transition flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  {exportingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <FileDown className="w-4 h-4 text-blue-600" />
                  )}
                  <span>Exporter en PDF</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    onSave();
                    setActionsOpen(false);
                  }}
                  disabled={saving}
                  className="w-full px-3 py-2.5 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-emerald-600 rounded-xl transition flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Sauvegarder le projet</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profil utilisateur */}
        <motion.button
          onClick={onOpenAccount}
          title="Mon compte"
          className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-slate-900 text-white rounded-xl sm:rounded-2xl hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
        >
          <User className="w-4 h-4 sm:w-5 sm:h-5" />
        </motion.button>
      </div>
    </motion.header>
  );
}