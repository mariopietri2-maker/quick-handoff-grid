CREATE TABLE IF NOT EXISTS public.ai_pricing_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  auto_apply boolean NOT NULL DEFAULT true,
  run_interval_minutes integer NOT NULL DEFAULT 30,
  model text NOT NULL DEFAULT 'google/gemini-3.6-flash',
  delivery_fee_min_mult numeric NOT NULL DEFAULT 0.9,
  delivery_fee_max_mult numeric NOT NULL DEFAULT 1.4,
  driver_pay_min_mult numeric NOT NULL DEFAULT 1.0,
  driver_pay_max_mult numeric NOT NULL DEFAULT 1.6,
  commission_min_pct numeric NOT NULL DEFAULT 10,
  commission_max_pct numeric NOT NULL DEFAULT 20,
  menu_price_min_mult numeric NOT NULL DEFAULT 0.95,
  menu_price_max_mult numeric NOT NULL DEFAULT 1.15,
  menu_pricing_enabled boolean NOT NULL DEFAULT false,
  commission_pricing_enabled boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ai_pricing_config TO authenticated;
GRANT ALL ON public.ai_pricing_config TO service_role;
ALTER TABLE public.ai_pricing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ai pricing config" ON public.ai_pricing_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.ai_pricing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'ok',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  decisions jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning text,
  applied boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_pricing_runs TO authenticated;
GRANT ALL ON public.ai_pricing_runs TO service_role;
ALTER TABLE public.ai_pricing_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read ai pricing runs" ON public.ai_pricing_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE TABLE IF NOT EXISTS public.ai_pricing_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.ai_pricing_runs(id) ON DELETE CASCADE,
  scope text NOT NULL,
  target_id uuid,
  target_label text,
  field text NOT NULL,
  old_value numeric,
  new_value numeric,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_pricing_adjustments_run_idx ON public.ai_pricing_adjustments(run_id);
CREATE INDEX IF NOT EXISTS ai_pricing_adjustments_created_idx ON public.ai_pricing_adjustments(created_at DESC);

GRANT SELECT ON public.ai_pricing_adjustments TO authenticated;
GRANT ALL ON public.ai_pricing_adjustments TO service_role;
ALTER TABLE public.ai_pricing_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read ai pricing adjustments" ON public.ai_pricing_adjustments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS ai_delivery_fee_multiplier numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS ai_driver_pay_multiplier numeric NOT NULL DEFAULT 1.0;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS base_price numeric;

CREATE OR REPLACE FUNCTION public.ai_pricing_config_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_pricing_config_touch_trg ON public.ai_pricing_config;
CREATE TRIGGER ai_pricing_config_touch_trg
  BEFORE UPDATE ON public.ai_pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.ai_pricing_config_touch();

INSERT INTO public.ai_pricing_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;