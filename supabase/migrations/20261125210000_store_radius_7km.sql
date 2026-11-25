-- Raise store delivery radius from 5 km to 7 km.
CREATE OR REPLACE FUNCTION public.enforce_store_radius_5km()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.fulfilment, 'delivery') = 'delivery'
     AND NEW.distance_km IS NOT NULL
     AND NEW.distance_km > 7 THEN
    RAISE EXCEPTION 'Η διεύθυνση είναι πάνω από 7 km από το κατάστημα';
  END IF;
  RETURN NEW;
END;
$$;
