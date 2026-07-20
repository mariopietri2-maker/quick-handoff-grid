import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  envMobileFlavor,
  flavorFromAppId,
  mobileHomePath,
  type MobileAppFlavor,
} from '@/lib/mobileApp';

/**
 * Keeps customer/driver native shells on their intended routes.
 * - Customer app → /order (and related customer paths)
 * - Driver app → /driver (and /auth when logged out)
 */
export function MobileAppGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [flavor, setFlavor] = useState<MobileAppFlavor>(envMobileFlavor());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fromEnv = envMobileFlavor();
      if (fromEnv !== 'shared') {
        if (!cancelled) setFlavor(fromEnv);
        return;
      }
      if (!Capacitor.isNativePlatform()) return;
      try {
        const info = await CapApp.getInfo();
        if (!cancelled) setFlavor(flavorFromAppId(info.id));
      } catch {
        /* web / unsupported */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (flavor === 'shared') return;
    const path = location.pathname;
    const home = mobileHomePath(flavor);

    if (flavor === 'customer') {
      const allowed =
        path === '/' ||
        path.startsWith('/order') ||
        path.startsWith('/restaurant') ||
        path.startsWith('/checkout') ||
        path.startsWith('/orders') ||
        path.startsWith('/profile') ||
        path.startsWith('/auth') ||
        path.startsWith('/legal');
      if (!allowed) navigate(home, { replace: true });
      else if (path === '/') navigate(home, { replace: true });
    }

    if (flavor === 'driver') {
      const allowed =
        path.startsWith('/driver') ||
        path.startsWith('/auth') ||
        path.startsWith('/legal');
      if (!allowed) navigate(path === '/' ? '/auth' : home, { replace: true });
    }
  }, [flavor, location.pathname, navigate]);

  return <>{children}</>;
}
