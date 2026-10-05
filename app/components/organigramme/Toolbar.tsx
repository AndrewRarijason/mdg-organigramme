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
  Network,
  ChevronDown,
} from 'lucide-react';

const BRAND = '#205170';
const BRAND_DARK = '#123549';
const BRAND_DARKER = '#0c2532';
const BRAND_LIGHT = '#2d6d94';

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
      className="relative flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3 border-b border-black/10 shadow-[0_2px_10px_-2px_rgba(12,37,50,0.35)] sticky top-0 z-30 backdrop-blur-xl"
      style={{ background: `linear-gradient(115deg, ${BRAND_DARKER} 0%, ${BRAND_DARK} 42%, ${BRAND} 100%)` }}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Liséré lumineux en bas de la barre */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] opacity-70"
        style={{ background: `linear-gradient(90deg, ${BRAND_LIGHT} 0%, rgba(255,255,255,0.5) 50%, transparent 100%)` }}
      />

      {/* ===== Zone Gauche : Identité du projet ===== */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 flex-1 sm:flex-none min-w-0">
        {/* Marque / logo miniature */}
        <div className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center shrink-0 bg-white/10 border border-white/15 shadow-inner">
          <Network className="w-4.5 h-4.5 text-white" />
        </div>

        <div className="flex flex-col flex-1 sm:flex-none min-w-0">
          <div className="relative flex items-center min-w-0 group">
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => onProjectTitleChange(e.target.value)}
              placeholder="Nom du projet"
              className="text-sm sm:text-base font-bold text-white placeholder-white/40 bg-transparent px-1 py-0.5 -mx-1 rounded-lg border-b-2 border-transparent hover:border-white/25 focus:border-white/70 focus:bg-white/10 focus:outline-none transition-all duration-200 w-full min-w-0 sm:w-[220px] lg:w-[280px] truncate"
            />
          </div>
          <span className="hidden sm:block text-[11px] text-white/50 font-medium px-1 -mt-0.5">
            Organigramme
          </span>
        </div>

        <div className="h-8 w-px bg-white/15 hidden md:block" />

        <motion.button
          onClick={onOpenEmployeeList}
          className="hidden md:flex px-3 py-2 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/90 hover:text-white rounded-xl text-xs font-semibold transition-all items-center gap-1.5 cursor-pointer border border-white/15"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          title="Voir les employés"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Employés</span>
        </motion.button>
      </div>

      {/* ===== Zone Droite : Statuts & Actions ===== */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Statut de sauvegarde automatique */}
        <AnimatePresence mode="wait">
          {(autoSaving || lastAutoSavedAt) && (
            <motion.div
              key={autoSaving ? 'saving' : 'saved'}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`hidden lg:flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full border text-[11px] font-semibold ${
                autoSaving
                  ? 'bg-sky-400/15 border-sky-300/25 text-sky-100'
                  : 'bg-emerald-400/15 border-emerald-300/25 text-emerald-100'
              }`}
            >
              {autoSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Sauvegarde...</span>
                </>
              ) : (
                lastAutoSavedAt && (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                      Dernière sauvegarde : {lastAutoSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progrès d'export PDF (sur mobile : barre fine sous la barre d'outils) */}
        {exportingPdf && (
          <div className="sm:hidden absolute left-0 right-0 bottom-0 h-[3px] bg-white/15 z-10" aria-hidden>
            <motion.div
              className="h-full bg-white"
              animate={{ width: `${exportPdfProgress}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        )}
        {exportingPdf && (
          <div className="hidden sm:block min-w-[180px] px-3 py-1.5 rounded-xl border border-white/20 bg-white/10">
            <div className="text-[10px] font-bold mb-1 flex items-center justify-between text-white/90">
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Export PDF</span>
              </span>
              <span>{Math.round(exportPdfProgress)}%</span>
            </div>
            <div className="h-1 bg-white/15 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-white"
                animate={{ width: `${exportPdfProgress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>
        )}

        {/* Groupe Undo / Redo */}
        <div className="flex items-center p-0.5 rounded-xl bg-white/10 border border-white/15">
          <motion.button
            onClick={onUndo}
            disabled={!canUndo}
            title="Annuler (Ctrl+Z)"
            className="p-1.5 sm:p-2 text-white/80 hover:bg-white/20 hover:text-white rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/80 cursor-pointer disabled:cursor-not-allowed"
            whileHover={{ scale: canUndo ? 1.08 : 1 }}
            whileTap={{ scale: canUndo ? 0.9 : 1 }}
          >
            <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </motion.button>

          <div className="h-4 w-px bg-white/15" />

          <motion.button
            onClick={onRedo}
            disabled={!canRedo}
            title="Rétablir (Ctrl+Y)"
            className="p-1.5 sm:p-2 text-white/80 hover:bg-white/20 hover:text-white rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/80 cursor-pointer disabled:cursor-not-allowed"
            whileHover={{ scale: canRedo ? 1.08 : 1 }}
            whileTap={{ scale: canRedo ? 0.9 : 1 }}
          >
            <Redo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </motion.button>
        </div>

        {/* Bouton Ajouter — seule touche de couleur vive de la barre */}
        <motion.button
          onClick={onAddPerson}
          className="p-2 sm:px-4 sm:py-2 bg-white text-[#123549] rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:shadow-md hover:bg-white/90 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          title="Ajouter un employé"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden lg:inline">Ajouter</span>
        </motion.button>

        {/* Bouton Enregistrer */}
        <motion.button
          onClick={onSave}
          disabled={saving}
          title="Enregistrer"
          className="p-2 sm:px-4 sm:py-2 bg-white/10 text-white border border-white/20 rounded-xl text-xs sm:text-sm font-semibold hover:bg-white/20 transition-all disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 cursor-pointer"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="hidden lg:inline">{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
        </motion.button>

        <div className="h-8 w-px bg-white/15 hidden sm:block" />

        {/* Menu Contextuel / Actions */}
        <div className="relative" ref={actionsMenuRef}>
          <motion.button
            type="button"
            onClick={() => setActionsOpen((v) => !v)}
            title="Plus d'actions"
            className={`relative flex items-center gap-0.5 p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer border ${
              actionsOpen
                ? 'bg-white/20 border-white/30 text-white'
                : 'bg-white/10 border-white/15 text-white/80 hover:bg-white/20 hover:text-white'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin sm:hidden" /> : null}
            <MoreVertical className={`w-4 h-4 ${exportingPdf ? 'hidden sm:block' : ''}`} />
          </motion.button>

          <AnimatePresence>
            {actionsOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-60 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-900/20 z-50 overflow-hidden p-1.5"
              >
                <div className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Projets & Gestion
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onOpenProjectsModal();
                    setActionsOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#205170] rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" style={{ color: BRAND }} />
                  <span>Mes projets</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenEmployeeList();
                    setActionsOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#205170] rounded-xl transition flex items-center gap-2.5 cursor-pointer md:hidden"
                >
                  <Users className="w-4 h-4" style={{ color: BRAND }} />
                  <span>Liste des employés</span>
                </button>

                <div className="my-1.5 border-t border-slate-100" />

                <div className="px-3 pt-1.5 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Export
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onExportPDF();
                    setActionsOpen(false);
                  }}
                  disabled={exportingPdf}
                  className="w-full px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#205170] rounded-xl transition flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  {exportingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: BRAND }} />
                  ) : (
                    <FileDown className="w-4 h-4" style={{ color: BRAND }} />
                  )}
                  <span>Exporter en PDF</span>
                </button>

                <div className="my-1.5 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    onSave();
                    setActionsOpen(false);
                  }}
                  disabled={saving}
                  className="w-full px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
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
          className="flex items-center gap-1 pl-0.5 pr-1 sm:pl-1 sm:pr-1.5 py-1 rounded-full border border-white/20 hover:border-white/35 bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white text-[#123549] shrink-0">
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <ChevronDown className="w-3 h-3 text-white/60 hidden sm:block" />
        </motion.button>
      </div>
    </motion.header>
  );
}