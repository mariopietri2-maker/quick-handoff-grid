-- Store calls review fixes:
-- 1) Drivers with call_role='both' receive pushes and see the call sheet,
--    so they must be allowed to accept (previously K-only -> error on tap).
-- 2) Unify open-call lifetime to 15 minutes to match the store UI countdown
--    (was 3 minutes in DB vs 15 minutes promised in the app).

-- 1) 'both' drivers can accept store calls (atomic, row-locked)
CREATE OR REPLACE FUNCTION public.accept_store_driver_call(p_call_id UUID)
RETURNS TEXT  -- store name
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store_id UUID;
BEGIN
  -- Verify caller is active driver with a call role (K or both)
  IF NOT EXISTS (
    SELECT 1 FROM driver_profiles dp
    JOIN profiles p ON p.user_id = dp.user_id
    WHERE dp.user_id = auth.uid() AND dp.call_role IN ('K', 'both') AND p.role = 'driver'
  ) THEN
    RAISE EXCEPTION 'Only call drivers (K) can accept';
  END IF;

  -- Atomically claim the open call
  UPDATE store_driver_calls
  SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now(), updated_at = now()
  WHERE id = p_call_id AND status = 'open'
  RETURNING store_id INTO STRICT v_store_id;

  -- Return store name
  RETURN (SELECT name FROM stores WHERE id = v_store_id);
END $$;

-- 2) Auto-expire open calls after 15 minutes (matches store UI countdown).
-- An ignored call must never trap the driver UI or block the store from re-calling.
-- create_store_driver_call returns any existing 'open' call, so expiry unblocks both sides.

SELECT cron.unschedule('store-call-expiry')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'store-call-expiry');

SELECT cron.schedule(
  'store-call-expiry',
  '30 seconds',
  $$
  UPDATE public.store_driver_calls
     SET status = 'closed'
   WHERE status = 'open'
     AND created_at < now() - interval '15 minutes'
  $$
);
