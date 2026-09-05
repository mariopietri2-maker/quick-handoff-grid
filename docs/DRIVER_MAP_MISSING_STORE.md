# Driver map: store pin missing (e.g. Pizza Pan)

Driver map only shows stores from `stores_public` that have **latitude + longitude**.

## Checklist in Supabase / Admin

1. Store **is_active = true**
2. **suspended_at** is null
3. **latitude** and **longitude** are set (not null, not 0,0)

### Quick SQL (Supabase SQL editor)

```sql
SELECT id, name, is_active, suspended_at, latitude, longitude, address
FROM public.stores
WHERE name ILIKE '%pan%'
   OR name ILIKE '%pizza%';
```

If lat/lng are null, set them (Ioannina example — use the real address):

```sql
UPDATE public.stores
SET latitude = 39.6670,   -- replace with real coords
    longitude = 20.8500,
    is_active = true,
    suspended_at = null
WHERE name ILIKE '%Pizza Pan%';
```

Or in **Admin → Live map → store edit / geocode** place the pin on the map.

Platform toggle: `platform_settings.show_stores_on_driver_map` must be true.
