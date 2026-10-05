'use client';

import React from 'react';

/**
 * Fond image + overlay sombre + halos lumineux, utilisé sur toutes les
 * pages liées à l'authentification (reset password, et potentiellement
 * login/signup plus tard). `children` est rendu par-dessus, centré.
 */
export function AuthBackground({
  children,
  showHalos = true,
}: {
  children: React.ReactNode;
  showHalos?: boolean;
}) {
  return (
    <div className="relative min-h-dvh w-full py-6 flex items-center justify-center bg-slate-900 overflow-hidden px-4">
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hierarchie.jpg')" }}
      >
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs" />
        {showHalos && (
          <>
            <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl animate-pulse delay-1000" />
          </>
        )}
      </div>
      {children}
    </div>
  );
}