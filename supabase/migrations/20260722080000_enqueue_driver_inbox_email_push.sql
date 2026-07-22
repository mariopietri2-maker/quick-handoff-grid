-- When admin/support inserts into driver_notifications, enqueue a quiet
-- "new email" style FCM (not the high-priority offer channel).

CREATE OR REPLACE FUNCTION public.enqueue_driver_inbox_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.push_outbox (user_id, app, title, body, data, dedupe_key)
  VALUES (
    NEW.driver_id,
    'driver',
    'Νέο μήνυμα',
    COALESCE(NULLIF(trim(NEW.title), ''), 'Έχεις νέο μήνυμα στα Εισερχόμενα.'),
    jsonb_build_object(
      'type', 'inbox',
      'channel', 'driver-inbox',
      'notification_id', NEW.id,
      'severity', COALESCE(NEW.severity, 'info'),
      'path', '/driver?tab=inbox'
    ),
    'inbox:' || NEW.id::text
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_driver_inbox_push ON public.driver_notifications;
CREATE TRIGGER trg_enqueue_driver_inbox_push
  AFTER INSERT ON public.driver_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_driver_inbox_push();
