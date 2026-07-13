/*
  Fix: Drivers without driver_profiles rows are invisible to dispatch.

  Root cause: When a user is assigned the 'driver' role via user_roles, no
  driver_profiles row is created automatically. The nearby_active_drivers RPC
  joins on driver_profiles, so these drivers receive no offers and cannot be
  dispatched.

  Fix:
  1. Trigger: auto-create a driver_profiles stub when a user_roles row with
     role='driver' is inserted, so new drivers are immediately visible to dispatch
     (pending admin approval via is_active flag).
  2. Backfill: create profiles for any existing driver-role users who are missing
     a row, and mark them active if they have delivered orders.
*/

CREATE OR REPLACE FUNCTION public.auto_create_driver_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role <> 'driver' THEN RETURN NEW; END IF;

  INSERT INTO public.driver_profiles (user_id, is_active)
  VALUES (NEW.user_id, false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_driver_profile ON public.user_roles;
CREATE TRIGGER trg_auto_create_driver_profile
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_driver_profile();

-- Backfill: create profiles for existing driver-role users who have none,
-- and activate them if they have at least one delivered order.
INSERT INTO public.driver_profiles (user_id, is_active)
SELECT
  ur.user_id,
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.driver_id = ur.user_id AND o.status = 'delivered'
  ) AS is_active
FROM public.user_roles ur
WHERE ur.role = 'driver'
  AND NOT EXISTS (
    SELECT 1 FROM public.driver_profiles dp WHERE dp.user_id = ur.user_id
  )
ON CONFLICT (user_id) DO NOTHING;
