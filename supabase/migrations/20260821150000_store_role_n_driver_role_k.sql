-- Store role 'N' (call-only store) + driver call role 'K'
-- Admin sets:
--   UPDATE stores SET store_role = 'N' WHERE id = '...';
--   UPDATE driver_profiles SET call_role = 'K' WHERE user_id = '...';

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS store_role TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS call_role TEXT NOT NULL DEFAULT 'standard';

CREATE TABLE IF NOT EXISTS public.store_driver_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','closed')),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_driver_calls_open ON public.store_driver_calls (status, created_at DESC);

ALTER TABLE public.store_driver_calls ENABLE ROW LEVEL SECURITY;
-- No direct policies — all access via SECURITY DEFINER RPCs below.

-- 1. N-store owner creates a call (idempotent: returns existing open call)
CREATE OR REPLACE FUNCTION public.create_store_driver_call(p_store_id UUID)
RETURNS TABLE(id UUID, status TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store TEXT;
BEGIN
  -- Verify caller owns the store and it's role 'N'
  SELECT store_role INTO v_store FROM stores WHERE id = p_store_id AND owner_id = auth.uid();
  IF NOT FOUND OR v_store <> 'N' THEN
    RAISE EXCEPTION 'Store not found or not a call store';
  END IF;

  -- Check for existing open call
  RETURN QUERY
  SELECT c.id, c.status, c.created_at
  FROM store_driver_calls c
  WHERE c.store_id = p_store_id AND c.status = 'open'
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO store_driver_calls (store_id, status)
    VALUES (p_store_id, 'open')
    RETURNING id, status, created_at;
  END IF;
END $$;

-- 2. K-driver accepts an open call (atomic, row-locked)
CREATE OR REPLACE FUNCTION public.accept_store_driver_call(p_call_id UUID)
RETURNS TEXT  -- store name
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store_id UUID;
BEGIN
  -- Verify caller is active driver with call_role='K'
  IF NOT EXISTS (
    SELECT 1 FROM driver_profiles dp
    JOIN profiles p ON p.user_id = dp.user_id
    WHERE dp.user_id = auth.uid() AND dp.call_role = 'K' AND p.role = 'driver'
  ) THEN
    RAISE EXCEPTION 'Only call-role K drivers can accept';
  END IF;

  -- Atomically claim the open call
  UPDATE store_driver_calls
  SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now(), updated_at = now()
  WHERE id = p_call_id AND status = 'open'
  RETURNING store_id INTO STRICT v_store_id;

  -- Return store name
  RETURN (SELECT name FROM stores WHERE id = v_store_id);
END $$;

-- 3. Owner closes their call
CREATE OR REPLACE FUNCTION public.close_store_driver_call(p_call_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE store_driver_calls c
  SET status = 'closed', updated_at = now()
  WHERE c.id = p_call_id
    AND EXISTS (
      SELECT 1 FROM stores s WHERE s.id = c.store_id AND s.owner_id = auth.uid()
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found or not yours';
  END IF;
END $$;

-- 4. Owner gets their latest call + driver name if accepted
CREATE OR REPLACE FUNCTION public.my_store_driver_call(p_store_id UUID)
RETURNS TABLE(
  id UUID, status TEXT, created_at TIMESTAMPTZ,
  accepted_by UUID, accepted_at TIMESTAMPTZ, driver_name TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.status, c.created_at, c.accepted_by, c.accepted_at,
         CASE WHEN c.accepted_by IS NOT NULL THEN p.full_name ELSE NULL END
  FROM store_driver_calls c
  LEFT JOIN profiles p ON p.user_id = c.accepted_by
  WHERE c.store_id = p_store_id
    AND EXISTS (SELECT 1 FROM stores s WHERE s.id = p_store_id AND s.owner_id = auth.uid())
  ORDER BY c.created_at DESC
  LIMIT 1;
END $$;

-- 5. K-drivers fetch open calls (minimal: id + store name + created_at)
CREATE OR REPLACE FUNCTION public.fetch_open_store_calls()
RETURNS TABLE(id UUID, store_name TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, s.name, c.created_at
  FROM store_driver_calls c
  JOIN stores s ON s.id = c.store_id
  WHERE c.status = 'open'
  ORDER BY c.created_at ASC;
END $$;