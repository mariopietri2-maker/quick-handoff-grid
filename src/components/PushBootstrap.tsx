import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerOrderNotifications } from '@/hooks/useCustomerOrderNotifications';
import { useCustomerHasActiveOrder, useCustomerLocation } from '@/hooks/useCustomerLocation';
import { startPushRegistration } from '@/lib/push-register';
import { isCustomerPath, isDriverPath } from '@/lib/mobileApp';

/**
 * Registers push tokens for customer/driver surfaces and mounts customer
 * order-status listeners (including /order-tracking outside CustomerLayout).
 */
export function PushBootstrap() {
  const { user } = useAuth();
  const location = useLocation();
  const onCustomerSurface =
    isCustomerPath(location.pathname) ||
    location.pathname.startsWith('/order-tracking') ||
    location.pathname.startsWith('/checkout');
  const onDriverSurface = isDriverPath(location.pathname);

  useEffect(() => {
    if (!user) return;
    if (!onCustomerSurface && !onDriverSurface) return;
    void startPushRegistration(user.id);
  }, [user, onCustomerSurface, onDriverSurface]);

  if (user && onCustomerSurface) {
    return <CustomerNotifyMount />;
  }
  return null;
}

function CustomerNotifyMount() {
  useCustomerOrderNotifications();
  const hasActiveOrder = useCustomerHasActiveOrder();
  useCustomerLocation(hasActiveOrder);
  return null;
}
