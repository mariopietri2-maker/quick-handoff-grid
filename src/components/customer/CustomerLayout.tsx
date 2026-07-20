import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import CustomerBottomNav from '@/components/customer/CustomerBottomNav';

/**
 * Shared customer shell: scrollable viewport (required on Capacitor where
 * html.is-native locks #root overflow) + persistent bottom tabs.
 */
export default function CustomerLayout() {
  const cfg = useCustomerAppConfig();
  const location = useLocation();

  // Honor /order#nearby-stores deep links after route changes
  useEffect(() => {
    if (location.pathname !== '/order') return;
    if (location.hash !== '#nearby-stores') return;
    const t = window.setTimeout(() => {
      document.getElementById('nearby-stores')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(t);
  }, [location.pathname, location.hash]);

  return (
    <div
      className="customer-shell customer-scroll h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain"
      style={{
        ['--c-accent' as any]: cfg.branding.accent_hsl,
        ['--c-accent-dark' as any]: cfg.branding.accent_dark_hsl,
        ['--c-accent-soft' as any]: `${cfg.branding.accent_hsl} / 0.10`,
      }}
    >
      <div className="min-h-full pb-24">
        <Outlet />
      </div>
      <CustomerBottomNav />
    </div>
  );
}
