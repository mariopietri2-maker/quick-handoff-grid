-- Customer support tickets: own queue separate from store/driver.
-- Uses requester_id + requester_role = 'customer' (no dependency on has_role('customer')).

DROP POLICY IF EXISTS "Customers can create tickets" ON public.support_tickets;
CREATE POLICY "Customers can create tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()
    AND requester_role = 'customer'
  );

DROP POLICY IF EXISTS "Customers can view own tickets" ON public.support_tickets;
CREATE POLICY "Customers can view own tickets"
  ON public.support_tickets FOR SELECT
  USING (
    requester_id = auth.uid()
    AND requester_role = 'customer'
  );

DROP POLICY IF EXISTS "Customers can update own tickets" ON public.support_tickets;
CREATE POLICY "Customers can update own tickets"
  ON public.support_tickets FOR UPDATE
  USING (
    requester_id = auth.uid()
    AND requester_role = 'customer'
  );

DROP POLICY IF EXISTS "Customers view own ticket messages" ON public.ticket_messages;
CREATE POLICY "Customers view own ticket messages"
  ON public.ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_messages.ticket_id
        AND t.requester_id = auth.uid()
        AND t.requester_role = 'customer'
    )
  );

DROP POLICY IF EXISTS "Customers post on own tickets" ON public.ticket_messages;
CREATE POLICY "Customers post on own tickets"
  ON public.ticket_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_messages.ticket_id
        AND t.requester_id = auth.uid()
        AND t.requester_role = 'customer'
    )
  );
