-- Public bucket for store / cover photos uploaded by admins.
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-images', 'store-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read store-images" ON storage.objects;
CREATE POLICY "Public read store-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-images');

DROP POLICY IF EXISTS "Admins upload store-images" ON storage.objects;
CREATE POLICY "Admins upload store-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update store-images" ON storage.objects;
CREATE POLICY "Admins update store-images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-images' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'store-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete store-images" ON storage.objects;
CREATE POLICY "Admins delete store-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-images' AND public.has_role(auth.uid(), 'admin'));

-- Store owners may upload into their own store folder
DROP POLICY IF EXISTS "Owners upload own store-images" ON storage.objects;
CREATE POLICY "Owners upload own store-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-images'
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.owner_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Owners update own store-images" ON storage.objects;
CREATE POLICY "Owners update own store-images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-images'
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.owner_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'store-images'
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.owner_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Owners delete own store-images" ON storage.objects;
CREATE POLICY "Owners delete own store-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-images'
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.owner_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );
