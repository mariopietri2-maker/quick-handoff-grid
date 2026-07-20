import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  ensureNotificationPermission,
  initNotificationChannels,
  showOsNotification,
} from '@/lib/push-notifications';

/**
 * Subscribes the logged-in driver to admin/support notifications.
 * Shows toast + OS notification, but leaves rows unread so they appear in Inbox.
 */
export function useDriverNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    void initNotificationChannels();
    void ensureNotificationPermission();

    // Catch-up toast for unread (do NOT mark read — inbox owns that)
    (async () => {
      const { data } = await (supabase as any)
        .from('driver_notifications')
        .select('id, title, body, severity')
        .eq('driver_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(3);

      (data ?? []).forEach((n: any) => showNotification(n));
    })();

    const channel = supabase
      .channel(`driver-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_notifications',
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          showNotification(payload.new as any);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}

function showNotification(n: { title: string; body: string; severity: string }) {
  const opts = { description: n.body, duration: 10_000 };
  switch (n.severity) {
    case 'urgent':
      toast.error(`🚨 ${n.title}`, { ...opts, duration: 20_000 });
      break;
    case 'warning':
      toast.warning(`⚠️ ${n.title}`, opts);
      break;
    default:
      toast.info(`✉️ ${n.title}`, opts);
  }
  void showOsNotification({
    title: n.title,
    body: n.body,
    tag: 'driver-notif',
    vibrate: n.severity === 'urgent' || n.severity === 'warning',
  });
}
