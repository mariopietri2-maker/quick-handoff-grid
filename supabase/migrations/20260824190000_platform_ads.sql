-- Platform advertising: draft → preview → approve → published

CREATE TABLE IF NOT EXISTS public.platform_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  link_url TEXT,
  placement TEXT NOT NULL DEFAULT 'customer_home'
    CHECK (placement IN ('customer_home', 'customer_store_list', 'driver_home', 'store_app')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_ads_status
  ON public.platform_ads (status, placement, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_ads_live
  ON public.platform_ads (placement, status)
  WHERE status = 'approved';

ALTER TABLE public.platform_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage platform ads" ON public.platform_ads;
CREATE POLICY "Admins manage platform ads"
  ON public.platform_ads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public can only read approved, in-window ads (for future customer app banners)
DROP POLICY IF EXISTS "Public read approved platform ads" ON public.platform_ads;
CREATE POLICY "Public read approved platform ads"
  ON public.platform_ads FOR SELECT TO anon, authenticated
  USING (
    status = 'approved'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-ads',
  'platform-ads',
  true,
  20971520,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read platform-ads" ON storage.objects;
CREATE POLICY "Public read platform-ads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'platform-ads');

DROP POLICY IF EXISTS "Admins upload platform-ads" ON storage.objects;
CREATE POLICY "Admins upload platform-ads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'platform-ads' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update platform-ads" ON storage.objects;
CREATE POLICY "Admins update platform-ads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'platform-ads' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'platform-ads' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete platform-ads" ON storage.objects;
CREATE POLICY "Admins delete platform-ads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'platform-ads' AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.review_platform_ad(
  p_id UUID,
  p_approve BOOLEAN,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.platform_ads
  SET
    status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = p_note,
    updated_at = now()
  WHERE id = p_id
    AND status IN ('draft', 'pending', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_platform_ad(UUID, BOOLEAN, TEXT) TO authenticated;
