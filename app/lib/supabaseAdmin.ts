import { createClient } from '@supabase/supabase-js';

// ATTENTION : utilise la clé service_role, qui contourne RLS. Ne JAMAIS
// importer ce fichier depuis un composant client ('use client') ou
// exposer NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY au navigateur.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);