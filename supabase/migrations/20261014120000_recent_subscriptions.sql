-- Ventes récentes réelles, lisibles publiquement sans exposer de données personnelles :
-- seulement l'initiale du prénom, le pays, la formule et la date.
CREATE OR REPLACE FUNCTION public.recent_subscriptions(_limit integer DEFAULT 10)
RETURNS TABLE(first_initial text, country_code text, tier text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT left(split_part(trim(o.customer_name), ' ', 1), 1) AS first_initial,
         o.country_code,
         o.tier,
         o.created_at
  FROM public.orders o
  WHERE lower(o.status) IN ('paid','success','successful','succeeded','completed','complete','settled')
    AND o.created_at > now() - interval '30 days'
  ORDER BY o.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 20);
$$;
REVOKE EXECUTE ON FUNCTION public.recent_subscriptions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recent_subscriptions(integer) TO anon, authenticated, service_role;
