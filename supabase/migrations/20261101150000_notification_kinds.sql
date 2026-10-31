-- Catégories de notifications : nouveautés, offres, modèles, abonnements, etc.
ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_kind_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_kind_check
  CHECK (kind IN ('info', 'nouveaute', 'offre', 'modele', 'abonnement', 'maintenance', 'payment_reminder', 'payment_action'));
