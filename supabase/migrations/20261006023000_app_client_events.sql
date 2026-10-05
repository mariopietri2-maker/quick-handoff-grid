
-- Lightweight client analytics (free-tier friendly; no PII required)
CREATE TABLE IF NOT EXISTS public.app_client_events (
  id bigserial PRIMARY KEY,
  app text NOT NULL DEFAULT 'customer',
  event text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_client_events_created_idx ON public.app_client_events (created_at DESC);
CREATE INDEX IF NOT EXISTS app_client_events_event_idx ON public.app_client_events (event);

ALTER TABLE public.app_client_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth insert client events" ON public.app_client_events;
CREATE POLICY "auth insert client events"
ON public.app_client_events FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "admin read client events" ON public.app_client_events;
CREATE POLICY "admin read client events"
ON public.app_client_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'support')
  )
);

GRANT INSERT ON public.app_client_events TO authenticated;
GRANT SELECT ON public.app_client_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.app_client_events_id_seq TO authenticated;
