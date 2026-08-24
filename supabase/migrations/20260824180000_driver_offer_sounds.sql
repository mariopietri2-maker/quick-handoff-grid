-- Admin-managed driver offer sound library (public read, admin write).
-- Drivers (web/PWA) can play remote MP3 without shipping a new APK.
-- Native APK still uses baked-in classic until it streams remote URLs.

CREATE TABLE IF NOT EXISTS public.driver_offer_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_offer_sounds_active
  ON public.driver_offer_sounds (is_active, is_default DESC, created_at DESC);

-- At most one default row
CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_offer_sounds_one_default
  ON public.driver_offer_sounds ((is_default))
  WHERE is_default = true;

ALTER TABLE public.driver_offer_sounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read active offer sounds" ON public.driver_offer_sounds;
CREATE POLICY "Anyone authenticated can read active offer sounds"
  ON public.driver_offer_sounds FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage driver offer sounds" ON public.driver_offer_sounds;
CREATE POLICY "Admins manage driver offer sounds"
  ON public.driver_offer_sounds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket (public so FCM / MediaPlayer / HTMLAudio can load without signed URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-offer-sounds',
  'driver-offer-sounds',
  true,
  2097152,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read driver-offer-sounds" ON storage.objects;
CREATE POLICY "Public read driver-offer-sounds"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'driver-offer-sounds');

DROP POLICY IF EXISTS "Admins upload driver-offer-sounds" ON storage.objects;
CREATE POLICY "Admins upload driver-offer-sounds"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-offer-sounds' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update driver-offer-sounds" ON storage.objects;
CREATE POLICY "Admins update driver-offer-sounds"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-offer-sounds' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'driver-offer-sounds' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete driver-offer-sounds" ON storage.objects;
CREATE POLICY "Admins delete driver-offer-sounds"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-offer-sounds' AND public.has_role(auth.uid(), 'admin'));

-- Helpers
CREATE OR REPLACE FUNCTION public.set_default_driver_offer_sound(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.driver_offer_sounds SET is_default = false WHERE is_default = true;
  UPDATE public.driver_offer_sounds
    SET is_default = true, is_active = true, updated_at = now()
    WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_default_driver_offer_sound(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_driver_offer_sounds_public()
RETURNS TABLE (
  id UUID,
  name TEXT,
  public_url TEXT,
  is_default BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.public_url, s.is_default
  FROM public.driver_offer_sounds s
  WHERE s.is_active = true
  ORDER BY s.is_default DESC, s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_driver_offer_sounds_public() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_driver_offer_sounds_public() TO anon;
