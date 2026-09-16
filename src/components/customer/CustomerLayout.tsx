import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { useCart } from '@/hooks/useCart';
import { customerAccentStyle } from '@/lib/customer-theme';
import CustomerBottomNav from '@/components/customer/CustomerBottomNav';
import CustomerFloatingCart from '@/components/customer/CustomerFloatingCart';

/**
 * Shared customer shell (Uber Eats–style):
 * scrollable viewport + floating cart. Persistent bottom tabs only in the
 * Capacitor app — the desktop web app intentionally has no bottom bar.
 */
export default function CustomerLayout() {
  const cfg = useCustomerAppConfig();
  const location = useLocation();
  const { itemCount } = useCart();

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (location.pathname !== '/order') return;
    if (location.hash === '#browse') {
      const t = window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('customer:focus-browse'));
      }, 60);
      return () => clearTimeout(t);
    }
    if (location.hash === '#nearby-stores') {
      const t = window.setTimeout(() => {
        document.getElementById('nearby-stores')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [location.pathname, location.hash]);

  const padBottom = itemCount > 0
    ? isNative
      ? 'pb-[calc(9rem+var(--app-safe-bottom))]'
      : 'pb-[calc(8rem+var(--app-safe-bottom))]'
    : isNative
      ? 'pb-[calc(6rem+var(--app-safe-bottom))]'
      : 'pb-[calc(5rem+var(--app-safe-bottom))]';

  return (
    <div
      className="customer-shell customer-scroll native-scroll relative h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain"
      style={customerAccentStyle(cfg.branding.accent_hsl, cfg.branding.accent_dark_hsl)}
    >
      {cfg.sections.show_ambient_glow && <div className="c-ambient" aria-hidden />}
      <div className={`relative min-h-full ${padBottom}`}>
        <Outlet />
      </div>
      <CustomerFloatingCart />
      {isNative && <CustomerBottomNav />}
    </div>
  );
}
