ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'swychr';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider_session_id text;
CREATE INDEX IF NOT EXISTS orders_provider_session_id_idx ON public.orders (provider_session_id);

ALTER TABLE public.product_prices REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'product_prices'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.product_prices';
  END IF;
END $$;