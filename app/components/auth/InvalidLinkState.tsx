'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AuthBackground } from '@/app/components/auth/AuthBackground';

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, type: 'tween', ease: 'easeOut' } },
};

export function InvalidLinkState() {
  const router = useRouter();

  return (
    <AuthBackground>
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20 text-center"
      >
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 text-red-600 mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Lien invalide ou expiré</h1>
        <p className="text-sm text-slate-500 mb-6">
          Le lien de réinitialisation a expiré ou a déjà été utilisé. Veuillez refaire une demande depuis la
          page de connexion.
        </p>
        <button
          onClick={() => router.push('/')}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-500/25 transition duration-200 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la connexion</span>
        </button>
      </motion.div>
    </AuthBackground>
  );
}