import React, { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/hooks/useAuth';
import { mobileHomePath, useMobileFlavor } from '@/lib/mobileApp';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const Index = lazyWithRetry(() => import('@/pages/Index'));

function BootSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

/** True only inside a real Capacitor native binary — not mobile Chrome / PWA. */
function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export default function RootEntry() {
  const { user, profile, loading, isAdmin, isSupport, isStore } = useAuth();
  const { flavor, ready: flavorReady } = useMobileFlavor();
  // Explicit store entry (PWA / deep link / query) — never show marketing site.
  const queryApp = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('app')
    : null;
  const forceStore = queryApp === 'store' || flavor === 'store';
  const native = isCapacitorNative();
  const [bootTimedOut, setBootTimedOut] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setBootTimedOut(true), 6000);
    return () => window.clearTimeout(t);
  }, []);

  // Store role / store PWA always wins over marketing homepage.
  if (!loading && user && (profile?.role === 'store' || isStore || forceStore)) {
    return <Navigate to="/store" replace />;
  }
  if (forceStore && !loading && !user) {
    return <Navigate to="/auth?next=/store" replace />;
  }

  // Dedicated app flavors always go to their home (customer/driver/store shells).
  if (flavorReady && (flavor === 'customer' || flavor === 'driver' || flavor === 'store')) {
    return <Navigate to={mobileHomePath(flavor)} replace />;
  }

  if (!bootTimedOut && (!flavorReady || loading || (user && !profile))) {
    return <BootSpinner />;
  }

  // Logged-in role homes (web + native).
  if (user && profile) {
    if (!isAdmin && !isSupport) {
      if (profile.role === 'm') return <Navigate to="/driver" replace />;
      if (profile.role === 'driver') return <Navigate to="/driver" replace />;
      if (profile.role === 'store' || isStore) return <Navigate to="/store" replace />;
      // Customers: native customer app → /order; browser keeps marketing home.
      if (native) return <Navigate to="/order" replace />;
      return (
        <Suspense fallback={<BootSpinner />}>
          <Index />
        </Suspense>
      );
    }
  }

  // Anonymous browser → marketing homepage. Native Capacitor only → /order.
  if (native) {
    return <Navigate to="/order" replace />;
  }

  return (
    <Suspense fallback={<BootSpinner />}>
      <Index />
    </Suspense>
  );
}
