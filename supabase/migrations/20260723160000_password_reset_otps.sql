-- One-time codes for password reset (bypasses Supabase built-in 2/hr email cap).
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_created
  ON public.password_reset_otps (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user_open
  ON public.password_reset_otps (user_id)
  WHERE consumed_at IS NULL;

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- No direct client access — only service role / edge functions.
DROP POLICY IF EXISTS "No direct access password_reset_otps" ON public.password_reset_otps;
CREATE POLICY "No direct access password_reset_otps"
  ON public.password_reset_otps
  FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.password_reset_otps FROM anon, authenticated;
GRANT ALL ON public.password_reset_otps TO service_role;
