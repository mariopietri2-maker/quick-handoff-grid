-- Notify the store owner when an order becomes placed (cash insert or card confirm).
CREATE OR REPLACE FUNCTION public.notify_store_on_placed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'placed'::order_status THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'placed'::order_status THEN
    RETURN NEW;
  END IF;

  SELECT owner_id, name INTO v_owner, v_name
  FROM public.stores WHERE id = NEW.store_id;

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.push_outbox (user_id, app, title, body, data, dedupe_key)
    VALUES (
      v_owner,
      'store',
      'Νέα παραγγελία',
      COALESCE(v_name, 'Κατάστημα') || ' · ' || COALESCE(NEW.payment_method, 'order') || ' · #' || left(NEW.id::text, 8),
      jsonb_build_object('type', 'new_order', 'order_id', NEW.id, 'payment_method', NEW.payment_method),
      'store-placed:' || NEW.id::text
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_store_on_placed ON public.orders;
CREATE TRIGGER trg_notify_store_on_placed
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_store_on_placed();

-- Daily proof that cash and card orders both notify the store.
CREATE OR REPLACE FUNCTION public.daily_store_notify_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger int;
  v_cash_placed int;
  v_card_placed int;
  v_cash_missing int;
  v_card_missing int;
  v_card_stuck int;
  v_ok boolean;
  v_title text;
  v_body text;
  v_data jsonb;
BEGIN
  SELECT count(*) INTO v_trigger
  FROM pg_trigger
  WHERE tgname = 'trg_notify_store_on_placed' AND NOT tgisinternal;

  SELECT
    count(*) FILTER (WHERE payment_method = 'cash' AND status <> 'pending'),
    count(*) FILTER (WHERE payment_method = 'card' AND status <> 'pending')
  INTO v_cash_placed, v_card_placed
  FROM public.orders
  WHERE created_at > now() - interval '24 hours';

  SELECT
    count(*) FILTER (WHERE o.payment_method = 'cash'),
    count(*) FILTER (WHERE o.payment_method = 'card')
  INTO v_cash_missing, v_card_missing
  FROM public.orders o
  WHERE o.created_at > now() - interval '24 hours'
    AND o.status <> 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.push_outbox p
      WHERE p.dedupe_key = 'store-placed:' || o.id::text
    );

  SELECT count(*) INTO v_card_stuck
  FROM public.orders
  WHERE payment_method = 'card'
    AND status = 'pending'
    AND created_at < now() - interval '20 minutes'
    AND created_at > now() - interval '24 hours';

  v_ok := v_trigger > 0 AND v_cash_missing = 0 AND v_card_missing = 0 AND v_card_stuck = 0;
  v_title := CASE WHEN v_ok THEN 'Store notify OK' ELSE 'Store notify BROKEN' END;
  v_body := format(
    'trigger=%s cash_placed=%s card_placed=%s cash_missing=%s card_missing=%s card_stuck=%s',
    v_trigger, v_cash_placed, v_card_placed, v_cash_missing, v_card_missing, v_card_stuck
  );
  v_data := jsonb_build_object(
    'ok', v_ok,
    'trigger', v_trigger,
    'cash_placed_24h', v_cash_placed,
    'card_placed_24h', v_card_placed,
    'cash_missing_notify', v_cash_missing,
    'card_missing_notify', v_card_missing,
    'card_stuck_pending', v_card_stuck
  );

  PERFORM public.enqueue_alert(
    'store_notify_daily',
    CASE WHEN v_ok THEN 'info' ELSE 'error' END,
    v_title,
    v_body,
    v_data,
    'store-notify:' || to_char(now() AT TIME ZONE 'Europe/Athens', 'YYYY-MM-DD')
  );

  RETURN v_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.daily_store_notify_check() TO service_role;

SELECT cron.unschedule('store-notify-daily-check')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'store-notify-daily-check');

SELECT cron.schedule(
  'store-notify-daily-check',
  '15 8 * * *',
  $$SELECT public.daily_store_notify_check();$$
);
