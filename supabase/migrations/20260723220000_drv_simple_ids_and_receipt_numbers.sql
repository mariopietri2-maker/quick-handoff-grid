-- Driver codes: DRV 1, DRV 2, DRV 3 … (simple human IDs)
-- Also harden per-store order numbers 1→9999 with an advisory lock.

CREATE OR REPLACE FUNCTION public.generate_driver_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.driver_code IS NULL OR btrim(NEW.driver_code) = '' THEN
    NEW.driver_code := 'DRV ' || nextval('driver_code_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill existing codes: DRV-0005 → DRV 5 (keep numeric identity).
UPDATE public.driver_profiles
SET driver_code = 'DRV ' || (regexp_replace(driver_code, '\D', '', 'g'))::bigint::text
WHERE driver_code ~* '^DRV[- ]?[0-9]+$'
  AND driver_code IS DISTINCT FROM (
    'DRV ' || (regexp_replace(driver_code, '\D', '', 'g'))::bigint::text
  );

-- Keep sequence ahead of the highest numeric suffix.
SELECT setval(
  'driver_code_seq',
  GREATEST(
    1,
    COALESCE((
      SELECT MAX((regexp_replace(driver_code, '\D', '', 'g'))::bigint)
      FROM public.driver_profiles
      WHERE driver_code ~ '[0-9]'
    ), 1)
  ),
  true
);

-- Align profiles.public_code for drivers with the same simple label when present.
UPDATE public.profiles p
SET public_code = dp.driver_code
FROM public.driver_profiles dp
WHERE dp.user_id = p.user_id
  AND p.role IN ('driver', 'm')
  AND dp.driver_code IS NOT NULL
  AND p.public_code IS DISTINCT FROM dp.driver_code;

-- Safer per-store kitchen numbers (1..9999 wrap) under concurrency.
CREATE OR REPLACE FUNCTION public.assign_store_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_num INTEGER;
BEGIN
  IF NEW.store_order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.store_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize assignment per store for the transaction.
  PERFORM pg_advisory_xact_lock(hashtext('store_order:' || NEW.store_id::text));

  SELECT COALESCE(MAX(store_order_number), 0)
    INTO last_num
  FROM public.orders
  WHERE store_id = NEW.store_id;

  NEW.store_order_number := (last_num % 9999) + 1;
  RETURN NEW;
END;
$$;
