-- App error log: driver & customer native apps report technical errors here
-- instead of showing them on screen. Admins review & resolve them in the panel.
CREATE TABLE IF NOT EXISTS public.app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app text NOT NULL CHECK (app IN ('driver', 'customer', 'web')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text
);

CREATE INDEX IF NOT EXISTS idx_app_errors_created_at ON public.app_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_resolved ON public.app_errors (resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

-- Apps insert their own logged errors (user_id = session user).
CREATE POLICY "Users can log app errors"
  ON public.app_errors FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Pre-login failures (e.g. login screen network errors) have no session user yet.
CREATE POLICY "Anon can log anonymous app errors"
  ON public.app_errors FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- Only admins read and resolve errors.
CREATE POLICY "Admins view app errors"
  ON public.app_errors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins resolve app errors"
  ON public.app_errors FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, SELECT ON public.app_errors TO authenticated;
GRANT INSERT ON public.app_errors TO anon;
