import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  ensureNotificationPermission,
  initNotificationChannels,
  showOsNotification,
} from '@/lib/push-notifications';
import { isAppActive } from '@/lib/push-register';
import { playNotificationSound } from '@/lib/driver-sound-prefs';

/**
 * Subscribes the logged-in driver to admin/support inbox messages.
 * Feels like email: soft toast + quiet OS channel, opens Μηνύματα on tap.
 * Leaves rows unread so they stay in the inbox list.
 */
export function useDriverNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    void initNotificationChannels();
    void ensureNotificationPermission();

    // Do NOT replay unread inbox rows as OS notifications on mount —
    // that felt like a random burst every time the driver opened the app.

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
          showInboxMail(payload.new as any, navigate);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);
}

function inboxPath(notificationId?: string | null) {
  if (notificationId) return `/driver?tab=inbox&msg=${encodeURIComponent(notificationId)}`;
  return '/driver?tab=inbox';
}

function showInboxMail(
  n: { id?: string; title: string; body: string; severity: string },
  navigate: (path: string) => void,
) {
  const path = inboxPath(n.id);
  const openInbox = () => navigate(path);
  const subject = n.title?.trim() || 'Νέο μήνυμα';
  const preview = (n.body || '').trim().slice(0, 120);

  // Soft in-app banner — email style, not offer alarm.
  toast(`✉️ ${subject}`, {
    description: preview || 'Πάτα για να ανοίξεις το μήνυμα.',
    duration: n.severity === 'urgent' ? 10_000 : 7_000,
    action: {
      label: 'Άνοιγμα',
      onClick: openInbox,
    },
  });

  // Random (or preferred) one-shot SFX while the app is active.
  if (isAppActive()) {
    playNotificationSound();
    void showOsNotification({
      title: 'Νέο μήνυμα',
      body: subject + (preview ? ` — ${preview}` : ''),
      tag: `driver-inbox:${n.id ?? subject}`,
      vibrate: false,
      channelId: 'driver-inbox',
      path,
      extra: {
        type: 'inbox',
        channel: 'driver-inbox',
        notification_id: n.id,
      },
    });
  }
}
