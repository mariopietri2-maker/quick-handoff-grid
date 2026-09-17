import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { setPwaManifest, type PwaManifestKind } from '@/lib/pwa';
import { useAuth } from '@/hooks/useAuth';
import { useMobileFlavor } from '@/lib/mobileApp';

/** Keeps <link rel="manifest"> aligned with role / route / native flavor. */
export function PwaManifestSwitcher() {
  const { pathname } = useLocation();
  const { profile, isStore } = useAuth();
  const { flavor } = useMobileFlavor();

  useEffect(() => {
    let kind: PwaManifestKind = 'default';
    if (
      flavor === 'store' ||
      isStore ||
      profile?.role === 'store' ||
      pathname === '/store' ||
      pathname.startsWith('/store/')
    ) {
      kind = 'store';
    } else if (
      flavor === 'customer' ||
      pathname.startsWith('/order') ||
      pathname.startsWith('/restaurant') ||
      pathname.startsWith('/checkout')
    ) {
      kind = 'customer';
    } else if (flavor === 'driver' || pathname.startsWith('/driver')) {
      kind = 'driver';
    }
    setPwaManifest(kind);
  }, [pathname, profile?.role, isStore, flavor]);

  return null;
}
