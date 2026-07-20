-- Improve auto-dispatch defaults and allow service-role / SQL to flip driver is_active.

UPDATE public.platform_settings
SET dist_offer_timeout_seconds = GREATEST(COALESCE(dist_offer_timeout_seconds, 30), 60)
WHERE id = 1 AND COALESCE(dist_offer_timeout_seconds, 0) < 60;

CREATE OR REPLACE FUNCTION public.protect_driver_active_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    -- Allow when no JWT (service role / SQL) or caller is admin
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Μόνο οι διαχειριστές μπορούν να ενεργοποιήσουν/απενεργοποιήσουν οδηγούς';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
