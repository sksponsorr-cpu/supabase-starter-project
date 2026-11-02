-- Plateforme vendeur : boutique guidée, stock, commandes avec livraison et suivi en temps réel.

-- 1. Boutique : catégorie et pays
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '' CHECK (char_length(category) <= 80);
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '' CHECK (char_length(country) <= 80);

-- 2. Produits : stock et disponibilité
ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0);
ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3. Commandes (le code les utilisait déjà, mais aucune migration ne les créait)
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.shop_products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  unit_price text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  customer_address text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'livraison';
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'nouvelle';
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS tracking_code text NOT NULL DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 8));
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_status_check
    CHECK (status IN ('nouvelle', 'confirmée', 'en livraison', 'livrée', 'annulée'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_delivery_check
    CHECK (delivery_method IN ('livraison', 'retrait'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS shop_orders_tracking_code_key ON public.shop_orders (tracking_code);
CREATE INDEX IF NOT EXISTS shop_orders_user_idx ON public.shop_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_customer_idx ON public.shop_orders (customer_id, created_at DESC);

-- 4. Historique de suivi : chaque changement de statut ou note du vendeur
CREATE TABLE IF NOT EXISTS public.shop_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_order_events_order_idx ON public.shop_order_events (order_id, created_at);

-- 5. Sécurité : un vendeur voit ses commandes, un client voit les siennes
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.shop_orders TO authenticated;
GRANT SELECT ON public.shop_order_events TO authenticated;
GRANT ALL ON public.shop_orders TO service_role;
GRANT ALL ON public.shop_order_events TO service_role;

DROP POLICY IF EXISTS "Seller reads own orders" ON public.shop_orders;
CREATE POLICY "Seller reads own orders" ON public.shop_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Seller updates own orders" ON public.shop_orders;
CREATE POLICY "Seller updates own orders" ON public.shop_orders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customer reads own orders" ON public.shop_orders;
CREATE POLICY "Customer reads own orders" ON public.shop_orders
  FOR SELECT TO authenticated USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Order parties read events" ON public.shop_order_events;
CREATE POLICY "Order parties read events" ON public.shop_order_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.shop_orders o
      WHERE o.id = order_id AND (o.user_id = auth.uid() OR o.customer_id = auth.uid())
    )
  );

-- 6. Temps réel : le vendeur voit les nouvelles commandes, le client suit sa livraison
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_order_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Passer une commande : vérifie le stock et le décrémente dans la même transaction
CREATE OR REPLACE FUNCTION public.place_shop_order(
  p_shop_user uuid,
  p_product uuid,
  p_quantity integer,
  p_customer uuid,
  p_name text,
  p_phone text,
  p_address text,
  p_delivery text
) RETURNS public.shop_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prod public.shop_products;
  ord public.shop_orders;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN RAISE EXCEPTION 'quantite_invalide'; END IF;

  SELECT * INTO prod FROM public.shop_products
    WHERE id = p_product AND user_id = p_shop_user AND is_active
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'article_introuvable'; END IF;
  IF prod.stock < p_quantity THEN RAISE EXCEPTION 'stock_insuffisant'; END IF;

  UPDATE public.shop_products SET stock = stock - p_quantity, updated_at = now() WHERE id = p_product;

  INSERT INTO public.shop_orders (
    user_id, product_id, product_name, unit_price, quantity,
    customer_id, customer_name, customer_phone, customer_address, delivery_method
  ) VALUES (
    p_shop_user, p_product, prod.name, prod.price, p_quantity,
    p_customer, p_name, p_phone, p_address, p_delivery
  ) RETURNING * INTO ord;

  INSERT INTO public.shop_order_events (order_id, status, note)
    VALUES (ord.id, 'nouvelle', 'Commande reçue');

  RETURN ord;
END $$;

-- 8. Changer le statut : annuler rend le stock, réactiver le reprend
CREATE OR REPLACE FUNCTION public.update_shop_order_status(
  p_seller uuid,
  p_order uuid,
  p_status text,
  p_note text DEFAULT ''
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.shop_orders;
BEGIN
  IF p_status NOT IN ('nouvelle', 'confirmée', 'en livraison', 'livrée', 'annulée') THEN
    RAISE EXCEPTION 'statut_invalide';
  END IF;

  SELECT * INTO o FROM public.shop_orders WHERE id = p_order AND user_id = p_seller FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'commande_introuvable'; END IF;

  IF o.status = p_status THEN
    IF COALESCE(p_note, '') <> '' THEN
      INSERT INTO public.shop_order_events (order_id, status, note) VALUES (p_order, p_status, p_note);
    END IF;
    RETURN true;
  END IF;

  IF p_status = 'annulée' AND o.product_id IS NOT NULL THEN
    UPDATE public.shop_products SET stock = stock + o.quantity WHERE id = o.product_id;
  END IF;

  IF o.status = 'annulée' AND p_status <> 'annulée' AND o.product_id IS NOT NULL THEN
    UPDATE public.shop_products SET stock = stock - o.quantity WHERE id = o.product_id AND stock >= o.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'stock_insuffisant'; END IF;
  END IF;

  UPDATE public.shop_orders SET status = p_status, updated_at = now() WHERE id = p_order;
  INSERT INTO public.shop_order_events (order_id, status, note) VALUES (p_order, p_status, COALESCE(p_note, ''));
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.place_shop_order(uuid, uuid, integer, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_shop_order_status(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_shop_order(uuid, uuid, integer, uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_shop_order_status(uuid, uuid, text, text) TO service_role;
