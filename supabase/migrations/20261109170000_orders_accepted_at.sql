-- Store accept/cancel uses transition_order_status, which writes accepted_at.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
