'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Le lien reçu par email connecte automatiquement une session temporaire
  // et déclenche l'événement PASSWORD_RECOVERY
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Si la session existe déjà au montage (rechargement de page), on autorise aussi
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.push('/'), 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-100 text-slate-500 text-sm px-4 text-center">
        Vérification du lien de réinitialisation... Si rien ne se passe, le lien a peut-être expiré —
        redemande un nouveau lien depuis la page de connexion.
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-lg p-6 border border-slate-200">
        <h1 className="text-xl font-bold text-slate-800 mb-1 text-center">Nouveau mot de passe</h1>
        <p className="text-sm text-slate-500 text-center mb-6">Choisis un nouveau mot de passe</p>

        {success ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-3 rounded-lg text-center">
            Mot de passe mis à jour ! Redirection en cours...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Nouveau mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Confirmer le mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition disabled:opacity-50"
            >
              {loading ? 'Mise à jour...' : 'Valider le nouveau mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}