ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text;

UPDATE public.orders
SET payment_status = CASE
  WHEN payment_method IN ('card', 'stripe', 'viva') AND status <> 'pending' THEN 'paid'
  WHEN payment_method IN ('card', 'stripe', 'viva') AND status = 'pending' THEN 'unpaid'
  WHEN payment_method = 'cash' THEN 'cash'
  ELSE COALESCE(payment_status, 'unpaid')
END
WHERE payment_status IS NULL;
