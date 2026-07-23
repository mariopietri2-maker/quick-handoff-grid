-- Live customer GPS while an order is active (mirrors driver_locations).
CREATE TABLE IF NOT EXISTS public.customer_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  heading double precision,
  speed double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_locations_updated
  ON public.customer_locations (updated_at DESC);

ALTER TABLE public.customer_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage own location" ON public.customer_locations;
CREATE POLICY "Customers manage own location"
  ON public.customer_locations
  FOR ALL
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Drivers assigned to a customer's active order can see live customer GPS.
DROP POLICY IF EXISTS "Drivers view customer location for active orders" ON public.customer_locations;
CREATE POLICY "Drivers view customer location for active orders"
  ON public.customer_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.customer_id = customer_locations.customer_id
        AND o.driver_id = auth.uid()
        AND o.status NOT IN ('delivered', 'cancelled')
    )
  );

-- Admins / role-m can view for ops.
DROP POLICY IF EXISTS "Admins view customer locations" ON public.customer_locations;
CREATE POLICY "Admins view customer locations"
  ON public.customer_locations
  FOR SELECT
  USING (public.is_m_or_admin(auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'customer_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_locations;
  END IF;
END $$;
