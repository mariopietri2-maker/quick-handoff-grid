-- Separate live-chat channel per driver, distinct from email-style support tickets.
-- One implicit channel per driver (all messages keyed by driver_id).

CREATE TABLE public.live_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_chat_driver ON public.live_chat_messages(driver_id, created_at);

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own live chat"
ON public.live_chat_messages FOR SELECT
USING (driver_id = auth.uid());

CREATE POLICY "Drivers post on own live chat"
ON public.live_chat_messages FOR INSERT
WITH CHECK (
  driver_id = auth.uid() AND
  sender_id = auth.uid() AND
  sender_role = 'driver'
);

CREATE POLICY "Support and admins view all live chat"
ON public.live_chat_messages FOR SELECT
USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Support and admins post live chat"
ON public.live_chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
ALTER TABLE public.live_chat_messages REPLICA IDENTITY FULL;
