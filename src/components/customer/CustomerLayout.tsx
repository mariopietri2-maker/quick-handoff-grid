import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { useCart } from '@/hooks/useCart';
import { customerAccentStyle } from '@/lib/customer-theme';
import CustomerBottomNav from '@/components/customer/CustomerBottomNav';
import CustomerFloatingCart from '@/components/customer/CustomerFloatingCart';

/**
 * Shared customer shell (Uber Eats–style):
 * scrollable viewport + floating cart + persistent bottom tabs.
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

  const padBottom = itemCount > 0 ? 'pb-36' : 'pb-24';

  return (
    <div
      className="customer-shell customer-scroll h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain"
      style={customerAccentStyle(cfg.branding.accent_hsl, cfg.branding.accent_dark_hsl)}
    >
      <div className={`min-h-full ${padBottom}`}>
        <Outlet />
      </div>
      <CustomerFloatingCart />
      <CustomerBottomNav />
    </div>
  );
}
