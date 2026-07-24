import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Lightweight enter animation for stack screens (restaurant → checkout → tracking).
 * Tab shells stay transition-less so bottom-nav switches feel instant.
 */
export default function NativePageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="native-page-enter min-h-[100dvh]">
      {children}
    </div>
  );
}
