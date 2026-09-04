-- Epsilon Digital invoicing config (Fresh Meal).
-- Extends the singleton invoice_provider_config with non-secret Epsilon
-- connection settings. Secrets (API key / email / password / subscription key)
-- live ONLY in Supabase secrets (EPSILON_*), never in this table.

ALTER TABLE public.invoice_provider_config
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox'
    CHECK (environment IN ('sandbox', 'production')),
  ADD COLUMN IF NOT EXISTS api_base_url text NOT NULL DEFAULT 'https://beta-api.epsilonnet.gr',
  ADD COLUMN IF NOT EXISTS company_id text,
  ADD COLUMN IF NOT EXISTS branch_id text,
  ADD COLUMN IF NOT EXISTS document_series text,
  ADD COLUMN IF NOT EXISTS default_payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_invoice_provider_config()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_provider_config_updated_at_trg ON public.invoice_provider_config;
CREATE TRIGGER invoice_provider_config_updated_at_trg
BEFORE UPDATE ON public.invoice_provider_config
FOR EACH ROW EXECUTE FUNCTION public.touch_invoice_provider_config();

-- Admins can manage the provider config (update), not just read.
DROP POLICY IF EXISTS "Admins manage invoice provider config" ON public.invoice_provider_config;
CREATE POLICY "Admins manage invoice provider config"
  ON public.invoice_provider_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helpful index for recent invoices view in admin.
CREATE INDEX IF NOT EXISTS order_invoices_created_at_idx
  ON public.order_invoices (created_at DESC);
