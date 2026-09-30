-- Loyalty settings (admin-configurable) + wire award/redeem to settings.

CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  points_per_euro numeric(8,2) NOT NULL DEFAULT 1,
  redeem_points_per_euro integer NOT NULL DEFAULT 5,
  tier_silver integer NOT NULL DEFAULT 200,
  tier_gold integer NOT NULL DEFAULT 500,
  tier_platinum integer NOT NULL DEFAULT 1000,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.loyalty_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage loyalty settings" ON public.loyalty_settings;
CREATE POLICY "Admins manage loyalty settings"
  ON public.loyalty_settings FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'support'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Authenticated read loyalty settings" ON public.loyalty_settings;
CREATE POLICY "Authenticated read loyalty settings"
  ON public.loyalty_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins manage streak milestones" ON public.streak_milestones;
CREATE POLICY "Admins manage streak milestones"
  ON public.streak_milestones FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- See repo full migration for award_loyalty_points / redeem / admin_adjust
