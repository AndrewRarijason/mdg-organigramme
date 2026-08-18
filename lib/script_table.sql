-- ============================================================
-- SCRIPT COMPLET - Organigramme (tables + RLS + storage)
-- ============================================================

-- 1. Table des Projets
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL DEFAULT 'Mon Organigramme',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table des Personnes / Nœuds de l'organigramme
CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Informations personnelles
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  job_title VARCHAR(150),
  photo_url TEXT,

  -- Hiérarchie (NULL pour le responsable tout en haut)
  parent_id UUID REFERENCES nodes(id) ON DELETE SET NULL,

  -- Coordonnées visuelles sur le canvas
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,

  width FLOAT DEFAULT 180,
  height FLOAT DEFAULT 150
);

-- Index pour accélérer la recherche des cartes d'un projet
CREATE INDEX idx_nodes_project ON nodes(project_id);


-- ============================================================
-- RLS - Table "projects"
-- ============================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public select projects" ON projects FOR SELECT TO public USING (true);
CREATE POLICY "Public insert projects" ON projects FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public update projects" ON projects FOR UPDATE TO public USING (true);
CREATE POLICY "Public delete projects" ON projects FOR DELETE TO public USING (true);


-- ============================================================
-- RLS - Table "nodes"
-- ============================================================
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public select nodes" ON nodes FOR SELECT TO public USING (true);
CREATE POLICY "Public insert nodes" ON nodes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public update nodes" ON nodes FOR UPDATE TO public USING (true);
CREATE POLICY "Public delete nodes" ON nodes FOR DELETE TO public USING (true);


-- ============================================================
-- Storage - Bucket "photos_employes"
-- ============================================================

-- Autoriser tout le monde à ajouter (INSERT) des fichiers dans "photos_employes"
CREATE POLICY "Accès public aux dépôts d'images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'photos_employes');

-- Autoriser également la lecture publique des fichiers
CREATE POLICY "Lecture publique des images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos_employes');



---------------------





-- ============================================================
-- MIGRATION - Authentification (Supabase Auth) + rattachement
-- des projets à un utilisateur
-- ============================================================

-- 1. Lier chaque projet à un utilisateur (auth.users est géré par Supabase Auth)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- 2. Supprimer les anciennes policies "publiques" (trop permissives)
DROP POLICY IF EXISTS "Public select projects" ON projects;
DROP POLICY IF EXISTS "Public insert projects" ON projects;
DROP POLICY IF EXISTS "Public update projects" ON projects;
DROP POLICY IF EXISTS "Public delete projects" ON projects;

DROP POLICY IF EXISTS "Public select nodes" ON nodes;
DROP POLICY IF EXISTS "Public insert nodes" ON nodes;
DROP POLICY IF EXISTS "Public update nodes" ON nodes;
DROP POLICY IF EXISTS "Public delete nodes" ON nodes;

-- 3. Nouvelles policies "projects" : uniquement le propriétaire (utilisateur connecté)
CREATE POLICY "Owner select projects" ON projects
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owner insert projects" ON projects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner update projects" ON projects
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owner delete projects" ON projects
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Nouvelles policies "nodes" : accès si le projet parent appartient à l'utilisateur
CREATE POLICY "Owner select nodes" ON nodes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = nodes.project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Owner insert nodes" ON nodes
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = nodes.project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Owner update nodes" ON nodes
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = nodes.project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Owner delete nodes" ON nodes
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = nodes.project_id AND p.user_id = auth.uid())
  );

-- 5. (Optionnel mais recommandé) restreindre aussi le bucket photos_employes
--    aux utilisateurs connectés au lieu de "public"
DROP POLICY IF EXISTS "Accès public aux dépôts d'images" ON storage.objects;
DROP POLICY IF EXISTS "Lecture publique des images" ON storage.objects;

CREATE POLICY "Utilisateurs connectés uploadent des images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'photos_employes');

CREATE POLICY "Utilisateurs connectés lisent les images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'photos_employes');

-- ============================================================
-- NOTE : "nom d'utilisateur" via Supabase Auth
-- ============================================================
-- Supabase Auth s'appuie sur l'email (ou le téléphone) comme identifiant,
-- pas sur un "username" libre. Le mot de passe est hashé et géré en
-- interne (bcrypt) — inutile de gérer ça à la main.
-- Si tu veux un vrai "nom d'utilisateur" affiché en plus de l'email,
-- décommente ci-dessous :

-- CREATE TABLE profiles (
--   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   username VARCHAR(50) UNIQUE NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Owner select profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
-- CREATE POLICY "Owner update profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
-- CREATE POLICY "Owner insert profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);







-------------------

-- ============================================================
-- MIGRATION - Forcer le domaine email côté Supabase Auth
-- Domaine autorisé: @madagascar-services.com
-- ============================================================

-- 1) Fonction commune de validation du domaine
create or replace function public.assert_mdg_email_domain(p_email text)
returns void
language plpgsql
as $$
begin
  if p_email is null
     or lower(trim(p_email)) not like '%@madagascar-services.com' then
    raise exception
      using message = 'L''adresse email doit se terminer par "@madagascar-services.com".';
  end if;
end;
$$;

-- 2) Bloquer la création d'utilisateurs auth.users hors domaine
create or replace function public.enforce_mdg_domain_on_auth_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_mdg_email_domain(new.email);
  return new;
end;
$$;

drop trigger if exists trg_enforce_mdg_domain_on_auth_user_insert on auth.users;
create trigger trg_enforce_mdg_domain_on_auth_user_insert
before insert on auth.users
for each row
execute function public.enforce_mdg_domain_on_auth_user_insert();

-- 3) Bloquer le changement d'email vers un domaine interdit
create or replace function public.enforce_mdg_domain_on_auth_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_mdg_email_domain(new.email);
  return new;
end;
$$;

drop trigger if exists trg_enforce_mdg_domain_on_auth_user_email_update on auth.users;
create trigger trg_enforce_mdg_domain_on_auth_user_email_update
before update of email on auth.users
for each row
execute function public.enforce_mdg_domain_on_auth_user_email_update();

-- 4) Bloquer le changement de mot de passe pour les comptes hors domaine
-- (utile si des comptes non conformes existent déjà)
create or replace function public.enforce_mdg_domain_on_password_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_mdg_email_domain(coalesce(new.email, old.email));
  return new;
end;
$$;

drop trigger if exists trg_enforce_mdg_domain_on_password_update on auth.users;
create trigger trg_enforce_mdg_domain_on_password_update
before update of encrypted_password on auth.users
for each row
execute function public.enforce_mdg_domain_on_password_update();



------ 16/08 ------

-- 1. Supprimer l'ancienne contrainte mono-parentale
ALTER TABLE nodes DROP COLUMN IF EXISTS parent_id;

-- 2. Créer une table dédiée aux liaisons (multi-mères et multi-enfants)
CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE, -- Le supérieur
  target_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE, -- L'enfant
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_edge UNIQUE (source_id, target_id)
);

CREATE INDEX idx_edges_project ON edges(project_id);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);

-- RLS
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner select edges" ON edges FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = edges.project_id AND p.user_id = auth.uid()));

CREATE POLICY "Owner insert edges" ON edges FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = edges.project_id AND p.user_id = auth.uid()));

CREATE POLICY "Owner delete edges" ON edges FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = edges.project_id AND p.user_id = auth.uid()));





  ------ 17/08----
  CREATE TABLE pdf_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE pdf_exports ENABLE ROW LEVEL SECURITY;
-- Aucune policy publique : seule la clé service_role (utilisée uniquement
-- côté serveur, jamais exposée au client) peut lire/écrire cette table.



------- 18/08 ------
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER;