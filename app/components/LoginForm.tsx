'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Mail, ArrowLeft, LogIn, UserPlus, KeyRound, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

const ALLOWED_EMAIL_SUFFIX = 'madagascar-services.com';
const DOMAIN_ERROR_MESSAGE = `Seule l'adresse email du domaine "${ALLOWED_EMAIL_SUFFIX}" est autorisée.`;

function hasAllowedDomain(email: string) {
  return email.trim().toLowerCase().endsWith(ALLOWED_EMAIL_SUFFIX);
}

export default function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Adresse e-mail ou mot de passe incorrect.');
          }
          throw error;
        }
        onLoggedIn();
      } else if (mode === 'signup') {
        if (!hasAllowedDomain(email)) {
          throw new Error(DOMAIN_ERROR_MESSAGE);
        }

        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfoMsg('Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.');
      } else {
        if (!hasAllowedDomain(email)) {
          throw new Error(DOMAIN_ERROR_MESSAGE);
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfoMsg('Si un compte existe avec cet email, un lien de réinitialisation vient de lui être envoyé.');
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'signup' | 'reset') => {
    setError(null);
    setInfoMsg(null);
    setMode(newMode);
    setEmailFocused(false);
    setPasswordFocused(false);
    setShowPassword(false);
  };

  const pageVariants: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, type: 'tween', ease: 'easeOut' } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3, type: 'tween', ease: 'easeIn' } },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5, type: 'tween', ease: 'easeOut' },
    },
  };

  const shakeVariants: Variants = {
    shake: {
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row overflow-hidden">
      <div
        className="hidden md:flex md:w-2/3 relative bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hierarchievf.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/30" />

        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
        >
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/20 rounded-full blur-2xl animate-spin-slow" />
          <motion.div
            className="absolute top-10 left-10 w-16 h-16 border-2 border-blue-400/30 rounded-lg rotate-12"
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute bottom-10 right-10 w-20 h-20 border-2 border-indigo-400/30 rounded-full"
            animate={{ rotate: -360, scale: [1, 1.3, 1] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute top-1/3 right-1/4 w-12 h-12 border border-purple-400/30 rounded-lg"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute bottom-1/3 left-1/4 w-10 h-10 border-2 border-teal-400/30 rounded-full"
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </div>

      <div className="flex-1 md:w-1/3 bg-white flex items-center justify-center p-4 md:p-8 min-h-screen">
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md bg-white/95 backdrop-blur-md md:bg-transparent md:backdrop-blur-none rounded-2xl p-6 md:p-0 shadow-2xl md:shadow-none"
        >
          <div className="text-center mb-8">
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 mb-4"
              whileHover={{ scale: 1.1, rotate: 3 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              {mode === 'login' && <LogIn className="w-7 h-7" />}
              {mode === 'signup' && <UserPlus className="w-7 h-7" />}
              {mode === 'reset' && <KeyRound className="w-7 h-7" />}
            </motion.div>

            <motion.h1
              className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight"
              key={mode}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {mode === 'login' && 'Connectez-vous'}
              {mode === 'signup' && 'Créer un compte'}
              {mode === 'reset' && 'Réinitialisation'}
            </motion.h1>
            <p className="text-[12px] md:text-sm text-slate-500 mt-1">
              {mode === 'reset'
                ? 'Saisissez votre email pour recevoir un lien de récupération'
                : 'Gérez et structurez vos organigrammes en toute simplicité'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={mode} variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(email !== '')}
                    className="peer w-full px-4 pt-6 pb-2 bg-white border border-slate-300 rounded-xl text-[14px] md:text-sm text-slate-800 placeholder-transparent focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition duration-200"
                    placeholder=" "
                  />
                  <label
                    htmlFor="email"
                    className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      emailFocused || email ? 'top-1 text-xs text-blue-600' : 'top-3.5 text-sm text-slate-500'
                    }`}
                  >
                    Adresse e-mail
                  </label>
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 peer-focus:text-blue-500 transition-colors" />
                </div>

                {mode !== 'reset' && (
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(password !== '')}
                      className="peer w-full px-4 pt-6 pb-2 bg-white border border-slate-300 rounded-xl text-[14px] md:text-sm text-slate-800 placeholder-transparent focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition duration-200 pr-10"
                      placeholder=" "
                    />
                    <label
                      htmlFor="password"
                      className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        passwordFocused || password ? 'top-1 text-xs text-blue-600' : 'top-3.5 text-sm text-slate-500'
                      }`}
                    >
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {mode === 'login' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-xs font-medium text-blue-600 hover:underline transition cursor-pointer"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div
                      variants={shakeVariants}
                      animate="shake"
                      className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                  {infoMsg && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start gap-2"
                    >
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{infoMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full py-3 px-4 overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-500/30 hover:shadow-xl transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Patientez...</span>
                    </>
                  ) : (
                    <span>
                      {mode === 'login' && 'Se connecter'}
                      {mode === 'signup' && "S'inscrire"}
                      {mode === 'reset' && 'Envoyer le lien'}
                    </span>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            {mode === 'reset' ? (
              <button
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour à la connexion</span>
              </button>
            ) : (
              <p className="text-xs text-slate-500">
                {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
                <button
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="font-semibold text-blue-600 hover:text-blue-700 transition underline underline-offset-2 cursor-pointer"
                >
                  {mode === 'login' ? "S'inscrire" : 'Se connecter'}
                </button>
              </p>
            )}
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        @media (max-width: 767px) {
          .md\\:flex {
            display: none !important;
          }
          .flex-1 {
            background-image: url('/hierarchievf.jpg');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            position: relative;
          }
          .flex-1::before {
            content: '';
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 0;
          }
          .flex-1 > * {
            position: relative;
            z-index: 1;
          }
        }
      `}</style>
    </div>
  );
}