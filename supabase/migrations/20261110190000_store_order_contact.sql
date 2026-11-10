-- Store owners can read the customer phone/name of their own orders.
create or replace function public.store_order_contact(p_order_id uuid)
returns table(full_name text, phone text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cid uuid;
  v_store uuid;
begin
  select customer_id, store_id into v_cid, v_store from orders where id = p_order_id;
  if v_store is null then return; end if;
  if not exists (
    select 1 from stores s
    where s.id = v_store
      and (s.owner_id = v_uid or has_role(v_uid, 'admin'::app_role) or has_role(v_uid, 'm'::app_role))
  ) then
    return;
  end if;
  return query select p.full_name, p.phone from profiles p where p.user_id = v_cid;
end;
$$;
grant execute on function public.store_order_contact(uuid) to authenticated;
