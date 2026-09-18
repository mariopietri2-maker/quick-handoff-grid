import { Suspense } from 'react';
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
  const native = isCapacitorNative();

  // Dedicated app flavors always go to their home (customer/driver/store shells).
  if (flavorReady && (flavor === 'customer' || flavor === 'driver' || flavor === 'store')) {
    return <Navigate to={mobileHomePath(flavor)} replace />;
  }

  if (!flavorReady || loading || (user && !profile)) {
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
