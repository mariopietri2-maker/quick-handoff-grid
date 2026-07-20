import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, profile, isAdmin, isSupport, isStore, isM } = useAuth();

  if (loading || (user && !profile)) {
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
    return <Navigate to="/" replace />;
  }

  if (allowedRoles?.includes('support')) {
    if (!isSupport) return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  // Role M monitor panel
  if (allowedRoles?.includes('m')) {
    if (!isM && profile?.role !== 'm') return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  // Store portal: allow profile.role=store OR user_roles store membership
  if (allowedRoles?.includes('store') && (isStore || profile?.role === 'store')) {
    return <>{children}</>;
  }

  // Driver app: regular drivers + M (still drivers) can deliver
  if (
    allowedRoles?.includes('driver') &&
    (profile?.role === 'driver' || profile?.role === 'm' || isM)
  ) {
    return <>{children}</>;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    if (profile.role === 'm') return <Navigate to="/m" replace />;
    if (profile.role === 'driver') return <Navigate to="/driver" replace />;
    if (profile.role === 'store') return <Navigate to="/store" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
