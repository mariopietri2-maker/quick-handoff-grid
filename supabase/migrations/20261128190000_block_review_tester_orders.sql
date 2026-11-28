ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS order_blocked boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET order_blocked = true
WHERE user_id = '04837163-473e-40f3-b334-9be711c991a9'
   OR lower(full_name) = 'review tester';

CREATE OR REPLACE FUNCTION public.block_review_tester_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_blocked boolean := false;
  v_email text;
BEGIN
  SELECT COALESCE(order_blocked, false) INTO v_blocked
  FROM public.profiles
  WHERE user_id = NEW.customer_id;

  SELECT lower(email) INTO v_email
  FROM auth.users
  WHERE id = NEW.customer_id;

  IF COALESCE(v_blocked, false)
     OR NEW.customer_id = '04837163-473e-40f3-b334-9be711c991a9'
     OR COALESCE(v_email, '') = 'play-review@fresh2go.gr' THEN
    RAISE EXCEPTION 'Review tester cannot place orders';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_review_tester_orders ON public.orders;
CREATE TRIGGER trg_block_review_tester_orders
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.block_review_tester_orders();
