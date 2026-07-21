import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { setPwaManifest, type PwaManifestKind } from '@/lib/pwa';

/** Keeps <link rel="manifest"> aligned with the current app surface. */
export function PwaManifestSwitcher() {
  const { pathname } = useLocation();

  useEffect(() => {
    const kind: PwaManifestKind =
      pathname === '/store' || pathname.startsWith('/store/')
        ? 'store'
        : 'default';
    setPwaManifest(kind);
  }, [pathname]);

  return null;
}
