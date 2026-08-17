import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

/**
 * Cache de transmission des données de l'organigramme (nodes/edges/titre)
 * entre la route d'export PDF et la page /print/[exportId] ouverte par
 * Puppeteer.
 *
 * Stocké dans Supabase (table `pdf_exports`, RLS activé sans policy
 * publique — seule la clé service_role y accède) plutôt qu'en mémoire :
 * sur Vercel, chaque requête peut atterrir sur une instance serverless
 * différente, donc un simple Map() en mémoire ne serait pas partagé
 * entre l'écriture (POST /api/export-pdf) et la lecture (GET
 * /api/export-cache/[exportId] appelé par la page /print).
 */

type ExportPayload = {
  nodes: unknown[];
  edges: unknown[];
  title: string;
};

/** Purge les entrées de plus de 5 minutes, au cas où un export aurait échoué avant sa suppression explicite. */
async function cleanupExpired() {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  await supabaseAdmin.from('pdf_exports').delete().lt('created_at', cutoff);
}

export async function createExportEntry(nodes: unknown[], edges: unknown[], title: string): Promise<string> {
  await cleanupExpired();

  const { data, error } = await supabaseAdmin
    .from('pdf_exports')
    .insert({ payload: { nodes, edges, title } })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error("Impossible de préparer l'export : " + (error?.message || 'erreur inconnue'));
  }

  return data.id as string;
}

/** Lecture NON destructive : la page /print peut être invoquée plusieurs fois pour le même exportId. */
export async function readExportEntry(id: string): Promise<ExportPayload | null> {
  const { data } = await supabaseAdmin.from('pdf_exports').select('payload').eq('id', id).single();
  return (data?.payload as ExportPayload) ?? null;
}

/** Suppression explicite, appelée côté serveur une fois la capture Puppeteer terminée. */
export async function deleteExportEntry(id: string): Promise<void> {
  await supabaseAdmin.from('pdf_exports').delete().eq('id', id);
}