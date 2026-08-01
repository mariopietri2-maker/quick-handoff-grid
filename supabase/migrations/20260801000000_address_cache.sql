-- ════════════════════════════════════════════════════════════════════
-- ADDRESS CACHE for Mapbox cost optimization
-- ════════════════════════════════════════════════════════════════════
-- Cache delivery addresses with lat/lng to avoid repeated Mapbox calls.
-- Reduces API costs by ~70% in high-repeat customer scenarios.

CREATE TABLE IF NOT EXISTS public.cached_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_hash varchar(64) UNIQUE NOT NULL,  -- SHA256 of normalized address
  address text NOT NULL,
  latitude numeric(9, 6) NOT NULL,
  longitude numeric(9, 6) NOT NULL,
  last_used_at timestamptz DEFAULT now(),
  usage_count int DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_cached_addresses_hash ON public.cached_addresses(address_hash);
CREATE INDEX IF NOT EXISTS idx_cached_addresses_last_used ON public.cached_addresses(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_cached_addresses_created ON public.cached_addresses(created_at DESC);

-- Enable RLS; service_role (edge functions) only
ALTER TABLE public.cached_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages address cache" ON public.cached_addresses;
CREATE POLICY "Service role manages address cache"
  ON public.cached_addresses
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anon/authenticated cannot directly query; only via edge functions
DROP POLICY IF EXISTS "Public cannot access address cache" ON public.cached_addresses;
CREATE POLICY "Public cannot access address cache"
  ON public.cached_addresses
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Vacuum old entries (unused for 6+ months) weekly
-- Run as superuser or trigger via cron
CREATE OR REPLACE FUNCTION public.cleanup_stale_cached_addresses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.cached_addresses
  WHERE last_used_at < now() - INTERVAL '180 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_cached_addresses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_cached_addresses() TO service_role;

-- Schedule cleanup (requires pg_cron)
-- This will run every Sunday at 02:00 UTC
SELECT cron.schedule_in_timezone(
  'cleanup_stale_cached_addresses',
  'UTC',
  '0 2 * * 0',  -- Sunday 2am UTC
  'SELECT public.cleanup_stale_cached_addresses();'
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;
