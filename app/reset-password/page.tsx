'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Lock, KeyRound, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

import { AuthBackground } from '@/app/components/auth/AuthBackground';
import { PasswordField } from '@/app/components/auth/PasswordField';
import { VerifyingState } from '@/app/components/auth/VerifyingState';
import { InvalidLinkState } from '@/app/components/auth/InvalidLinkState';
import { usePasswordRecovery } from '@/app/hooks/usePasswordRecovery';
import { useChangePassword } from '@/app/hooks/useChangePassword';

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, type: 'tween', ease: 'easeOut' } },
};

const shakeVariants: Variants = {
  shake: { x: [0, -10, 10, -10, 10, 0], transition: { duration: 0.4 } },
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const { verifying, isReady } = usePasswordRecovery();
  const { loading, error, success, changePassword } = useChangePassword();
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await changePassword(password);
    if (ok) {
      setTimeout(() => router.push('/'), 2000);
    }
  };

  if (verifying) return <VerifyingState />;
  if (!isReady) return <InvalidLinkState />;

  return (
    <AuthBackground>
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20 transition-all duration-300"
      >
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 mb-4"
            whileHover={{ scale: 1.05, rotate: 2 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <KeyRound className="w-7 h-7" />
          </motion.div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Nouveau mot de passe</h1>
          <p className="text-sm text-slate-500 mt-1">
            Saisissez votre nouveau mot de passe pour sécuriser votre compte.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <PasswordField id="new-password" label="Nouveau mot de passe" value={password} onChange={setPassword} />

          <AnimatePresence>
            {error && (
              <motion.div
                variants={shakeVariants}
                animate="shake"
                className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Mot de passe mis à jour avec succès ! Redirection en cours...</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-500/25 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mise à jour...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Changer le mot de passe</span>
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour à la connexion</span>
          </button>
        </div>
      </motion.div>
    </AuthBackground>
  );
}