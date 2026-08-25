-- Marketplace/delivery split + dynamic delivery ETA + per-store fulfilment + menu seeding.
--
-- 1) stores.fulfilment_mode: 'platform' = Fresh drivers deliver (shows "Delivered by Fresh"),
--    'store' = store delivers with its own fleet (no label shown).
-- 2) platform_settings: delivery_enabled master switch (launch marketplace without delivery),
--    admin-configurable ETA base range, hard cap enforced by supply/demand logic (max 50).
-- 3) get_dynamic_delivery_eta(): system-computed ETA range — short when enough drivers are
--    on shift for current demand, higher when not, always clamped to the configured cap.
-- 4) Idempotent seed of random-but-sensible menu items into every existing store.

-- ============================================================
-- 1. Schema
-- ============================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS fulfilment_mode text NOT NULL DEFAULT 'platform';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_fulfilment_mode_check'
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_fulfilment_mode_check CHECK (fulfilment_mode IN ('platform', 'store'));
  END IF;
END$$;

COMMENT ON COLUMN public.stores.fulfilment_mode IS 'Who delivers orders: platform = Fresh fleet (shows "Delivered by Fresh"), store = own delivery (no label)';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eta_min_minutes integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS eta_max_minutes integer NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS eta_max_cap_minutes integer NOT NULL DEFAULT 50;

COMMENT ON COLUMN public.platform_settings.delivery_enabled IS 'Master switch: false = marketplace-only launch (no delivery anywhere)';
COMMENT ON COLUMN public.platform_settings.eta_min_minutes IS 'Admin-configured lower bound of the delivery ETA range';
COMMENT ON COLUMN public.platform_settings.eta_max_minutes IS 'Admin-configured upper bound of the delivery ETA range before demand adjustment';
COMMENT ON COLUMN public.platform_settings.eta_max_cap_minutes IS 'Hard ceiling the system may never exceed when raising ETA under high demand';

-- ============================================================
-- 2. Public settings RPC — expose new fields to all clients
-- ============================================================

DROP FUNCTION IF EXISTS public.get_platform_settings_public();
CREATE OR REPLACE FUNCTION public.get_platform_settings_public()
RETURNS TABLE(
  platform_service_fee numeric,
  max_cash_cap numeric,
  show_stores_on_driver_map boolean,
  assignment_mode text,
  maintenance_mode boolean,
  maintenance_message text,
  customer_base_fee numeric,
  customer_per_km_fee numeric,
  max_stacked_orders integer,
  stacking_enabled boolean,
  dist_offer_timeout_seconds integer,
  wait_bonus_rate_per_min numeric,
  wait_bonus_grace_minutes integer,
  wait_bonus_cap numeric,
  card_payments_enabled boolean,
  stripe_publishable_key text,
  delivery_enabled boolean,
  eta_min_minutes integer,
  eta_max_minutes integer,
  eta_max_cap_minutes integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    platform_service_fee,
    max_cash_cap,
    show_stores_on_driver_map,
    assignment_mode,
    maintenance_mode,
    maintenance_message,
    customer_base_fee,
    customer_per_km_fee,
    max_stacked_orders,
    stacking_enabled,
    dist_offer_timeout_seconds,
    wait_bonus_rate_per_min,
    wait_bonus_grace_minutes,
    wait_bonus_cap,
    card_payments_enabled,
    CASE WHEN card_payments_enabled THEN stripe_publishable_key ELSE NULL END AS stripe_publishable_key,
    delivery_enabled,
    eta_min_minutes,
    eta_max_minutes,
    eta_max_cap_minutes
  FROM public.platform_settings
  WHERE id = 1
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_platform_settings_public() TO anon, authenticated, service_role;

-- ============================================================
-- 3. Dynamic ETA — supply (drivers on shift) vs demand (open orders)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dynamic_delivery_eta(p_prep_buffer integer DEFAULT 0)
RETURNS TABLE (eta_min integer, eta_max integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_min   integer;
  v_base_max   integer;
  v_hard_cap   integer;
  v_supply     integer;
  v_demand     integer;
  v_deficit    integer;
  v_extra      integer;
  v_buffer     integer;
BEGIN
  SELECT ps.eta_min_minutes,
         ps.eta_max_minutes,
         ps.eta_max_cap_minutes
    INTO v_base_min, v_base_max, v_hard_cap
    FROM public.platform_settings ps
   WHERE ps.id = 1;

  -- Sensible fallbacks if settings row is missing
  v_base_min := COALESCE(v_base_min, 25);
  v_base_max := GREATEST(COALESCE(v_base_max, 35), v_base_min);
  v_hard_cap := GREATEST(COALESCE(v_hard_cap, 50), v_base_max);

  -- Supply: drivers on shift, not on break, location ping fresh (< 5 min)
  SELECT count(*)::integer INTO v_supply
    FROM public.driver_state ds
    JOIN public.driver_locations dl ON dl.driver_id = ds.driver_id
   WHERE ds.on_break = false
     AND ds.shift_started_at IS NOT NULL
     AND dl.updated_at > now() - interval '5 minutes';

  -- Demand: live orders right now
  SELECT count(*)::integer INTO v_demand
    FROM public.orders o
   WHERE o.status NOT IN ('delivered', 'cancelled');

  v_extra := 0;
  IF v_demand > 0 THEN
    -- Each driver comfortably covers ~2 concurrent orders; beyond that start stretching
    v_deficit := v_demand - (v_supply * 2);
    IF v_deficit > 0 THEN
      v_extra := LEAST(v_hard_cap - v_base_max, CEIL(v_deficit * 2.5)::integer);
      v_extra := GREATEST(v_extra, 0);
    END IF;
  END IF;

  v_buffer := COALESCE(p_prep_buffer, 0);

  eta_min := LEAST(v_base_min + v_extra + v_buffer, v_hard_cap);
  eta_max := LEAST(v_base_max + v_extra + v_buffer, v_hard_cap);
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dynamic_delivery_eta(integer) TO anon, authenticated, service_role;

-- ============================================================
-- 4. stores_public — expose fulfilment_mode
-- ============================================================

DROP VIEW IF EXISTS public.stores_public CASCADE;

CREATE VIEW public.stores_public
WITH (security_invoker = false) AS
SELECT
  id,
  owner_id,
  name,
  address,
  latitude,
  longitude,
  image_url,
  cover_image_url,
  tagline,
  promo_badge,
  highlight_color,
  is_active,
  busy_mode,
  prep_buffer_minutes,
  opening_hours,
  holiday_dates,
  promotion_status,
  promotion_starts_at,
  promotion_ends_at,
  covers_delivery_fee,
  fulfilment_mode,
  created_at,
  updated_at
FROM public.stores
WHERE is_active = true
  AND suspended_at IS NULL;

GRANT SELECT ON public.stores_public TO anon, authenticated, service_role;

-- ============================================================
-- 5. Seed random items into every existing store (idempotent)
-- ============================================================

-- Asian store
INSERT INTO public.menu_items (store_id, name, description, category, price, is_available)
SELECT s.id, v.name, v.description, v.category, v.price, true
FROM public.stores s
CROSS JOIN (VALUES
  ('Chicken Pad Thai', 'Σοταρισμένα noodles με κοτόπουλο, αυγό, φιστίκια και lime', 'Main', 8.90),
  ('Beef Fried Rice', 'Τηγανητό ρύζι με μοσχάρι, λαχανικά wok και σάλτσα σόγιας', 'Main', 9.40),
  ('Spring Rolls (4 τεμ)', 'Τραγανά χειροποίητα rolls με λαχανικά και γλυκό-chili dip', 'Starters', 4.50),
  ('Chicken Teriyaki', 'Κοτόπουλο teriyaki με ρύζι jasmine και σουσάμι', 'Main', 9.90),
  ('Spicy Beef Noodles', 'Νoodles με μοσχάρι και πικάντικη σάλτσα Sichuan', 'Main', 10.40),
  ('Edamame', 'Ατμισμένα edamame με θαλασσινό αλάτι', 'Starters', 3.90),
  ('Miso Soup', 'Παραδοσιακή σούπα miso με tofu και φύκια', 'Soups', 3.50),
  ('Mango Sticky Rice', 'Γλυκό ρύζι με φρέσκο μάνγκο και καρύδα', 'Desserts', 5.20),
  ('Coca-Cola 330ml', 'Παγωμένο αναψυκτικό', 'Drinks', 1.80),
  ('Homemade Iced Tea', 'Φυσικό παγωμένο τσάι λεμονιού', 'Drinks', 2.60)
) AS v(name, description, category, price)
WHERE s.name ILIKE '%asia%'
  AND NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.store_id = s.id AND m.name = v.name);

-- Café
INSERT INTO public.menu_items (store_id, name, description, category, price, is_available)
SELECT s.id, v.name, v.description, v.category, v.price, true
FROM public.stores s
CROSS JOIN (VALUES
  ('Espresso', 'Διπλός espresso από φρεσκοκαβουργμένο blend', 'Coffee', 1.80),
  ('Freddo Cappuccino', 'Δροσερό freddo με πλούσιο αφρόγαλα', 'Coffee', 3.20),
  ('Cappuccino', 'Κλασικός cappuccino με μεταξένιο foam', 'Coffee', 2.80),
  ('Greek Coffee', 'Παραδοσιακός ελληνικός καφές στο briki', 'Coffee', 2.20),
  ('Fresh Orange Juice', '100% φυσικός χυμός πορτοκάλι', 'Juices', 3.80),
  ('Croissant Butter', 'Βουτυρένιο κρουασάν φρυγανισμένο', 'Bakery', 2.10),
  ('Club Sandwich', 'Τοστ με κοτόπουλο, μπέικον, τυρί και λαχανικά', 'Snacks', 6.50),
  ('Cheese Pie', 'Σπιτική τυρόπιτα με φύλλο kataifi', 'Snacks', 3.40),
  ('Bagel with Cream Cheese', 'Bagel με cream cheese και σολομό', 'Snacks', 5.90),
  ('Chocolate Brownie', 'Ζουμερό brownie με chunks σοκολάτας', 'Desserts', 3.30),
  ('Water 500ml', 'Φυσικό μεταλλικό νερό', 'Drinks', 0.80)
) AS v(name, description, category, price)
WHERE s.name ILIKE '%cafe%'
  AND NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.store_id = s.id AND m.name = v.name);

-- Pizzeria
INSERT INTO public.menu_items (store_id, name, description, category, price, is_available)
SELECT s.id, v.name, v.description, v.category, v.price, true
FROM public.stores s
CROSS JOIN (VALUES
  ('Margherita', 'Σάλτσα τομάτας, mozzarella, βασιλικός', 'Pizza', 7.50),
  ('Diavola', 'Πικάντικο salami, mozzarella, chili oil', 'Pizza', 9.20),
  ('Quattro Formaggi', 'Μοτσαρέλα, gorgonzola, παρμεζάνα, φέτα', 'Pizza', 9.80),
  ('Prosciutto e Funghi', 'Ζαμπόν, μανιτάρια, mozzarella', 'Pizza', 8.90),
  ('Capricciosa', 'Ζαμπόν, μανιτάρια, αγκινάρες, ελιές', 'Pizza', 9.60),
  ('Calzone Classico', 'Ζύμη πίτσας γεμιστή με ζαμπόν, μοτσαρέλα και τομάτα', 'Pizza', 8.70),
  ('Garlic Bread', 'Ψωμί σκόρδου με μαϊντανό και ελαιόλαδο', 'Sides', 3.20),
  ('Caesar Salad', 'Ρomaine, κοτόπουλο, croutons, παρμεζάνα, Caesar dressing', 'Salads', 7.20),
  ('Tiramisu', 'Ιταλικό tiramisu σπιτικό', 'Desserts', 4.50),
  ('Coca-Cola 500ml', 'Παγωμένο αναψυκτικό', 'Drinks', 2.40),
  ('Peroni 330ml', 'Ιταλική lager', 'Drinks', 3.50)
) AS v(name, description, category, price)
WHERE s.name ILIKE '%pizza%'
  AND NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.store_id = s.id AND m.name = v.name);

-- Souvlaki place
INSERT INTO public.menu_items (store_id, name, description, category, price, is_available)
SELECT s.id, v.name, v.description, v.category, v.price, true
FROM public.stores s
CROSS JOIN (VALUES
  ('Pork Souvlaki Pita', 'Χοιρινό souvlaki με πατάτες, τομάτα, κρεμμύδι, tzatziki', 'Pita', 4.20),
  ('Chicken Souvlaki Pita', 'Κοτόπουλο souvlaki με πατάτες και special sauce', 'Pita', 4.20),
  ('Gyros Pork Pita', 'Χοιρινό gyros με όλα του', 'Pita', 4.00),
  ('Gyros Chicken Pita', 'Κοτόπουλο gyros με tzatziki και τομάτα', 'Pita', 4.00),
  ('Mixed Grill Platter', 'Μερίδα mixed grill με πατάτες και πίτα', 'Plates', 12.90),
  ('Souvlaki Merida (4 skewers)', 'Μερίδα souvlaki με ψωμί, πατάτες και σαλάτα', 'Plates', 9.80),
  ('French Fries', 'Τραγανές τηγανητές πατάτες', 'Sides', 2.80),
  ('Greek Salad', 'Ντομάτα, αγγούρι, ελιές, φέτα, ελαιόλαδο', 'Salads', 5.50),
  ('Tzatziki & Pita', 'Σπιτικό τζατζίκι με ζεστή πίτα', 'Sides', 3.80),
  ('Feta Cheese Dip', 'Κρεμώδης φέτα με ελαιόλαδο και ρίγανη', 'Sides', 4.20),
  ('Lemonade', 'Φρέσκια λεμονιά', 'Drinks', 2.50),
  ('Coca-Cola 330ml', 'Παγωμένο αναψυκτικό', 'Drinks', 1.80)
) AS v(name, description, category, price)
WHERE s.name ILIKE '%souvlaki%'
  AND NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.store_id = s.id AND m.name = v.name);

-- Grill house
INSERT INTO public.menu_items (store_id, name, description, category, price, is_available)
SELECT s.id, v.name, v.description, v.category, v.price, true
FROM public.stores s
CROSS JOIN (VALUES
  ('Beef Burger Classic', '200g μοσχαρίσιο burger, cheddar, καραμελωμένο κρεμμύδι', 'Burgers', 8.50),
  ('BBQ Bacon Burger', 'Burger με bbq sauce, μπέικον και onion rings', 'Burgers', 9.50),
  ('Grilled Chicken Plate', 'Σχάρα κοτόπουλο με ρύζι και σαλάτα', 'Plates', 11.50),
  ('Lamb Chops (4 τεμ)', 'Παιδάκια αρνίσια στα κάρβουνα με λεμονάτες πατάτες', 'Plates', 15.90),
  ('Mixed Grill for Two', 'Ποικιλία κρεάτων για δύο με συνοδευτικά', 'Plates', 24.90),
  ('Pork Chop', 'Χοιρινή μπριζόλα σχάρας με πατάτες', 'Plates', 12.50),
  ('Onion Rings', 'Τραγανά onion rings με dip', 'Sides', 3.50),
  ('Coleslaw', 'Φρέσκια coleslaw σαλάτα', 'Sides', 2.90),
  ('Halloumi Fries', 'Τηγανητό halloumi με honey dip', 'Sides', 5.20),
  ('Vanilla Milkshake', 'Κρεμώδες milkshake βανίλιας', 'Drinks', 4.50),
  ('Coca-Cola 500ml', 'Παγωμένο αναψυκτικό', 'Drinks', 2.40)
) AS v(name, description, category, price)
WHERE s.name ILIKE '%grill%'
  AND NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.store_id = s.id AND m.name = v.name);
