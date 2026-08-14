'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Écoute l'événement PASSWORD_RECOVERY déclenché par Supabase quand le
 * lien reçu par email est ouvert, et vérifie aussi la session courante
 * au cas où elle serait déjà établie. Laisse une fenêtre de 3s avant de
 * considérer le lien comme invalide/expiré.
 */
export function usePasswordRecovery() {
  const [verifying, setVerifying] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setIsReady(true);
        setVerifying(false);
      }
    });

    let timer: ReturnType<typeof setTimeout> | undefined;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsReady(true);
        setVerifying(false);
      } else {
        timer = setTimeout(() => setVerifying(false), 3000);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { verifying, isReady };
}