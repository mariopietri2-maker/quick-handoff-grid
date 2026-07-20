import { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { envMobileFlavor, mobileHomePath } from '@/lib/mobileApp';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const Index = lazyWithRetry(() => import('@/pages/Index'));

function BootSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

/**
 * `/` entry: never paint the marketing landing while we still might redirect
 * to a role home (mobile shells, or a returning logged-in user on web).
 */
export default function RootEntry() {
  const { user, profile, loading, isAdmin, isSupport } = useAuth();
  const flavor = envMobileFlavor();

  // Build-time mobile flavor — sync, no flash of Index.
  if (flavor === 'customer' || flavor === 'driver') {
    return <Navigate to={mobileHomePath(flavor)} replace />;
  }

  // Wait for session before deciding — avoids ~1s marketing flash then hop.
  if (loading || (user && !profile)) {
    return <BootSpinner />;
  }

  if (user && profile) {
    // Admins/support keep the landing (role switcher + app links live there).
    if (!isAdmin && !isSupport) {
      if (profile.role === 'm') return <Navigate to="/m" replace />;
      if (profile.role === 'driver') return <Navigate to="/driver" replace />;
      if (profile.role === 'store') return <Navigate to="/store" replace />;
      return <Navigate to="/order" replace />;
    }
  }

  return (
    <Suspense fallback={<BootSpinner />}>
      <Index />
    </Suspense>
  );
}
