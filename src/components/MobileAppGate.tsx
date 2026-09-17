import { Navigate, useLocation } from 'react-router-dom';
import {
  isCustomerPath,
  isDriverPath,
  isStorePath,
  mobileHomePath,
  useMobileFlavor,
} from '@/lib/mobileApp';

function BootSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

/** Keeps customer / driver / store native shells on their intended routes. */
export function MobileAppGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { flavor, ready } = useMobileFlavor();

  if (!ready) {
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
      return <Navigate to={home} replace />;
    }
  }

  if (flavor === 'store') {
    if (path === '/' || !isStorePath(path)) {
      return <Navigate to={home} replace />;
    }
  }

  return <>{children}</>;
}
