-- Boutique du vendeur et ses produits. Un vendeur ne voit et ne modifie que ses propres lignes.
CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 800),
  logo_url text,
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 40),
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Le prix est du texte : les devises varient (FC, XOF, USD…) et les formats aussi.
CREATE TABLE IF NOT EXISTS public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  price text NOT NULL DEFAULT '' CHECK (char_length(price) <= 60),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 800),
  category text NOT NULL DEFAULT '' CHECK (char_length(category) <= 80),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_products_user_idx ON public.shop_products (user_id, created_at DESC);

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_products TO authenticated;
GRANT ALL ON public.shops TO service_role;
GRANT ALL ON public.shop_products TO service_role;

CREATE POLICY "Owners manage own shop" ON public.shops
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners manage own products" ON public.shop_products
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
