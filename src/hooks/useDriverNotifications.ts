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

    // Do NOT replay unread inbox rows as OS notifications on mount —
    // that felt like a random burst every time the driver opened the app.
    // Live INSERTs below still toast + notify.

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

function showNotification(n: { id?: string; title: string; body: string; severity: string }) {
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
    tag: `driver-notif:${n.id ?? n.title}`,
    vibrate: n.severity === 'urgent' || n.severity === 'warning',
  });
}
