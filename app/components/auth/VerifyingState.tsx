'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { AuthBackground } from '@/app/components/auth/AuthBackground';

export function VerifyingState() {
  return (
    <AuthBackground showHalos={false}>
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
    </AuthBackground>
  );
}