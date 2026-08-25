import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AdminCapability =
  | 'finances'
  | 'users'
  | 'orders'
  | 'settings'
  | 'audit'
  | 'full';

interface AdminPermissionRow {
  scope: string;
  can_manage_finances: boolean;
  can_manage_users: boolean;
  can_manage_orders: boolean;
  can_manage_settings: boolean;
  can_view_audit: boolean;
}

/**
 * Granular admin capabilities.
 * Legacy admins with no `admin_permissions` row keep full access.
 */
export function useAdminPermissions() {
  const { user, isAdmin } = useAuth();
  const [row, setRow] = useState<AdminPermissionRow | null | undefined>(undefined);

  useEffect(() => {
    if (!user || !isAdmin) {
      setRow(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('admin_permissions')
      .select('scope, can_manage_finances, can_manage_users, can_manage_orders, can_manage_settings, can_view_audit')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRow((data as AdminPermissionRow | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);

  const caps = useMemo(() => {
    const loading = isAdmin && row === undefined;
    // No row = full access (backward compatible)
    const full = !isAdmin ? false : row === null || row?.scope === 'full';
    const can = (flag: boolean | undefined) => !!isAdmin && (full || !!flag);

    return {
      loading,
      isFull: full,
      canManageFinances: can(row?.can_manage_finances),
      canManageUsers: can(row?.can_manage_users),
      canManageOrders: can(row?.can_manage_orders),
      canManageSettings: can(row?.can_manage_settings),
      canViewAudit: can(row?.can_view_audit) || full,
      can(capability: AdminCapability) {
        switch (capability) {
          case 'full':
            return full;
          case 'finances':
            return can(row?.can_manage_finances);
          case 'users':
            return can(row?.can_manage_users);
          case 'orders':
            return can(row?.can_manage_orders);
          case 'settings':
            return can(row?.can_manage_settings);
          case 'audit':
            return can(row?.can_view_audit) || full;
          default:
            return false;
        }
      },
    };
  }, [isAdmin, row]);

  return caps;
}

/** Sections that require a specific capability (beyond basic admin). */
export const ADMIN_SECTION_CAPABILITY: Record<string, AdminCapability> = {
  users: 'users',
  support_roles: 'users',
  admin_perms: 'users',
  remote_actions: 'users',
  driver_messages: 'users',
  financials: 'finances',
  store_payables: 'finances',
  driver_payables: 'finances',
  buffer: 'finances',
  platform_cost: 'finances',
  ledger: 'finances',
  surge: 'finances',
  refunds: 'finances',
  store_billing: 'finances',
  store_appearance: 'orders',
  store_photos: 'orders',
  platform_mode: 'settings',
  pricing: 'settings',
  stripe_payments: 'finances',
  feature_flags: 'settings',
  platform_settings: 'settings',
  system_reset: 'settings',
  operational_overrides: 'settings',
  customer_app: 'settings',
  customer_app_config: 'settings',
  api_connections: 'settings',
  audit: 'audit',
};
