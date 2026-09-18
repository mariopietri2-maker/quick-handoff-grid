import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { useCart } from '@/hooks/useCart';
import { customerAccentStyle } from '@/lib/customer-theme';
import CustomerBottomNav from '@/components/customer/CustomerBottomNav';
import CustomerFloatingCart from '@/components/customer/CustomerFloatingCart';

/**
 * Customer shell aligned with native app:
 * scrollable column + floating cart + persistent bottom tabs
 * (Αρχική · Αναζήτηση · Παραγγελίες · Λογαριασμός) on web and Capacitor.
 */
export default function CustomerLayout() {
  const cfg = useCustomerAppConfig();
  const location = useLocation();
  const { itemCount } = useCart();

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

  // Room for bottom tabs (+ floating cart when items in basket)
  const padBottom = itemCount > 0
    ? 'pb-[calc(9rem+var(--app-safe-bottom))]'
    : 'pb-[calc(6rem+var(--app-safe-bottom))]';

  return (
    <div
      className="customer-shell customer-scroll native-scroll relative h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain bg-[hsl(var(--c-bg,0_0%_98%))]"
      style={customerAccentStyle(cfg.branding.accent_hsl, cfg.branding.accent_dark_hsl)}
    >
      {cfg.sections.show_ambient_glow && <div className="c-ambient" aria-hidden />}
      {/* Phone-width column on desktop — closer to native customer */}
      <div className={`relative mx-auto min-h-full w-full max-w-lg ${padBottom}`}>
        <Outlet />
      </div>
      <CustomerFloatingCart />
      <CustomerBottomNav />
    </div>
  );
}
