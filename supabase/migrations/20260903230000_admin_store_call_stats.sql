-- Admin monitoring for the N-store call trial (open/accepted/closed stats).
-- store_driver_calls has no admin SELECT policy, so stats go through this
-- SECURITY DEFINER RPC guarded to admins via user_roles (same pattern as
-- admin_list_call_roles). One JSON blob = single round trip for the panel.

CREATE OR REPLACE FUNCTION public.admin_store_call_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $fn$
DECLARE
  v_stats jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT jsonb_build_object(
    'live_open', (SELECT count(*) FROM public.store_driver_calls WHERE status = 'open'),
    'live_accepted', (SELECT count(*) FROM public.store_driver_calls WHERE status = 'accepted'),
    'today_total', (SELECT count(*) FROM public.store_driver_calls WHERE created_at >= date_trunc('day', now())),
    'today_accepted', (SELECT count(*) FROM public.store_driver_calls WHERE status = 'accepted' AND created_at >= date_trunc('day', now())),
    'week_total', (SELECT count(*) FROM public.store_driver_calls WHERE created_at >= now() - interval '7 days'),
    'week_accepted', (SELECT count(*) FROM public.store_driver_calls WHERE status = 'accepted' AND created_at >= now() - interval '7 days'),
    'avg_accept_seconds_7d', (
      SELECT round(avg(extract(epoch from (accepted_at - created_at))))
      FROM public.store_driver_calls
      WHERE status = 'accepted' AND accepted_at IS NOT NULL AND created_at >= now() - interval '7 days'
    ),
    'recent', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT c.id, s.name AS store_name, c.status,
               c.created_at, c.accepted_at,
               (SELECT p.full_name FROM public.profiles p WHERE p.user_id = c.accepted_by) AS driver_name,
               CASE WHEN c.accepted_at IS NOT NULL
                 THEN round(extract(epoch from (c.accepted_at - c.created_at)))
                 ELSE NULL END AS seconds_to_accept
        FROM public.store_driver_calls c
        LEFT JOIN public.stores s ON s.id = c.store_id
        ORDER BY c.created_at DESC
        LIMIT 25
      ) t
    ), '[]'::jsonb)
  ) INTO v_stats;
  RETURN v_stats;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.admin_store_call_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_store_call_stats() TO authenticated;
