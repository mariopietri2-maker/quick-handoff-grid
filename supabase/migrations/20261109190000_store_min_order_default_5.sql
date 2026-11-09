
ALTER TABLE public.stores
  ALTER COLUMN min_order_amount SET DEFAULT 5;
UPDATE public.stores
  SET min_order_amount = 5
  WHERE min_order_amount IS NULL OR min_order_amount = 0;
