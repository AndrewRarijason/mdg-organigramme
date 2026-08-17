/**
 * Cache mémoire à usage unique pour transmettre les données de
 * l'organigramme (nodes/edges/titre) entre la route d'export PDF et la
 * page /print/[exportId] ouverte par Puppeteer.
 *
 * ATTENTION : ce cache est en mémoire locale au process. Si votre app
 * tourne sur plusieurs instances serverless, remplacez-le par Redis ou
 * une table Supabase avec expiration (ex: `pdf_export_cache`).
 */

type ExportPayload = {
  nodes: unknown[];
  edges: unknown[];
  title: string;
  createdAt: number;
};

const CACHE_TTL_MS = 60_000;
const store = new Map<string, ExportPayload>();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now - value.createdAt > CACHE_TTL_MS) store.delete(key);
  }
}

export function createExportEntry(nodes: unknown[], edges: unknown[], title: string): string {
  cleanupExpired();
  const id = crypto.randomUUID();
  store.set(id, { nodes, edges, title, createdAt: Date.now() });
  return id;
}

/**
 * Lecture NON destructive : la page /print peut être invoquée plusieurs
 * fois pour le même exportId (double-exécution du useEffect en Strict
 * Mode côté dev, éventuel rechargement réseau de Puppeteer, etc.).
 * L'entrée expire de toute façon via le TTL, et l'id est un UUID aléatoire
 * à durée de vie très courte : la supprimer dès la première lecture
 * n'apporte rien en sécurité et casse les doubles-appels légitimes.
 */
export function readExportEntry(id: string): ExportPayload | null {
  cleanupExpired();
  return store.get(id) ?? null;
}

/** Suppression explicite, appelée côté serveur une fois la capture Puppeteer terminée. */
export function deleteExportEntry(id: string): void {
  store.delete(id);
}