-- Ajout de la colonne role sur la table profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' NOT NULL;
