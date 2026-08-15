'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Déclenche `onSave` automatiquement après un temps d'inactivité
 * (`delayMs`) suivant toute modification de `nodes`/`edges`, tant que
 * `enabled` est vrai. Ignore le tout premier rendu suivant un changement
 * de `resetKey` (= ouverture/chargement d'un projet), pour ne pas
 * déclencher une sauvegarde juste parce qu'on vient de CHARGER des
 * données depuis la base.
 */
export function useAutoSave({
  enabled,
  nodes,
  edges,
  resetKey,
  onSave,
  delayMs = 4000,
}: {
  enabled: boolean;
  nodes: unknown;
  edges: unknown;
  resetKey: string | null;
  onSave: () => Promise<unknown> | unknown;
  delayMs?: number;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextRef = useRef(true);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);

  // Changement de projet : on ignore le rendu qui suit (chargement, pas une vraie modif)
  useEffect(() => {
    skipNextRef.current = true;
    setLastAutoSavedAt(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [resetKey]);

  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setAutoSaving(true);
      try {
        await onSave();
        setLastAutoSavedAt(new Date());
      } finally {
        setAutoSaving(false);
      }
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, enabled, delayMs]);

  return { lastAutoSavedAt, autoSaving };
}