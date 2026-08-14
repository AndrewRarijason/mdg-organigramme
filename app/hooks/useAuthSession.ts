'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

/**
 * Gère la session d'authentification Supabase : chargement initial,
 * écoute des changements (login/logout/refresh de token), et expose
 * un callback à appeler quand l'état doit être réinitialisé (déconnexion).
 */
export function useAuthSession(onSignedOut: () => void) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
      if (event === 'SIGNED_OUT' || !newSession) {
        onSignedOut();
      }
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { session, authLoading };
}