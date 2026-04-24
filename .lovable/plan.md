## More Support Tools to Help Drivers

Currently support agents can only chat, set priority/status, copy IDs, call the driver, and use AI suggestions. I'll add **7 concrete action tools** inside the ticket detail view so agents can actually *resolve* driver problems instead of just messaging back and forth.

---

### New Tools (all inside `Εργαλεία Agent` card)

#### 1. 📍 **Locate Driver Live**
- Button "Δες θέση οδηγού" → opens dialog with a Mapbox map showing the driver's last known location from `driver_locations`
- Shows last update timestamp + speed + heading
- Useful for: "where is the driver?" emergencies, accident reports, lost drivers

#### 2. 💰 **Quick Wallet Credit / Compensation**
- Dialog with amount (€) + reason
- Calls existing `admin_adjust_wallet` RPC (need to extend RLS to allow `support` role too, or create new `support_credit_wallet` RPC capped at €20)
- Logs to `wallet_transactions` with type `support_credit`
- Auto-posts a chat message: "Πιστώθηκαν Xeur στο πορτοφόλι σου"
- Useful for: compensating fuel, wait time, customer no-shows

#### 3. 🚨 **Escalate to Emergency Services**
- One-click button (red, confirmation required) for `accident` / SOS tickets
- Opens dialog with pre-filled emergency info (driver name, phone, last location, vehicle plate)
- Quick-dial 112 button
- Marks ticket priority = `sos` and inserts a `fraud_signals`/audit row (or new `emergency_escalations` table)

#### 4. 📢 **Send Push Broadcast to Driver**
- Send a non-chat notification (toast in driver app) for urgent info like "Stop accepting orders in Athens — system issue"
- New table `driver_notifications` (id, driver_id, title, body, severity, read_at, created_at) + realtime subscription on driver app
- Single-driver mode (from ticket) and admin-side broadcast-to-all mode

#### 5. 🎁 **Grant One-Time Bonus**
- Button "Δώσε bonus" → creates entry in `wait_time_bonuses` or `earnings` (bonus column) tied to last delivered order
- Cap €10, requires reason
- Useful for: long waits at store, exceptional service

#### 6. ⛔ **Temporary Suspend / Reactivate Driver**
- Toggle button reading `driver_profiles.is_active` and `suspended_at`
- Currently only admin can flip `is_active` (per `protect_driver_active_status` trigger). I'll relax it: allow `support` role for **temp suspensions** with `suspension_reason` required, and log to `admin_audit_log`
- Auto-posts chat message explaining suspension

#### 7. 🔄 **Reassign / Unassign Order**
- If ticket has `order_id`, button to:
  - **Unassign driver** (sets `driver_id = NULL`, status back to `ready`) → returns order to dispatch
  - **Cancel order** with refund → calls existing `refund_order` RPC
- Useful when driver can't complete (breakdown, accident)

---

### Database Changes (single migration)

```sql
-- 1. Driver notifications table
create table public.driver_notifications (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null,
  title text not null,
  body text not null,
  severity text not null default 'info',  -- info | warning | urgent
  sender_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.driver_notifications enable row level security;
create policy "Drivers read own notifications" on public.driver_notifications
  for select using (auth.uid() = driver_id);
create policy "Drivers mark own notifications read" on public.driver_notifications
  for update using (auth.uid() = driver_id);
create policy "Support/admin send notifications" on public.driver_notifications
  for insert with check (is_support_or_admin(auth.uid()));
alter publication supabase_realtime add table public.driver_notifications;

-- 2. RPC: support_credit_wallet (capped €20)
create or replace function public.support_credit_wallet(
  p_driver_id uuid, p_amount numeric, p_reason text
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_support_or_admin(auth.uid()) then
    raise exception 'Forbidden';
  end if;
  if p_amount <= 0 or p_amount > 20 then
    raise exception 'Amount must be between 0 and 20';
  end if;
  insert into driver_wallets (driver_id) values (p_driver_id)
    on conflict (driver_id) do nothing;
  update driver_wallets
    set available_balance = available_balance + p_amount
    where driver_id = p_driver_id;
  insert into wallet_transactions (driver_id, type, amount, status, description)
    values (p_driver_id, 'support_credit', p_amount, 'completed', p_reason);
end; $$;

-- 3. RPC: support_suspend_driver (temp, with reason)
create or replace function public.support_suspend_driver(
  p_driver_id uuid, p_reason text, p_suspend boolean
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_support_or_admin(auth.uid()) then
    raise exception 'Forbidden';
  end if;
  -- Bypass protect_driver_active_status (security definer runs as owner)
  update driver_profiles
    set is_active = not p_suspend,
        suspended_at = case when p_suspend then now() else null end,
        suspension_reason = case when p_suspend then p_reason else null end
    where user_id = p_driver_id;
end; $$;

-- 4. RPC: support_unassign_order (returns to dispatch)
create or replace function public.support_unassign_order(p_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_support_or_admin(auth.uid()) then raise exception 'Forbidden'; end if;
  update orders set driver_id = null, status = 'ready' where id = p_order_id;
end; $$;

-- 5. RPC: support_grant_bonus (recorded as earning bonus on driver's most-recent delivered order, cap €10)
create or replace function public.support_grant_bonus(
  p_driver_id uuid, p_amount numeric, p_reason text
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_support_or_admin(auth.uid()) then raise exception 'Forbidden'; end if;
  if p_amount <= 0 or p_amount > 10 then raise exception 'Bonus 0-10€'; end if;
  insert into driver_wallets (driver_id) values (p_driver_id) on conflict do nothing;
  update driver_wallets set available_balance = available_balance + p_amount where driver_id = p_driver_id;
  insert into wallet_transactions (driver_id, type, amount, status, description)
    values (p_driver_id, 'support_bonus', p_amount, 'completed', p_reason);
end; $$;
```

### Frontend Changes

**New files**
- `src/components/support/DriverLocationDialog.tsx` — Mapbox map of driver's last `driver_locations` row
- `src/components/support/SupportActionToolbox.tsx` — wraps the 7 buttons + their dialogs (wallet credit, bonus, suspend, broadcast, escalate, reassign), accepts `ticket` prop

**Edited**
- `src/pages/SupportApp.tsx` — replace the inline "Εργαλεία Agent" buttons block with the new `<SupportActionToolbox ticket={activeTicket} driver={driver} />`
- `src/pages/DriverApp.tsx` — subscribe to `driver_notifications` realtime; show a toast (and red banner for `urgent`) when a row arrives; mark `read_at` on dismiss
- `src/integrations/supabase/types.ts` — auto-regen after migration

### Out of Scope (ask later if wanted)
- Full driver-history timeline panel
- Voice call via Twilio
- Bulk broadcast UI (this PR adds backend only — admin UI in a follow-up)

---

**After you approve**, I'll:
1. Run the migration above
2. Build the two new components
3. Wire `DriverApp.tsx` for the realtime notification banner
4. Replace the toolbox section in `SupportApp.tsx`
