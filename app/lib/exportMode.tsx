'use client';

import React, { createContext, useContext } from 'react';

/**
 * Permet à n'importe quel composant descendant (notamment PersonNode) de
 * savoir si un export PDF est en cours, pour adapter son rendu (ex: cacher
 * les points de connexion inutilisés) SANS changer le rendu du canevas
 * interactif normal.
 */
const ExportModeContext = createContext(false);

export function ExportModeProvider({
  exporting,
  children,
}: {
  exporting: boolean;
  children: React.ReactNode;
}) {
  return <ExportModeContext.Provider value={exporting}>{children}</ExportModeContext.Provider>;
}

export function useExportMode() {
  return useContext(ExportModeContext);
}