-- Fix "CASE not found" error that blocked drivers from completing orders.
-- award_loyalty_points() used a PL/pgSQL CASE statement on tier that only
-- handled silver/gold/platinum. Bronze (the default tier) raised
-- "CASE not found", which aborted the driver's 'delivered' status update.

CREATE OR REPLACE FUNCTION public.award_loyalty_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points numeric;
  v_tier text;
  v_loyalty RECORD;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- 1 point per €1 spent (food only, not delivery/tip)
  v_points := COALESCE(NEW.total_amount, 0);

  -- Bonus multiplier by tier
  SELECT * INTO v_loyalty FROM public.loyalty_points WHERE user_id = NEW.customer_id;

  IF FOUND THEN
    CASE v_loyalty.tier
      WHEN 'bronze' THEN v_points := v_points;
      WHEN 'silver' THEN v_points := v_points * 1.1;
      WHEN 'gold' THEN v_points := v_points * 1.25;
      WHEN 'platinum' THEN v_points := v_points * 1.5;
      ELSE NULL;
    END CASE;

    -- Update points
    UPDATE public.loyalty_points
    SET
      points_balance = points_balance + v_points,
      lifetime_points = lifetime_points + v_points,
      orders_count = orders_count + 1,
      last_order_at = now(),
      tier = CASE
        WHEN lifetime_points + v_points >= 500 THEN 'platinum'
        WHEN lifetime_points + v_points >= 200 THEN 'gold'
        WHEN lifetime_points + v_points >= 50 THEN 'silver'
        ELSE 'bronze'
      END,
      updated_at = now()
    WHERE user_id = NEW.customer_id;
  ELSE
    -- Create initial loyalty account
    INSERT INTO public.loyalty_points (
      user_id,
      points_balance,
      lifetime_points,
      orders_count,
      last_order_at
    ) VALUES (
      NEW.customer_id,
      v_points,
      v_points,
      1,
      now()
    );
  END IF;

  -- Log transaction
  INSERT INTO public.loyalty_ledger (
    user_id,
    order_id,
    points_amount,
    transaction_type,
    description,
    balance_after
  ) VALUES (
    NEW.customer_id,
    NEW.id,
    v_points,
    'order',
    'Points earned from order ' || NEW.id,
    (SELECT points_balance FROM public.loyalty_points WHERE user_id = NEW.customer_id)
  );

  RETURN NEW;
END;
$$;
