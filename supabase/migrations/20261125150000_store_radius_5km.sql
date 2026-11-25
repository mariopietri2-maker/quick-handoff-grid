-- Every store delivers at most 5 km from its location.
CREATE OR REPLACE FUNCTION public.enforce_store_radius_5km()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.fulfilment, 'delivery') = 'delivery'
     AND NEW.distance_km IS NOT NULL
     AND NEW.distance_km > 5 THEN
    RAISE EXCEPTION 'Η διεύθυνση είναι πάνω από 5 km από το κατάστημα';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_radius_5km ON public.orders;
CREATE TRIGGER orders_radius_5km
  BEFORE INSERT OR UPDATE OF distance_km, fulfilment ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_store_radius_5km();
