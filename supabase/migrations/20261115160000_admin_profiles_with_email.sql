-- Admin helper: profiles joined with auth.users.email
create or replace function public.admin_profiles_with_email()
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  phone text,
  role text,
  public_code text,
  created_at timestamptz,
  email text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.user_id,
    p.full_name,
    p.phone,
    p.role::text,
    p.public_code,
    p.created_at,
    u.email::text
  from public.profiles p
  left join auth.users u on u.id = p.user_id
  where public.is_admin()
  order by p.created_at desc;
$$;

revoke all on function public.admin_profiles_with_email() from public;
grant execute on function public.admin_profiles_with_email() to authenticated;
