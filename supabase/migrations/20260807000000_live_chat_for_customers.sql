-- Live chat split: real-time URGENT channel for drivers AND customers.
-- Async tickets (support_tickets) remain for non-urgent driver/store issues.
-- Extends live_chat_messages (created 20260806000000) with customer channels.

-- Drivers keep their per-driver channel (driver_id); customers get customer_id.
ALTER TABLE public.live_chat_messages
  ALTER COLUMN driver_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_chat_customer
  ON public.live_chat_messages (customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_chat_order
  ON public.live_chat_messages (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_chat_sender
  ON public.live_chat_messages (sender_id, created_at);

-- Customer RLS (driver + support/admin policies already exist).
CREATE POLICY "Customers view own live chat"
  ON public.live_chat_messages FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Customers post on own live chat"
  ON public.live_chat_messages FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    AND sender_id = auth.uid()
    AND sender_role = 'customer'
  );

-- A row must belong to exactly one channel (driver XOR customer).
CREATE OR REPLACE FUNCTION public.validate_live_chat_channel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.driver_id IS NOT NULL) = (NEW.customer_id IS NOT NULL) THEN
    RAISE EXCEPTION 'live_chat_messages must have exactly one of driver_id / customer_id';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_live_chat_channel
  BEFORE INSERT OR UPDATE ON public.live_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_live_chat_channel();

-- One row per participant (driver or customer) with the latest message —
-- feeds the support-console Live Chat tab.
CREATE OR REPLACE VIEW public.live_chat_conversations
WITH (security_invoker = true) AS
SELECT
  COALESCE(v.driver_id, v.customer_id) AS participant_id,
  CASE WHEN v.driver_id IS NOT NULL THEN 'driver' ELSE 'customer' END AS participant_role,
  v.order_id,
  v.created_at AS last_message_at,
  v.message AS last_message,
  v.sender_role AS last_sender_role,
  (SELECT COUNT(*)::int FROM public.live_chat_messages m
    WHERE (m.driver_id = v.driver_id AND m.driver_id IS NOT NULL)
       OR (m.customer_id = v.customer_id AND m.customer_id IS NOT NULL)) AS message_count
FROM (
  SELECT DISTINCT ON (COALESCE(driver_id, customer_id))
    driver_id, customer_id, order_id, message, sender_role, created_at
  FROM public.live_chat_messages
  ORDER BY COALESCE(driver_id, customer_id), created_at DESC
) v
ORDER BY v.created_at DESC;

GRANT SELECT ON public.live_chat_conversations TO authenticated;
