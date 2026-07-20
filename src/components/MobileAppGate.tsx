import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  envMobileFlavor,
  flavorFromAppId,
  isCustomerPath,
  isDriverPath,
  mobileHomePath,
  type MobileAppFlavor,
} from '@/lib/mobileApp';

function BootSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

/**
 * Keeps customer/driver native shells on their intended routes.
 *
 * Important: redirects happen at render time via <Navigate>, so the marketing
 * Index at `/` never paints for one frame before a useEffect redirect.
 */
export function MobileAppGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [flavor, setFlavor] = useState<MobileAppFlavor>(envMobileFlavor());
  const [flavorReady, setFlavorReady] = useState(
    () => envMobileFlavor() !== 'shared' || !Capacitor.isNativePlatform(),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fromEnv = envMobileFlavor();
      if (fromEnv !== 'shared') {
        if (!cancelled) {
          setFlavor(fromEnv);
          setFlavorReady(true);
        }
        return;
      }
      if (!Capacitor.isNativePlatform()) {
        if (!cancelled) setFlavorReady(true);
        return;
      }
      try {
        const info = await CapApp.getInfo();
        if (!cancelled) {
          setFlavor(flavorFromAppId(info.id));
          setFlavorReady(true);
        }
      } catch {
        if (!cancelled) setFlavorReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!flavorReady) {
    return <BootSpinner />;
  }

  if (flavor === 'shared') {
    return <>{children}</>;
  }

  const path = location.pathname;
  const home = mobileHomePath(flavor);

  if (flavor === 'customer') {
    if (path === '/' || !isCustomerPath(path)) {
      return <Navigate to={home} replace />;
    }
  }

  if (flavor === 'driver') {
    if (!isDriverPath(path)) {
      // `/` and other foreign routes go straight to /driver.
      // ProtectedRoute shows a spinner, then DriverApp or /auth — never Index.
      return <Navigate to={home} replace />;
    }
  }

  return <>{children}</>;
}
