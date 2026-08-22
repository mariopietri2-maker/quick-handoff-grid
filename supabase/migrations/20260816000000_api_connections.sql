-- =============================================================================
-- API connections: bridge to an external ordering platform.
-- -----------------------------------------------------------------------------
-- - Incoming orders: the external platform POSTs new orders to our webhook edge
--   function (`api-ingest`); we ingest them as source='api' with status 'placed'
--   so the existing auto-dispatch cron picks them up and offers them to drivers.
-- - Outgoing status: every status change of an api-sourced order is enqueued in
--   `api_outbox` and drained by `api-push` to the external platform's API.
-- - Polling: `api-poll` fetches pending orders on an interval (optional).
--
-- Webhook URL to give the external platform:
--   {SUPABASE_URL}/functions/v1/api-ingest?connection_id={id}
--   header: x-webhook-secret: {webhook_secret}
-- =============================================================================

-- Allow 'api' as an order source (kept alongside efood/wolt/box/manual/other)
CREATE OR REPLACE FUNCTION public.validate_order_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source NOT IN ('in_app','manual','efood','wolt','box','other','api') THEN
    RAISE EXCEPTION 'Invalid order source: %', NEW.source;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_source_trg ON public.orders;
CREATE TRIGGER validate_order_source_trg
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_order_source();

-- -----------------------------------------------------------------------------
-- api_connections: one row per external platform integration.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'other',          -- efood | wolt | box | other
  base_url text NOT NULL,                          -- external platform API base URL
  api_key text,                                    -- outgoing bearer token for that platform
  webhook_secret text,                             -- shared secret the platform sends back
  enabled boolean NOT NULL DEFAULT true,
  incoming_enabled boolean NOT NULL DEFAULT true,  -- accept webhook orders
  outgoing_enabled boolean NOT NULL DEFAULT true,  -- push status updates back
  polling_enabled boolean NOT NULL DEFAULT false,  -- pull pending orders on an interval
  poll_interval_seconds integer NOT NULL DEFAULT 60,
  poll_path text NOT NULL DEFAULT '/orders/pending',
  outgoing_path text NOT NULL DEFAULT '/orders/{external_ref}/status',
  default_store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  store_mapping jsonb NOT NULL DEFAULT '{}',       -- { external store ref -> our store uuid }
  field_mapping jsonb NOT NULL DEFAULT '{}',       -- { canonical field -> external field name }
  status_mapping jsonb NOT NULL DEFAULT '{}',      -- { our status -> external status label }
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_connections ENABLE ROW LEVEL SECURITY;

-- Link orders back to the API connection that created them (for outgoing pushes)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS api_connection_id uuid REFERENCES public.api_connections(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Admins manage api_connections" ON public.api_connections;
CREATE POLICY "Admins manage api_connections" ON public.api_connections
  FOR ALL USING (is_support_or_admin(auth.uid()))
  WITH CHECK (is_support_or_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- api_outbox: outgoing order-status events to push to the external platform.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.api_connections(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  external_ref text,
  status text NOT NULL,
  payload jsonb,
  state text NOT NULL DEFAULT 'pending',           -- pending | sending | sent | failed
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS api_outbox_conn_order_status_key
  ON public.api_outbox (connection_id, order_id, status);

ALTER TABLE public.api_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view api_outbox" ON public.api_outbox;
CREATE POLICY "Admins view api_outbox" ON public.api_outbox
  FOR SELECT USING (is_support_or_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- api_sync_logs: audit trail of received / pushed events.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.api_connections(id) ON DELETE CASCADE,
  direction text NOT NULL,                          -- in | out
  event_type text NOT NULL,                         -- order_received | status_push | ...
  order_id uuid,
  external_ref text,
  status text,
  payload jsonb,
  response jsonb,
  status_code integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view api_sync_logs" ON public.api_sync_logs;
CREATE POLICY "Admins view api_sync_logs" ON public.api_sync_logs
  FOR SELECT USING (is_support_or_admin(auth.uid()));

-- Keep updated_at fresh on api_connections
CREATE OR REPLACE FUNCTION public.touch_api_connection_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS api_connections_updated_at_trg ON public.api_connections;
CREATE TRIGGER api_connections_updated_at_trg
BEFORE UPDATE ON public.api_connections
FOR EACH ROW EXECUTE FUNCTION public.touch_api_connection_updated_at();

-- -----------------------------------------------------------------------------
-- Log helper (service-role / definer only).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_log_sync(
  p_connection_id uuid,
  p_direction text,
  p_event_type text,
  p_order_id uuid DEFAULT NULL,
  p_external_ref text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_payload jsonb DEFAULT NULL,
  p_response jsonb DEFAULT NULL,
  p_status_code integer DEFAULT NULL,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.api_sync_logs (
    connection_id, direction, event_type, order_id, external_ref, status,
    payload, response, status_code, error
  ) VALUES (
    p_connection_id, p_direction, p_event_type, p_order_id, p_external_ref, p_status,
    p_payload, p_response, p_status_code, LEFT(p_error, 500)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.api_log_sync(uuid, text, text, uuid, text, text, jsonb, jsonb, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_log_sync(uuid, text, text, uuid, text, text, jsonb, jsonb, integer, text) TO service_role;

-- -----------------------------------------------------------------------------
-- Ingest an external order payload into our orders table.
-- SECURITY DEFINER, service-role only (called by the api-ingest / api-poll edge
-- functions). Mirrors create_external_order but is not admin-gated and stamps
-- api_connection_id so status changes auto-enqueue outgoing updates.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_ingest_external_order(
  p_connection_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conn api_connections%ROWTYPE;
  v_store stores%ROWTYPE;
  v_settings platform_settings%ROWTYPE;
  v_override store_pricing_overrides%ROWTYPE;
  v_store_ref text;
  v_external_ref text;
  v_total numeric;
  v_address text;
  v_lat double precision;
  v_lng double precision;
  v_km numeric;
  v_customer_name text;
  v_customer_phone text;
  v_notes text;
  v_items text;
  v_payment text;
  v_pay_override numeric;
  v_charge_override numeric;
  v_store_id uuid;
  v_base numeric; v_per_km numeric; v_min numeric;
  v_driver_pay numeric;
  v_store_charge numeric;
  v_profit numeric;
  v_order_id uuid;
  v_existing uuid;
  v_combined_notes text;
  v_source text;
  f text;
BEGIN
  SELECT * INTO v_conn FROM api_connections WHERE id = p_connection_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'api_connection not found';
  END IF;
  IF NOT v_conn.enabled OR NOT v_conn.incoming_enabled THEN
    RAISE EXCEPTION 'incoming disabled for connection %', v_conn.name;
  END IF;

  -- Extract canonical fields via field_mapping (identity when unmapped)
  v_external_ref := COALESCE(p_payload->>COALESCE(v_conn.field_mapping->>'external_ref', 'external_ref'), '');
  IF v_external_ref = '' THEN
    PERFORM public.api_log_sync(p_connection_id, 'in', 'order_rejected', NULL, NULL, NULL, p_payload, NULL, 400, 'missing external_ref');
    RAISE EXCEPTION 'missing external_ref';
  END IF;

  -- Idempotency: same external ref for the same connection is ignored
  SELECT id INTO v_existing FROM orders
   WHERE api_connection_id = p_connection_id AND external_ref = v_external_ref
   LIMIT 1;
  IF FOUND THEN
    PERFORM public.api_log_sync(p_connection_id, 'in', 'order_duplicate', v_existing, v_external_ref, NULL, p_payload, NULL, 200, NULL);
    RETURN v_existing;
  END IF;

  v_store_ref := COALESCE(p_payload->>COALESCE(v_conn.field_mapping->>'store_ref', 'store_ref'), '');
  IF v_store_ref <> '' THEN
    v_store_id := (v_conn.store_mapping->>v_store_ref)::uuid;
  END IF;
  IF v_store_id IS NULL THEN
    v_store_id := v_conn.default_store_id;
  END IF;
  IF v_store_id IS NULL THEN
    PERFORM public.api_log_sync(p_connection_id, 'in', 'order_rejected', NULL, v_external_ref, NULL, p_payload, NULL, 400, 'no store mapping');
    RAISE EXCEPTION 'no store mapping for store_ref=% and no default_store_id', v_store_ref;
  END IF;

  SELECT * INTO v_store FROM stores WHERE id = v_store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'store not found';
  END IF;

  v_total := COALESCE((p_payload->>COALESCE(v_conn.field_mapping->>'total_amount', 'total_amount'))::numeric, 0);
  IF v_total < 0 THEN
    RAISE EXCEPTION 'total_amount cannot be negative';
  END IF;
  v_address    := COALESCE(p_payload->>COALESCE(v_conn.field_mapping->>'delivery_address', 'delivery_address'), '');
  v_lat        := NULLIF(p_payload->>COALESCE(v_conn.field_mapping->>'delivery_latitude', 'delivery_latitude'), '')::double precision;
  v_lng        := NULLIF(p_payload->>COALESCE(v_conn.field_mapping->>'delivery_longitude', 'delivery_longitude'), '')::double precision;
  v_km         := COALESCE(NULLIF(p_payload->>COALESCE(v_conn.field_mapping->>'distance_km', 'distance_km'), '')::numeric, 0);
  v_customer_name := COALESCE(p_payload->>COALESCE(v_conn.field_mapping->>'customer_name', 'customer_name'), '');
  v_customer_phone := COALESCE(p_payload->>COALESCE(v_conn.field_mapping->>'customer_phone', 'customer_phone'), '');
  v_notes       := COALESCE(p_payload->>COALESCE(v_conn.field_mapping->>'notes', 'notes'), '');
  v_items       := COALESCE(p_payload->>COALESCE(v_conn.field_mapping->>'items_summary', 'items_summary'), '');
  v_payment     := COALESCE(p_payload->>COALESCE(v_conn.field_mapping->>'payment_method', 'payment_method'), 'external');
  v_pay_override := NULLIF(p_payload->>COALESCE(v_conn.field_mapping->>'driver_payout_override', 'driver_payout_override'), '')::numeric;
  v_charge_override := NULLIF(p_payload->>COALESCE(v_conn.field_mapping->>'store_charge_override', 'store_charge_override'), '')::numeric;

  -- Pricing mirrors create_external_order
  SELECT * INTO v_settings FROM platform_settings WHERE id = 1;
  SELECT * INTO v_override FROM store_pricing_overrides WHERE store_id = v_store_id;

  v_base   := COALESCE(v_override.base_pay,    v_settings.base_pay,    3);
  v_per_km := COALESCE(v_override.per_km_rate, v_settings.per_km_rate, 0.5);
  v_min    := COALESCE(v_override.min_pay,     v_settings.min_pay,     3);

  IF v_pay_override IS NOT NULL THEN
    v_driver_pay := v_pay_override;
  ELSE
    v_driver_pay := GREATEST(v_min, v_base + v_per_km * v_km);
  END IF;

  IF v_charge_override IS NOT NULL THEN
    v_store_charge := v_charge_override;
  ELSE
    CASE v_store.ext_billing_mode
      WHEN 'commission'         THEN v_store_charge := ROUND((v_total * v_store.ext_commission_pct / 100)::numeric, 2);
      WHEN 'flat_fee'           THEN v_store_charge := v_store.ext_flat_fee;
      WHEN 'driver_plus_margin' THEN v_store_charge := ROUND((v_driver_pay * (1 + v_store.ext_margin_pct / 100))::numeric, 2);
      ELSE                           v_store_charge := ROUND((v_total * 0.15)::numeric, 2);
    END CASE;
  END IF;

  v_profit := v_store_charge - v_driver_pay;

  v_combined_notes := CONCAT_WS(E'\n',
    NULLIF(v_notes, ''),
    CASE WHEN v_customer_name <> '' THEN '👤 ' || v_customer_name END,
    CASE WHEN v_customer_phone <> '' THEN '📞 ' || v_customer_phone END,
    CASE WHEN v_items <> '' THEN '🧾 ' || v_items END
  );

  v_source := CASE WHEN v_conn.platform IN ('efood','wolt','box','other') THEN v_conn.platform ELSE 'api' END;

  INSERT INTO orders (
    store_id, status, source, external_ref, api_connection_id,
    total_amount, delivery_fee, distance_km,
    delivery_address, delivery_latitude, delivery_longitude,
    notes, payment_method,
    store_charge, driver_payout, platform_profit
  ) VALUES (
    v_store_id, 'placed', v_source, v_external_ref, p_connection_id,
    v_total, v_driver_pay, v_km,
    v_address, v_lat, v_lng,
    v_combined_notes, v_payment,
    v_store_charge, v_driver_pay, v_profit
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, name, quantity, unit_price)
  VALUES (
    v_order_id,
    COALESCE(NULLIF(v_items, ''), 'External order from ' || v_conn.name),
    1,
    v_total
  );

  PERFORM public.api_log_sync(p_connection_id, 'in', 'order_received', v_order_id, v_external_ref, 'placed', p_payload, jsonb_build_object('order_id', v_order_id), 201, NULL);

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.api_ingest_external_order(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_ingest_external_order(uuid, jsonb) TO service_role;

-- -----------------------------------------------------------------------------
-- Outbox trigger: enqueue an outgoing status push whenever an api-sourced order
-- is inserted or changes status. Dedupe key (connection_id, order_id, status)
-- guarantees each status is pushed at most once.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_enqueue_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conn api_connections%ROWTYPE;
BEGIN
  IF NEW.api_connection_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_conn FROM api_connections WHERE id = NEW.api_connection_id;
  IF NOT FOUND OR NOT v_conn.enabled OR NOT v_conn.outgoing_enabled THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.api_outbox (connection_id, order_id, external_ref, status, payload)
  VALUES (
    NEW.api_connection_id,
    NEW.id,
    NEW.external_ref,
    NEW.status,
    jsonb_build_object(
      'order_id', NEW.id,
      'external_ref', NEW.external_ref,
      'status', NEW.status,
      'updated_at', now()
    )
  )
  ON CONFLICT (connection_id, order_id, status) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS api_order_status_outbox_trg ON public.orders;
CREATE TRIGGER api_order_status_outbox_trg
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.api_enqueue_order_status();

-- -----------------------------------------------------------------------------
-- Claim + complete outbox rows (concurrent-drain safe, service-role only).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_claim_outbox(
  p_connection_id uuid,
  p_limit integer DEFAULT 20
) RETURNS SETOF public.api_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.api_outbox
    WHERE connection_id = p_connection_id
      AND state IN ('pending', 'failed')
      AND attempts < 10
    ORDER BY created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.api_outbox o
  SET state = 'sending', attempts = o.attempts + 1
  FROM picked
  WHERE o.id = picked.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.api_claim_outbox(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_claim_outbox(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.api_complete_outbox(
  p_id uuid,
  p_succeeded boolean,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_succeeded THEN
    UPDATE public.api_outbox SET state = 'sent', sent_at = now(), last_error = NULL WHERE id = p_id;
  ELSE
    UPDATE public.api_outbox SET state = 'failed', last_error = LEFT(COALESCE(p_error, 'push failed'), 500) WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.api_complete_outbox(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_complete_outbox(uuid, boolean, text) TO service_role;

-- -----------------------------------------------------------------------------
-- Crons: drain outgoing status updates every 15s, poll pending orders every 30s.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('api-push-15s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'api-push-15s',
      '15 seconds',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/api-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"limit":20,"source":"cron"}'::jsonb
      );
      $cron$
    );
    BEGIN
      PERFORM cron.unschedule('api-poll-30s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'api-poll-30s',
      '30 seconds',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/api-poll',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"source":"cron"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
