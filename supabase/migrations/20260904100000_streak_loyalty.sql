-- ════════════════════════════════════════════════════════════════════
-- STREAK LOYALTY ("Streak Hero")
-- ════════════════════════════════════════════════════════════════════
-- Single source of truth: `customer_rewards` (what the web + native apps
-- read). This migration:
--   1. Un-duplicates the award path: `award_loyalty_points()` writes back to
--      `customer_rewards` / `reward_history` (it was redirected to the orphaned
--      `loyalty_points`/`loyalty_ledger` in 20260810000000, freezing the live UI).
--   2. Adds consecutive-day *streak* tracking with flat milestone bonuses
--      (3 / 7 / 14 / 30 days) — the "new & different" twist vs. flat efood points.
--   3. Exposes `get_loyalty_status()` for the native app + web.

-- -------------------------------------------------------------------
-- 1. Streak columns on customer_rewards
-- -------------------------------------------------------------------
ALTER TABLE public.customer_rewards
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_delivered date;

COMMENT ON COLUMN public.customer_rewards.current_streak
  IS 'Consecutive calendar days with at least one delivered order.';
COMMENT ON COLUMN public.customer_rewards.best_streak
  IS 'Longest streak ever reached.';

-- -------------------------------------------------------------------
-- Streak milestone config (flat bonus points awarded at each tier).
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.streak_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_threshold integer NOT NULL UNIQUE,     -- 3 / 7 / 14 / 30
  bonus_points integer NOT NULL,             -- flat bonus awarded when hit
  label text NOT NULL,                       -- e.g. 'Ember', 'Spark', 'Flame', 'Legend'
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.streak_milestones (day_threshold, bonus_points, label) VALUES
  (3,  50,  'Ember'),
  (7,  150, 'Spark'),
  (14, 400, 'Flame'),
  (30, 1000,'Legend')
ON CONFLICT (day_threshold) DO UPDATE
  SET bonus_points = EXCLUDED.bonus_points,
      label = EXCLUDED.label;

ALTER TABLE public.streak_milestones ENABLE ROW LEVEL SECURITY;

-- Everyone can read the milestone table (used to render the progression bar).
DROP POLICY IF EXISTS "Anyone can read streak milestones" ON public.streak_milestones;
CREATE POLICY "Anyone can read streak milestones"
  ON public.streak_milestones FOR SELECT
  USING (true);

-- -------------------------------------------------------------------
-- 2. Re-point the award function at customer_rewards + track streaks.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivered_date date;
  v_streak integer;
  v_new_streak integer;
  v_best integer;
  v_base_points integer;
  v_bonus integer := 0;
  v_reward public.customer_rewards%ROWTYPE;
BEGIN
  -- Only fire on the transition INTO 'delivered'.
  IF NEW.status <> 'delivered' OR OLD.status IS DISTINCT FROM 'delivered' THEN
    RETURN NEW;
  END IF;
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- The calendar day the order was actually delivered (orders has no
  -- dedicated delivered_at column; updated_at is set on the status flip).
  v_delivered_date := COALESCE(NEW.updated_at, now())::date;

  -- Existing streak state (or a fresh row).
  SELECT current_streak, best_streak, streak_last_delivered
    INTO v_streak, v_best, v_reward.streak_last_delivered
    FROM public.customer_rewards
   WHERE user_id = NEW.customer_id;

  IF NOT FOUND THEN
    v_new_streak := 1;
    v_best := 1;
  ELSIF v_reward.streak_last_delivered IS NULL THEN
    v_new_streak := 1;
    v_best := GREATEST(v_best, 1);
  ELSE
    IF v_reward.streak_last_delivered = v_delivered_date THEN
      -- Already delivered today: keep the streak, same-day orders don't stack.
      v_new_streak := v_streak;
    ELSIF v_reward.streak_last_delivered = v_delivered_date - 1 THEN
      -- Consecutive day -> grow the streak.
      v_new_streak := v_streak + 1;
    ELSE
      -- Missed a day -> streak resets to 1.
      v_new_streak := 1;
    END IF;
    v_best := GREATEST(v_best, v_new_streak);
  END IF;

  -- Flat bonus when the new streak exactly hits a milestone.
  SELECT COALESCE(bonus_points, 0)
    INTO v_bonus
    FROM public.streak_milestones
   WHERE day_threshold = v_new_streak;

  -- Base earning: 1 point per whole euro spent (food + delivery + tip),
  -- matching the previous behaviour.
  v_base_points := FLOOR(COALESCE(NEW.total_amount, 0))::integer;
  IF v_base_points < 0 THEN v_base_points := 0; END IF;

  -- Persist rewards (single table of record).
  INSERT INTO public.customer_rewards (
    user_id, points, lifetime_points, current_streak, best_streak,
    streak_last_delivered, tier, updated_at
  ) VALUES (
    NEW.customer_id, v_base_points + v_bonus, v_base_points + v_bonus,
    v_new_streak, v_best,
    COALESCE(v_reward.streak_last_delivered, v_delivered_date),
    'bronze', now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET points = customer_rewards.points + v_base_points + v_bonus,
        lifetime_points = customer_rewards.lifetime_points + v_base_points + v_bonus,
        current_streak = v_new_streak,
        best_streak = v_best,
        streak_last_delivered = CASE
          WHEN customer_rewards.streak_last_delivered = v_delivered_date
            THEN customer_rewards.streak_last_delivered  -- keep original day on same-day repeats
          ELSE v_delivered_date
        END,
        tier = CASE
          WHEN customer_rewards.lifetime_points + v_base_points + v_bonus >= 1000 THEN 'platinum'
          WHEN customer_rewards.lifetime_points + v_base_points + v_bonus >= 500 THEN 'gold'
          WHEN customer_rewards.lifetime_points + v_base_points + v_bonus >= 200 THEN 'silver'
          ELSE 'bronze'
        END,
        updated_at = now();

  -- Base earning ledger entry.
  IF v_base_points > 0 THEN
    INSERT INTO public.reward_history (user_id, order_id, points_change, reason)
    VALUES (NEW.customer_id, NEW.id, v_base_points, 'order_delivered');
  END IF;

  -- Streak bonus ledger entry (only when a milestone was just reached).
  IF v_bonus > 0 THEN
    INSERT INTO public.reward_history (user_id, order_id, points_change, reason)
    VALUES (
      NEW.customer_id,
      NEW.id,
      v_bonus,
      'streak_bonus:' || v_new_streak || ':'
        || COALESCE((SELECT label FROM public.streak_milestones WHERE day_threshold = v_new_streak), 'Milestone')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_points_on_delivery ON public.orders;
CREATE TRIGGER award_points_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.award_loyalty_points();

DROP TRIGGER IF EXISTS award_loyalty_on_delivery ON public.orders;
CREATE TRIGGER award_loyalty_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.award_loyalty_points();

-- -------------------------------------------------------------------
-- 3. Read model for the native app + web: points, tier + streak state.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_loyalty_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.customer_rewards%ROWTYPE;
  v_next record;
  v_next_milestone integer;
  v_next_bonus integer;
  v_next_label text;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row
    FROM public.customer_rewards
   WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    v_result := jsonb_build_object(
      'points', 0,
      'tier', 'bronze',
      'lifetime_points', 0,
      'current_streak', 0,
      'best_streak', 0,
      'streak_last_delivered', to_jsonb(NULL::date),
      'next_milestone_day', 3,
      'next_milestone_bonus', 50,
      'next_milestone_label', 'Ember',
      'is_at_milestone', false
    );
  ELSE
    SELECT * INTO v_next
      FROM public.streak_milestones
     WHERE day_threshold > v_row.current_streak
     ORDER BY day_threshold ASC
     LIMIT 1;

    IF v_next IS NULL THEN
      SELECT * INTO v_next
        FROM public.streak_milestones
       ORDER BY day_threshold DESC
       LIMIT 1;
    END IF;

    v_result := jsonb_build_object(
      'points', v_row.points,
      'tier', v_row.tier,
      'lifetime_points', v_row.lifetime_points,
      'current_streak', v_row.current_streak,
      'best_streak', v_row.best_streak,
      'streak_last_delivered', to_jsonb(v_row.streak_last_delivered),
      'next_milestone_day', COALESCE(v_next.day_threshold, 0),
      'next_milestone_bonus', COALESCE(v_next.bonus_points, 0),
      'next_milestone_label', COALESCE(v_next.label, ''),
      'is_at_milestone', (v_row.current_streak > 0)
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_loyalty_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_loyalty_status() TO authenticated;