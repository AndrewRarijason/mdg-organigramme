'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Plus, Save, FileDown, User } from 'lucide-react';

export function Toolbar({
  projectTitle,
  onProjectTitleChange,
  onOpenProjectsModal,
  onAddPerson,
  onSave,
  saving,
  onExportPDF,
  onOpenAccount,
}: {
  projectTitle: string;
  onProjectTitleChange: (title: string) => void;
  onOpenProjectsModal: () => void;
  onAddPerson: () => void;
  onSave: () => void;
  saving: boolean;
  onExportPDF: () => void;
  onOpenAccount: () => void;
}) {
  return (
    <motion.div
      className="p-4 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm flex flex-wrap gap-4 items-center justify-between sticky top-0 z-20"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-4 flex-wrap">
        <motion.button
          onClick={onOpenProjectsModal}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700 transition flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <FolderOpen className="w-4 h-4" />
          Mes projets
        </motion.button>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => onProjectTitleChange(e.target.value)}
            className="text-xl font-bold text-slate-800 border-b-2 border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent min-w-[120px]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <motion.button
          onClick={onAddPerson}
          className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </motion.button>

        <motion.button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-500 transition shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Save className="w-4 h-4" />
          {saving ? 'En cours...' : 'Enregistrer'}
        </motion.button>

        <motion.button
          onClick={onExportPDF}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FileDown className="w-4 h-4" />
          Exporter au format PDF
        </motion.button>

        <motion.button
          onClick={onOpenAccount}
          title="Mon compte"
          className="w-10 h-10 flex items-center justify-center bg-slate-200 text-slate-700 rounded-full hover:bg-slate-300 transition shadow-sm hover:shadow cursor-pointer text-sm font-bold"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <User className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}