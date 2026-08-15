'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Dialogue de confirmation générique — réutilisé pour la suppression
 * d'un projet ou d'une liaison. `open` contrôle l'affichage,
 * le contenu (titre/message) est personnalisable via props.
 */
export function ConfirmDeleteDialog({
  open,
  title,
  message,
  confirmLabel = 'Supprimer',
  loading = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4" initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-white/30"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <h3 className="text-md sm:text-lg font-bold text-slate-800 mb-2">{title}</h3>
            <p className="text-[13px] md:text-sm text-slate-600 mb-5">{message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-[13px] md:text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="px-4 py-2 text-[13px] md:text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Suppression...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}