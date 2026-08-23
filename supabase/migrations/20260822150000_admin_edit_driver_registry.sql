-- Admin can edit any driver's registry data (Μητρώο) from the admin panel.
DROP POLICY IF EXISTS "Admins can update any driver profile" ON public.driver_profiles;
CREATE POLICY "Admins can update any driver profile"
ON public.driver_profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260822150000', 'admin_edit_driver_registry')
ON CONFLICT (version) DO NOTHING;
