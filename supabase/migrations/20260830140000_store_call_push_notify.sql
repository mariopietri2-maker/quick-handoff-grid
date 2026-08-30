-- Ensure store calls notify online K drivers via push_outbox so FCM can wake the app.
-- Apply this migration on Supabase (SQL editor or CLI).

-- push_outbox (idempotent minimal shape used by send-push)
CREATE TABLE IF NOT EXISTS public.push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  app text NOT NULL DEFAULT 'driver',
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  claimed_at timestamptz,
  error text
);

CREATE INDEX IF NOT EXISTS push_outbox_pending_idx
  ON public.push_outbox (created_at)
  WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS public.push_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL,
  app text NOT NULL DEFAULT 'driver',
  platform text DEFAULT 'android',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_app_idx
  ON public.push_tokens (user_id, app);

-- Notify all online K / both drivers when a store opens a call.
CREATE OR REPLACE FUNCTION public.notify_drivers_store_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_name text;
  r record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(name, 'Κατάστημα') INTO v_store_name
  FROM public.stores
  WHERE id = NEW.store_id;

  FOR r IN
    SELECT dp.id AS driver_id
    FROM public.driver_profiles dp
    JOIN public.driver_state ds ON ds.driver_id = dp.id
    WHERE dp.is_active IS TRUE
      AND dp.call_role IN ('K', 'both')
      AND ds.shift_started_at IS NOT NULL
      AND COALESCE(ds.on_break, false) IS NOT TRUE
  LOOP
    INSERT INTO public.push_outbox (user_id, app, title, body, data)
    VALUES (
      r.driver_id,
      'driver',
      '📞 Κλήση καταστήματος',
      COALESCE(v_store_name, 'Κατάστημα') || ' — άνοιξε για αποδοχή',
      jsonb_build_object(
        'type', 'store_call',
        'call_id', NEW.id::text,
        'store_id', NEW.store_id::text,
        'store_name', COALESCE(v_store_name, 'Κατάστημα')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_call_notify ON public.store_driver_calls;
CREATE TRIGGER trg_store_call_notify
  AFTER INSERT ON public.store_driver_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_drivers_store_call();

-- Also fire on UPDATE to open (if create does insert then update).
DROP TRIGGER IF EXISTS trg_store_call_notify_upd ON public.store_driver_calls;
CREATE TRIGGER trg_store_call_notify_upd
  AFTER UPDATE OF status ON public.store_driver_calls
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM 'open' AND NEW.status = 'open')
  EXECUTE FUNCTION public.notify_drivers_store_call();
