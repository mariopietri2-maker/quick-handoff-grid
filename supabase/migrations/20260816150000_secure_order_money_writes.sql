-- =============================================================================
-- Block client-side order amount tampering.
-- -----------------------------------------------------------------------------
-- place_order (SECURITY DEFINER) is the ONLY sanctioned way to create orders: it
-- recomputes every amount server-side from menu_items.price / platform_settings,
-- ignores the client-supplied delivery fee, and applies promos atomically.
-- create-checkout then reads those stored amounts and payments-webhook validates
-- the charge against them — so any path that lets a client WRITE them directly
-- is a money bypass.
--
-- The legacy INSERT policies below (from 20260403013350, before place_order
-- existed) let any authenticated user INSERT an orders row with arbitrary
-- total_amount / delivery_fee / tip_amount plus order_items rows with arbitrary
-- unit_price via PostgREST. create-checkout would then charge the tampered
-- amounts (webhook compares against expected_charge_cents derived from them).
--
-- No client flow uses these INSERT paths: the app calls place_order /
-- create_external_order / api_ingest_external_order, all SECURITY DEFINER, which
-- bypass RLS and run with the table owner's privileges — unaffected by the
-- revokes below.
-- =============================================================================

-- [1] Drop the legacy INSERT policies (never used since place_order took over)
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can insert order items" ON public.order_items;

-- [2] Defense-in-depth: revoke INSERT from client roles (anon + authenticated).
--    service_role / table owner are untouched.
REVOKE INSERT ON public.orders FROM anon, authenticated;
REVOKE INSERT ON public.order_items FROM anon, authenticated;

-- [3] Guard: the sanctioned server-side writers must still exist, and no
--    INSERT policy may remain on the money tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'place_order'
  ) THEN
    RAISE EXCEPTION 'place_order missing — INSERT revocation is unsafe';
  END IF;
END $$;

SELECT
  c.relname,
  count(*) FILTER (WHERE p.polcmd IN ('a', '*')) AS insert_policies_left
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('orders', 'order_items')
GROUP BY c.relname
ORDER BY c.relname;
