-- Instant delivery for store calls (side project: role N store → role K drivers).
-- When an N-store creates a call, every ON-SHIFT driver with call_role='K'
-- immediately gets a push_outbox row (FCM heads-up via send-push), so the
-- first available driver can accept within seconds. Accept stays atomic —
-- exactly one winner (accept_store_driver_call).
--
-- Reuses the existing instant-drain pattern:
--   request_send_push_drain() → pg_net POST → functions/v1/send-push
-- (same path as customer order-status pushes).

CREATE OR REPLACE FUNCTION public.enqueue_store_call_pushes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_store TEXT;
BEGIN
  IF NEW.status <> 'open' THEN
    RETURN NEW;
  END IF;

  SELECT s.name INTO v_store FROM public.stores s WHERE s.id = NEW.store_id;

  INSERT INTO public.push_outbox (user_id, app, title, body, data, dedupe_key)
  SELECT dp.user_id,
         'driver',
         '📞 Νέα κλήση καταστήματος',
         COALESCE(v_store, 'Κατάστημα') || ' χρειάζεται οδηγό τώρα — πρώτος που δέχεται τον παίρνει.',
         jsonb_build_object(
           'type', 'store_call',
           'call_id', NEW.id,
           'store_name', v_store
         ),
         'store-call:' || NEW.id::text || ':' || dp.user_id::text
  FROM public.driver_profiles dp
  JOIN public.driver_states ds ON ds.user_id = dp.user_id
  WHERE dp.call_role = 'K'
    AND ds.shift_started_at IS NOT NULL;

  PERFORM public.request_send_push_drain(40);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the call creation because of a push hiccup.
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_store_call_push ON public.store_driver_calls;
CREATE TRIGGER trg_store_call_push
AFTER INSERT ON public.store_driver_calls
FOR EACH ROW EXECUTE FUNCTION public.enqueue_store_call_pushes();
