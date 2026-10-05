import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * Maintient le projet Supabase actif.
 *
 * Sur le plan gratuit, Supabase met le projet en pause après 7 jours sans
 * requête sur la base de données. Une tâche planifiée Vercel (voir
 * vercel.json) appelle cette route une fois par jour : elle exécute une
 * simple LECTURE (aucune donnée n'est modifiée), ce qui compte comme de
 * l'activité.
 *
 * Protégée par la variable CRON_SECRET : Vercel l'envoie automatiquement
 * dans l'en-tête `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { error } = await supabaseAdmin.from('projects').select('id').limit(1);

  if (error) {
    console.error('[keep-alive] échec de la requête Supabase :', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, checkedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
