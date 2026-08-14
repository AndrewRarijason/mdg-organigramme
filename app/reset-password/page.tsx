'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Lock, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // 1. Écouter l'événement Supabase lors de la récupération du token dans l'URL
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || session) {
          setIsReady(true);
          setVerifying(false);
        }
      }
    );

    // 2. Vérifier aussi la session courante au cas où Supabase l'a déjà traitée
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsReady(true);
        setVerifying(false);
      } else {
        // Laisser 3 secondes à Supabase pour traiter les hashs dans l'URL
        const timer = setTimeout(() => {
          setVerifying(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccessMsg('Mot de passe mis à jour avec succès ! Redirection en cours...');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour.');
    } finally {
      setLoading(false);
    }
  };

  // Variants d'animations
  const cardVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.5, type: 'tween', ease: 'easeOut' },
    },
  };

  const shakeVariants: Variants = {
    shake: {
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.4 },
    },
  };

  if (verifying) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 overflow-hidden px-4">
        {/* Arrière-plan avec Image + Overlay */}
        <div 
          className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/hierarchie.jpg')" }}
        >
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/20 text-center max-w-sm"
        >
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-700">
            Vérification du lien de réinitialisation en cours...
          </p>
        </motion.div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-900 overflow-hidden px-4">
        {/* Arrière-plan avec Image + Overlay */}
        <div 
          className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/hierarchie.jpg')" }}
        >
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs" />
        </div>

        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20 text-center"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 text-red-600 mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Lien invalide ou expiré
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Le lien de réinitialisation a expiré ou a déjà été utilisé. Veuillez refaire une demande depuis la page de connexion.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-500/25 transition duration-200 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à la connexion</span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-900 overflow-hidden px-4">
      {/* 🖼️ Arrière-plan avec Image + Overlay Sombre */}
      <div 
        className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hierarchie.jpg')" }}
      >
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs" />
        
        {/* Halos lumineux */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Carte principale */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20 transition-all duration-300"
      >
        {/* En-tête */}
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 mb-4"
            whileHover={{ scale: 1.05, rotate: 2 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <KeyRound className="w-7 h-7" />
          </motion.div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Nouveau mot de passe
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Saisissez votre nouveau mot de passe pour sécuriser votre compte.
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handlePasswordUpdate} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 tracking-wide">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition duration-200"
                placeholder="••••••••"
              />
              
              {/* 👁️ Bouton Oeil pour afficher / masquer */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Alertes Erreur / Succès */}
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

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bouton de soumission */}
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
              <span>Changer le mot de passe</span>
            )}
          </motion.button>
        </form>

        {/* Pied de page */}
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
    </div>
  );
}