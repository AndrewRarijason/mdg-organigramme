'use client';

import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useChangePassword() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const changePassword = useCallback(async (newPassword: string, confirmPassword?: string) => {
    setError(null);
    setSuccess(false);

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return false;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccess(true);
      return true;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du mot de passe.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return { loading, error, success, changePassword, reset };
}