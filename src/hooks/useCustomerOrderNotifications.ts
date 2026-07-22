import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  showOrderStatusNotification,
  playStatusUpdateSound,
  requestNotificationPermission,
  showDriverArrivingNotification,
} from '@/lib/notifications';
import { startPushRegistration } from '@/lib/push-register';
import { initNotificationChannels } from '@/lib/push-notifications';
import { openRealtimeChannel } from '@/lib/realtime-channel';

const statusToastLabels: Record<string, string> = {
  picked_up: 'Ο οδηγός έρχεται προς εσένα 🛵',
  delivered: 'Παραδόθηκε 🎉',
  cancelled: 'Η παραγγελία ακυρώθηκε ❌',
};

/**
 * Subscribe to the customer's own order status changes and surface a
 * browser/OS notification + in-app toast + soft chime on every transition.
 * Also registers the device for remote push (FCM) when running in the APK.
 *
 * Prefer mounting once via PushBootstrap (not also in CustomerApp).
 */
export function useCustomerOrderNotifications() {
  const { user } = useAuth();
  const lastStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) return;

    void initNotificationChannels();
    requestNotificationPermission().catch(() => {});
    void startPushRegistration(user.id);

    const channel = openRealtimeChannel(`customer-orders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as { id: string; status: string };
          const prev = lastStatusRef.current.get(next.id);
          if (prev === next.status) return;
          lastStatusRef.current.set(next.id, next.status);
          if (!prev) return; // first sighting — don't notify

          const label = statusToastLabels[next.status];
          if (label) {
            toast(label, { duration: 5000 });
            playStatusUpdateSound();
            // In-app only when foreground — FCM covers background/killed.
            // Avoid stacking OS locals on top of FCM for the same status.
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
              showOrderStatusNotification(next.id, next.status);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}

/**
 * When the live map shows the driver within ~500m of the dropoff during
 * picked_up, fire a one-shot “οδηγός φτάνει” notification.
 */
export function useDriverProximityAlert(opts: {
  orderId: string | null | undefined;
  status: string | null | undefined;
  driverLat: number | null | undefined;
  driverLng: number | null | undefined;
  deliveryLat: number | null | undefined;
  deliveryLng: number | null | undefined;
  radiusM?: number;
}) {
  const firedRef = useRef<string | null>(null);
  const {
    orderId,
    status,
    driverLat,
    driverLng,
    deliveryLat,
    deliveryLng,
    radiusM = 500,
  } = opts;

  useEffect(() => {
    if (!orderId || status !== 'picked_up') return;
    if (driverLat == null || driverLng == null || deliveryLat == null || deliveryLng == null) return;
    if (firedRef.current === orderId) return;

    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(deliveryLat - driverLat);
    const dLng = toRad(deliveryLng - driverLng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(driverLat)) * Math.cos(toRad(deliveryLat)) * Math.sin(dLng / 2) ** 2;
    const distM = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (distM > radiusM) return;

    firedRef.current = orderId;
    toast('Ο οδηγός φτάνει! 📍', { duration: 6000 });
    playStatusUpdateSound();
    showDriverArrivingNotification(orderId);
  }, [orderId, status, driverLat, driverLng, deliveryLat, deliveryLng, radiusM]);
}
