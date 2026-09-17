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

function isAppShell(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
    if (typeof window !== 'undefined' && (window as unknown as { Capacitor?: unknown }).Capacitor) return true;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    if (/;\s*wv\)/i.test(ua)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export default function RootEntry() {
  const { user, profile, loading, isAdmin, isSupport, isStore } = useAuth();
  const { flavor, ready: flavorReady } = useMobileFlavor();
  const appShell = isAppShell();

  if (flavorReady && (flavor === 'customer' || flavor === 'driver' || flavor === 'store')) {
    return <Navigate to={mobileHomePath(flavor)} replace />;
  }

  if (!flavorReady || loading || (user && !profile)) {
    if (appShell && flavorReady && flavor === 'shared') {
      return <Navigate to="/order" replace />;
    }
    return <BootSpinner />;
  }

  if (user && profile) {
    if (!isAdmin && !isSupport) {
      if (profile.role === 'm') return <Navigate to="/driver" replace />;
      if (profile.role === 'driver') return <Navigate to="/driver" replace />;
      if (profile.role === 'store' || isStore) return <Navigate to="/store" replace />;
      return <Navigate to="/order" replace />;
    }
  }

  if (appShell) {
    return <Navigate to="/order" replace />;
  }

  return (
    <Suspense fallback={<BootSpinner />}>
      <Index />
    </Suspense>
  );
}
