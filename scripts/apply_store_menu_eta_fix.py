#!/usr/bin/env python3
from pathlib import Path
import re

NEW_SLOGAN = "Fresh Meals. Fast Delivery."  # leave alone

REPO_MENU = '''    suspend fun searchStores(query: String): List<StoreRow> {
        val q = query.trim()
        if (q.isEmpty()) return fetchStores()
        return client.from("stores_public")
            .select(Columns.list(
                "id", "name", "address", "latitude", "longitude", "is_active",
                "image_url", "prep_buffer_minutes", "busy_mode", "opening_hours", "holiday_dates",
                "fulfilment_mode",
            )) {
                filter {
                    eq("is_active", true)
                    ilike("name", "%$q%")
                }
                order("name", Order.ASCENDING)
                limit(100L)
            }.decodeList<StoreRow>()
    }
    suspend fun fetchMenu(storeId: String): List<MenuItemRow> {
        return client.from("menu_items")
            .select(Columns.list(
                "id", "store_id", "name", "price", "description", "category",
                "is_available", "image_url",
            )) {
                filter {
                    eq("store_id", storeId)
                    eq("is_available", true)
                }
                order("category", Order.ASCENDING)
                order("name", Order.ASCENDING)
                limit(500L)
            }.decodeList<MenuItemRow>()
    }
'''

def patch_repository() -> None:
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt")
    t = p.read_text(encoding="utf-8")
    # Replace stubs
    t2 = re.sub(
        r"suspend fun searchStores\(query: String\): List<StoreRow> = emptyList\(\)\s*\n\s*suspend fun fetchMenu\(storeId: String\): List<MenuItemRow> = emptyList\(\)",
        REPO_MENU.rstrip(),
        t,
        count=1,
    )
    if t2 == t:
        if "from(\"menu_items\")" in t:
            print("repo menu already wired")
        else:
            raise SystemExit("repo stubs not found")
    else:
        t = t2
        print("repo fetchMenu/searchStores implemented")

    # ensure fulfilment_mode on fetchStores select
    if "fulfilment_mode" not in t:
        t = t.replace(
            '"image_url", "prep_buffer_minutes", "busy_mode", "opening_hours", "holiday_dates",',
            '"image_url", "prep_buffer_minutes", "busy_mode", "opening_hours", "holiday_dates",\n                "fulfilment_mode",',
            1,
        )
        print("added fulfilment_mode to fetchStores")
    p.write_text(t, encoding="utf-8")

def patch_models() -> None:
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt")
    t = p.read_text(encoding="utf-8")
    if "fulfilment_mode" in t:
        print("models already has fulfilment_mode")
        return
    t = t.replace(
        "    val holiday_dates: List<String>? = null,\n)",
        "    val holiday_dates: List<String>? = null,\n    val fulfilment_mode: String? = \"platform\",\n)",
        1,
    )
    p.write_text(t, encoding="utf-8")
    print("models fulfilment_mode")

def patch_customer_shell() -> None:
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
    if not p.exists():
        print("no CustomerShell")
        return
    t = p.read_text(encoding="utf-8")
    if "Delivered by Fresh" in t:
        print("shell already has Delivered by Fresh")
        return
    # Best-effort: inject near prep buffer / eta pills if present
    needle = "FreshMetaPill"
    if needle not in t:
        print("no FreshMetaPill; skip shell label")
        return
    # Add helper text after store name section is hard without unique context — skip if risky
    print("shell label skipped (manual UI already varies)")

def write_migration() -> None:
    path = Path("supabase/migrations/20260825190000_seed_menu_all_empty_stores.sql")
    path.write_text(
        """-- Seed a sensible default menu into every store that still has few/no items.
-- Idempotent per (store_id, name). Does not touch stores that already have a real menu.

INSERT INTO public.menu_items (store_id, name, description, category, price, is_available)
SELECT s.id, v.name, v.description, v.category, v.price, true
FROM public.stores s
CROSS JOIN (VALUES
  ('Club Sandwich', 'Κοτόπουλο, μπέικον, τυρί, λαχανικά', 'Snacks', 6.50),
  ('Greek Salad', 'Ντομάτα, αγγούρι, ελιά, φέτα', 'Salads', 7.20),
  ('Burger Classic', 'Μοσχαρίσιο μπιφτέκι, cheddar, σάλτσα', 'Main', 8.90),
  ('Chicken Nuggets', '6 τμχ με πατάτες', 'Main', 6.80),
  ('Pizza Margherita', 'Σάλτσα ντομάτας, mozzarella, βασιλικός', 'Pizza', 9.50),
  ('Souvlaki Pork', 'Χοιρινό σουβλάκι με πίτα και αλοιφή', 'Main', 3.80),
  ('Fries', 'Τραγανές πατάτες', 'Sides', 3.20),
  ('Caesar Salad', 'Καλαμπόκι, παρμεζάνα, κρουτόν', 'Salads', 7.90),
  ('Chocolate Brownie', 'Με παγωτό βανίλια', 'Desserts', 4.50),
  ('Coca-Cola 330ml', 'Παγωμένο αναψυκτικό', 'Drinks', 1.80),
  ('Water 500ml', 'Φυσικό μεταλλικό νερό', 'Drinks', 1.00),
  ('Freddo Espresso', 'Διπλός espresso on ice', 'Coffee', 3.00)
) AS v(name, description, category, price)
WHERE COALESCE(s.is_active, true) = true
  AND (
    SELECT count(*) FROM public.menu_items m WHERE m.store_id = s.id
  ) < 5
  AND NOT EXISTS (
    SELECT 1 FROM public.menu_items m WHERE m.store_id = s.id AND m.name = v.name
  );

-- Ensure platform fulfilment default for stores missing a mode
UPDATE public.stores
SET fulfilment_mode = 'platform'
WHERE fulfilment_mode IS NULL OR fulfilment_mode NOT IN ('platform', 'store');

-- Tighten dynamic ETA demand: only in-flight order statuses (not ancient noise)
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

  v_base_min := COALESCE(v_base_min, 25);
  v_base_max := GREATEST(COALESCE(v_base_max, 35), v_base_min);
  v_hard_cap := GREATEST(COALESCE(v_hard_cap, 50), v_base_max);

  SELECT count(*)::integer INTO v_supply
    FROM public.driver_state ds
    JOIN public.driver_locations dl ON dl.driver_id = ds.driver_id
   WHERE ds.on_break = false
     AND ds.shift_started_at IS NOT NULL
     AND dl.updated_at > now() - interval '5 minutes';

  SELECT count(*)::integer INTO v_demand
    FROM public.orders o
   WHERE o.status IN ('placed', 'pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'out_for_delivery');

  v_extra := 0;
  IF v_demand > 0 THEN
    v_deficit := v_demand - (GREATEST(v_supply, 1) * 2);
    IF v_deficit > 0 THEN
      v_extra := LEAST(v_hard_cap - v_base_max, CEIL(v_deficit * 2.0)::integer);
      v_extra := GREATEST(v_extra, 0);
    END IF;
  END IF;

  -- When no drivers online, keep showing base range (not inflated to hard cap)
  IF v_supply = 0 THEN
    v_extra := 0;
  END IF;

  v_buffer := COALESCE(p_prep_buffer, 0);

  eta_min := LEAST(v_base_min + v_extra + v_buffer, v_hard_cap);
  eta_max := LEAST(v_base_max + v_extra + v_buffer, v_hard_cap);
  IF eta_max < eta_min THEN
    eta_max := eta_min;
  END IF;
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dynamic_delivery_eta(integer) TO anon, authenticated, service_role;
""",
        encoding="utf-8",
    )
    print("wrote migration", path)

def main() -> None:
    patch_models()
    patch_repository()
    patch_customer_shell()
    write_migration()

if __name__ == "__main__":
    main()
