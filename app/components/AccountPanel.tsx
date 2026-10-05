'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, LogOut, X, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { PasswordField } from '@/app/components/auth/PasswordField';
import { useChangePassword } from '@/app/hooks/useChangePassword';

export default function AccountPanel({
  email,
  onClose,
  onLoggedOut,
}: {
  email: string;
  onClose: () => void;
  onLoggedOut: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { loading, error, success, changePassword } = useChangePassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await changePassword(newPassword, confirmPassword);
    if (ok) {
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLoggedOut();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80"
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
                <User className="w-5 h-5 text-white" />
              </motion.div>

              <div>
                <h2 className="text-[17px] tracking-[0.05em] md:tracking-normal md:text-[18px] font-bold text-white">
                  Mon compte
                </h2>
                <div className="flex text-[10px] md:text-[11px] items-center gap-1.5 text-indigo-200 font-semibold tracking-wide uppercase mb-0.5">
                  Profil & Sécurité
                </div>
              </div>
            </div>

            <motion.button
              onClick={onClose}
              className="relative z-10 p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 backdrop-blur-sm transition-all cursor-pointer"
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Contenu du Modal */}
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto flex flex-col gap-5 custom-scrollbar pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* Badge de Compte */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <span className="text-[12px] md:text-xs text-slate-600 truncate">
                Connecté en tant que <span className="font-bold text-slate-800 block truncate text-[13px] md:text-sm">{email}</span>
              </span>
            </div>

            {/* Formulaire de Sécurité */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <PasswordField
                id="new-password"
                label="Nouveau mot de passe"
                value={newPassword}
                onChange={setNewPassword}
              />
              <PasswordField
                id="confirm-password"
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChange={setConfirmPassword}
              />

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-[12px] md:text-xs text-red-700"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="flex items-start gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-[12px] md:text-xs text-emerald-700"
                  >
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Mot de passe mis à jour avec succès !</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bouton de confirmation en Émeraude / Teal */}
              <motion.button
                type="submit"
                disabled={loading}
                className="mt-1 w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-[13px] md:text-sm font-semibold tracking-[0.05em] md:tracking-normal hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md hover:shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <Lock className="w-4 h-4" />
                {loading ? 'Mise à jour...' : 'Changer le mot de passe'}
              </motion.button>
            </form>

            <div className="border-t border-slate-100 pt-2">
              <motion.button
                onClick={handleLogout}
                className="w-full py-3 text-[13px] md:text-sm font-semibold text-red-600 hover:bg-red-50/80 rounded-xl transition-all flex items-center justify-center gap-2 border border-red-200/60 hover:border-red-300 cursor-pointer"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}