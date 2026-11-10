-- Normal customers and guests must be able to browse active stores.
-- stores_public is security_invoker, so it needs a public SELECT policy.
DROP POLICY IF EXISTS "Anyone can view active stores" ON public.stores;
CREATE POLICY "Anyone can view active stores"
  ON public.stores
  FOR SELECT
  TO anon, authenticated
  USING (COALESCE(is_active, true) AND suspended_at IS NULL);
