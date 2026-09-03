import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMobileFlavor } from '@/lib/mobileApp';
import RoleAccessGate from '@/components/RoleAccessGate';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, profile, isAdmin, isSupport, isStore, isM } = useAuth();
  const { flavor, ready: flavorReady } = useMobileFlavor();

  if (!flavorReady || loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground font-heading">Loading...</p>
        </div>
      </div>
    );
  }


  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admins have access to every protected route
  if (isAdmin) return <>{children}</>;

  if (allowedRoles?.includes('admin')) {
    // Never bounce mobile shells to `/` — that loops with MobileAppGate.
    if (flavor === 'driver' || flavor === 'customer') {
      return <RoleAccessGate required={flavor === 'driver' ? 'driver' : 'customer'} />;
    }
    return <Navigate to="/" replace />;
  }

  if (allowedRoles?.includes('support')) {
    if (!isSupport) {
      if (flavor === 'driver') return <RoleAccessGate required="driver" />;
      if (flavor === 'customer') return <RoleAccessGate required="customer" />;
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  // Store portal: allow profile.role=store OR user_roles store membership
  if (allowedRoles?.includes('store') && (isStore || profile?.role === 'store')) {
    return <>{children}</>;
  }

  // Driver app (/driver): allowedRoles is ['driver','m'] — regular drivers MUST pass.
  // This must run BEFORE the m-only check, or every driver hits RoleAccessGate.
  if (
    allowedRoles?.includes('driver') &&
    (profile?.role === 'driver' || profile?.role === 'm' || isM)
  ) {
    return <>{children}</>;
  }

  // Monitor panel (/m) — m-only routes (do not use when 'driver' is also allowed).
  if (allowedRoles?.includes('m') && !allowedRoles.includes('driver')) {
    if (!isM && profile?.role !== 'm') {
      if (flavor === 'driver') return <RoleAccessGate required="driver" />;
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    if (allowedRoles.includes('store')) {
      return <RoleAccessGate required="store" />;
    }
    if (profile.role === 'm') return <Navigate to="/driver" replace />;
    if (profile.role === 'driver') return <Navigate to="/driver" replace />;
    if (profile.role === 'store') return <Navigate to="/store" replace />;

    // Driver/customer APKs: show a gate instead of <Navigate to="/"> which
    // fights MobileAppGate and paints a blank white WebView.
    if (flavor === 'driver' || allowedRoles.includes('driver')) {
      return <RoleAccessGate required="driver" />;
    }
    if (flavor === 'customer') {
      return <RoleAccessGate required="customer" />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
