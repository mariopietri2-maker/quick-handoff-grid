import { supabase } from '@/integrations/supabase/client';
import { resolveMobileFlavor, type MobileAppFlavor } from '@/lib/mobileApp';

/**
 * Align profiles.role with the native shell the user is in:
 * - customer app → customer
 * - driver app → driver (pending approval via is_active=false)
 */
export async function syncRoleForMobileShell(
  flavor?: MobileAppFlavor,
): Promise<{ ok: boolean; role?: string; error?: string }> {
  const app = flavor ?? (await resolveMobileFlavor());
  if (app !== 'customer' && app !== 'driver') {
    return { ok: true };
  }
  const { data, error } = await (supabase as any).rpc('sync_app_role', { p_app: app });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, role: (data as any)?.role };
}
