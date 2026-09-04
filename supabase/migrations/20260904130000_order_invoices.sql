-- Fiscal invoicing scaffold (Fresh Meal).
-- Provider-issued invoices (ΜΑΡΚ/UID/QR) per order + issuer role.
-- Actual issuance happens through a certified e-invoicing provider via the
-- `issue-invoice` edge function. This migration only creates storage + config.

-- Singleton provider config (credentials live in Supabase secrets, never here).
CREATE TABLE IF NOT EXISTS public.invoice_provider_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider text NOT NULL DEFAULT 'none',
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.invoice_provider_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.order_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  issuer_role text NOT NULL CHECK (issuer_role IN ('platform', 'store', 'driver')),
  provider text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'failed', 'cancelled')),
  -- Provider-issued fiscal identity (NULL until the provider confirms).
  number text,
  fiscal_mark text,
  fiscal_uid text,
  fiscal_qr text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, issuer_role)
);
CREATE INDEX IF NOT EXISTS order_invoices_order_id_idx ON public.order_invoices (order_id);
CREATE INDEX IF NOT EXISTS order_invoices_status_idx ON public.order_invoices (status);

ALTER TABLE public.order_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_provider_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage order invoices" ON public.order_invoices;
CREATE POLICY "Admins manage order invoices"
  ON public.order_invoices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read invoice provider config" ON public.invoice_provider_config;
CREATE POLICY "Admins read invoice provider config"
  ON public.invoice_provider_config FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
