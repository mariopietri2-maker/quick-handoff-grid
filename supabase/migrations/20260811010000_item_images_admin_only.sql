-- Public bucket for menu-item photos. Only admins may upload/overwrite/delete
-- images here; store owners manage item text via RLS but never images.
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read item-images" ON storage.objects;
CREATE POLICY "Public read item-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'item-images');

DROP POLICY IF EXISTS "Admins upload item-images" ON storage.objects;
CREATE POLICY "Admins upload item-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'item-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update item-images" ON storage.objects;
CREATE POLICY "Admins update item-images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'item-images' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'item-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete item-images" ON storage.objects;
CREATE POLICY "Admins delete item-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'item-images' AND public.has_role(auth.uid(), 'admin'));

-- Block store owners (and any non-admin) from editing image_url on menu items.
CREATE OR REPLACE FUNCTION public.guard_menu_item_image_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.image_url IS DISTINCT FROM OLD.image_url
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change menu item images';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_menu_items_image_admin ON public.menu_items;
CREATE TRIGGER trg_menu_items_image_admin
  BEFORE UPDATE OF image_url ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_menu_item_image_admin();
