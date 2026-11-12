-- Customer support bot: replies in Greek or English on live chat.

CREATE OR REPLACE FUNCTION public.support_bot_reply(p_message text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  q text := lower(coalesce(p_message, ''));
  greek boolean := q ~ '[α-ωάέήίόύώϊϋ]';
BEGIN
  IF q ~ '(order|where is|status|tracking|παραγγελ|που ειναι|πού είναι|παρακολου)' THEN
    RETURN CASE WHEN greek THEN
      'Άνοιξε Παραγγελίες → πάτα την ενεργή παραγγελία → Παρακολούθηση. Εκεί βλέπεις κατάστημα, κατάσταση και οδηγό όταν ανατεθεί.'
    ELSE
      'Open Orders → tap the active order → Tracking. You will see the store, status, and the driver once assigned.'
    END;
  END IF;

  IF q ~ '(deliver|driver|who brings|fresh2go|οδηγ|παραδιδ|ποιος φερνει|ποιος παραδ)' THEN
    RETURN CASE WHEN greek THEN
      'Αν το κατάστημα λέει «Παράδοση Fresh2GO», φέρνει οδηγός Fresh2GO. Αν λέει «Παράδοση καταστήματος», το φέρνει το ίδιο το μαγαζί.'
    ELSE
      'If the store says Delivered by Fresh2GO, a Fresh2GO driver brings it. If it says store delivery, the shop delivers it.'
    END;
  END IF;

  IF q ~ '(address|location|διευθυνσ|αλλαξω διευθ|change address)' THEN
    RETURN CASE WHEN greek THEN
      'Αρχική → πάτα τη διεύθυνση πάνω από την αναζήτηση → διάλεξε ή πρόσθεσε νέα διεύθυνση στα Ιωάννινα.'
    ELSE
      'Home → tap the address above search → pick or add a new address in Ioannina.'
    END;
  END IF;

  IF q ~ '(pay|card|cash|visa|πληρωμ|καρτα|μετρητ)' THEN
    RETURN CASE WHEN greek THEN
      'Μπορείς να πληρώσεις μετρητά στον διανομέα ή με κάρτα όπου είναι ενεργό. Οι αποθηκευμένες κάρτες είναι στο Λογαριασμός → Τρόποι πληρωμής.'
    ELSE
      'You can pay cash to the courier, or by card where it is enabled. Saved cards are under Account → Payment methods.'
    END;
  END IF;

  IF q ~ '(cancel|ακυρ)' THEN
    RETURN CASE WHEN greek THEN
      'Πριν το αποδεχτεί το κατάστημα, συνήθως ακυρώνεις από Παραγγελίες. Μετά την αποδοχή, γράψε εδώ και θα σε βοηθήσει άνθρωπος από την υποστήριξη.'
    ELSE
      'Before the store accepts, you can usually cancel from Orders. After acceptance, write here and a support person will help.'
    END;
  END IF;

  IF q ~ '(refund|money back|επιστροφ|επιστροφη)' THEN
    RETURN CASE WHEN greek THEN
      'Για επιστροφή χρημάτων γράψε τον αριθμό παραγγελίας και τι έγινε. Η υποστήριξη θα το δει και θα απαντήσει.'
    ELSE
      'For a refund, send the order number and what happened. Support will see it and reply.'
    END;
  END IF;

  IF q ~ '(hour|open|closed|ωραρ|ανοιχτ|κλειστ)' THEN
    RETURN CASE WHEN greek THEN
      'Το κατάστημα εμφανίζεται ανοιχτό μόνο όταν το έχει ανοίξει χειροκίνητα και είναι μέσα στο ωράριο. Αν είναι κλειστό, μπορείς να δεις το μενού αλλά όχι να παραγγείλεις.'
    ELSE
      'A store shows as open only when the owner has opened it and it is within its hours. If it is closed you can browse but not order.'
    END;
  END IF;

  IF q ~ '(minimum|min order|ελάχιστ|ελαχιστ)' THEN
    RETURN CASE WHEN greek THEN
      'Κάθε κατάστημα έχει ελάχιστη παραγγελία. Την βλέπεις στην κάρτα του καταστήματος και στο καλάθι πριν την αποστολή.'
    ELSE
      'Each store has a minimum order. You see it on the store card and in the cart before checkout.'
    END;
  END IF;

  IF q ~ '(human|agent|person|someone|άνθρωπ|ανθρωπ|υποστηριξ|support)' THEN
    RETURN CASE WHEN greek THEN
      'Σε συνδέω με την υποστήριξη. Ένας άνθρωπος θα δει το μήνυμα και θα απαντήσει.'
    ELSE
      'I am connecting you to support. A person will see this message and reply.'
    END;
  END IF;

  IF greek THEN
    RETURN 'Γεια! Είμαι ο βοηθός Fresh2GO και μιλάω ελληνικά και αγγλικά. Ρώτα για παραγγελία, διεύθυνση, πληρωμή ή ακύρωση. Αν θέλεις άνθρωπο, γράψε «υποστήριξη».';
  END IF;
  RETURN 'Hi! I am the Fresh2GO assistant and I speak English and Greek. Ask about an order, address, payment, or cancellation. If you want a person, write "support".';
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_support_bot_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NULL OR NEW.sender_role IS DISTINCT FROM 'customer' THEN
    RETURN NEW;
  END IF;
  -- Skip if a bot already replied in the last 8 seconds (avoid loops / double taps).
  IF EXISTS (
    SELECT 1 FROM public.live_chat_messages
    WHERE customer_id = NEW.customer_id
      AND sender_role = 'bot'
      AND created_at > now() - interval '8 seconds'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.live_chat_messages (
    customer_id, order_id, sender_id, sender_role, message
  ) VALUES (
    NEW.customer_id,
    NEW.order_id,
    '00000000-0000-4000-8000-0000000000b0',
    'bot',
    public.support_bot_reply(NEW.message)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_bot_reply ON public.live_chat_messages;
CREATE TRIGGER trg_support_bot_reply
  AFTER INSERT ON public.live_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_support_bot_reply();

GRANT EXECUTE ON FUNCTION public.support_bot_reply(text) TO authenticated, anon;
