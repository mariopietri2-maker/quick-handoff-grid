-- Drivers get an inbox notification (+ quiet FCM push via
-- trg_enqueue_driver_inbox_push) whenever support/admin:
--   1. posts an answer on one of their tickets, or
--   2. changes a ticket's status (open → in_progress → resolved).
-- Live: driver_notifications is already in supabase_realtime, so the
-- Capacitor/web driver app shows the banner + sound instantly.

CREATE OR REPLACE FUNCTION public.notify_driver_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_body text;
BEGIN
  -- Only agent answers notify; the driver's own messages never do.
  IF NEW.sender_role NOT IN ('support', 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF v_ticket.driver_id IS NULL THEN
    RETURN NEW; -- store/customer tickets have no driver inbox
  END IF;

  v_body := COALESCE(NULLIF(trim(NEW.message), ''), 'Στάλθηκε συνημμένο.');
  INSERT INTO public.driver_notifications (driver_id, title, body, severity, sender_id)
  VALUES (
    v_ticket.driver_id,
    'Απάντηση υποστήριξης · ticket #' || substr(v_ticket.id::text, 1, 8),
    left(v_body, 300),
    CASE WHEN v_ticket.priority = 'sos' THEN 'urgent' ELSE 'info' END,
    NEW.sender_id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_driver_ticket_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.driver_id IS NULL OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.driver_notifications (driver_id, title, body, severity)
  VALUES (
    NEW.driver_id,
    'Ενημέρωση ticket #' || substr(NEW.id::text, 1, 8),
    CASE NEW.status
      WHEN 'in_progress' THEN 'Η υποστήριξη ανέλαβε το ticket σου. '
      WHEN 'resolved' THEN 'Το ticket σου επιλύθηκε. '
      WHEN 'open' THEN 'Το ticket σου επαναφέρθηκε σε αναμονή. '
      ELSE 'Η κατάσταση του ticket σου άλλαξε. '
    END
    || CASE
         WHEN NEW.status = 'resolved' AND NULLIF(trim(COALESCE(NEW.resolution_notes, '')), '') IS NOT NULL
           THEN left(trim(NEW.resolution_notes), 280)
         ELSE ''
       END,
    CASE WHEN NEW.priority = 'sos' THEN 'urgent' ELSE 'info' END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_driver_ticket_reply ON public.ticket_messages;
CREATE TRIGGER trg_notify_driver_ticket_reply
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_ticket_reply();

DROP TRIGGER IF EXISTS trg_notify_driver_ticket_status ON public.support_tickets;
CREATE TRIGGER trg_notify_driver_ticket_status
  AFTER UPDATE OF status ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_ticket_status();
