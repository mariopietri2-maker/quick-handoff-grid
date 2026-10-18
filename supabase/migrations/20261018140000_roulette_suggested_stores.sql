-- Admin-curated stores suggested after a roulette win (show 5–6).
CREATE TABLE IF NOT EXISTS public.roulette_suggested_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id)
);

CREATE INDEX IF NOT EXISTS idx_roulette_suggested_active
  ON public.roulette_suggested_stores (is_active, sort_order);

ALTER TABLE public.roulette_suggested_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active roulette suggestions" ON public.roulette_suggested_stores;
CREATE POLICY "Public read active roulette suggestions"
  ON public.roulette_suggested_stores FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage roulette suggestions" ON public.roulette_suggested_stores;
CREATE POLICY "Admins manage roulette suggestions"
  ON public.roulette_suggested_stores FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.list_roulette_suggested_stores(p_limit int DEFAULT 6)
RETURNS TABLE (
  store_id uuid,
  name text,
  logo_url text,
  image_url text,
  is_active boolean,
  sort_order int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id AS store_id,
    s.name,
    COALESCE(s.image_url, s.cover_image_url) AS logo_url,
    s.image_url,
    COALESCE(s.is_active, true) AS is_active,
    r.sort_order
  FROM public.roulette_suggested_stores r
  JOIN public.stores s ON s.id = r.store_id
  WHERE r.is_active = true
  ORDER BY r.sort_order ASC, s.name ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 6), 12));
$$;

REVOKE ALL ON FUNCTION public.list_roulette_suggested_stores(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_roulette_suggested_stores(int) TO anon, authenticated;
