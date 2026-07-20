-- Allow store role (and admins) to insert stores they own.
-- Previous P0 checkup made INSERT admin-only, which broke the merchant portal.

DROP POLICY IF EXISTS "Owners can insert their store" ON public.stores;
DROP POLICY IF EXISTS "Admins can insert stores" ON public.stores;
DROP POLICY IF EXISTS "Store owners and admins can insert stores" ON public.stores;

CREATE POLICY "Store owners and admins can insert stores"
  ON public.stores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'store'::public.app_role)
    )
  );
