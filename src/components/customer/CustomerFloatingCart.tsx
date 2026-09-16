import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useCart } from '@/hooks/useCart';
import { useT } from '@/lib/i18n';

/**
 * Uber Eats–style floating cart CTA. In the Capacitor app it floats above the
 * bottom tabs; on the desktop web app (no tab bar) it sits at the bottom edge.
 * Shown on tab routes when the cart has items.
 */
export default function CustomerFloatingCart() {
  const { itemCount, total, storeName } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();

  const isNative = Capacitor.isNativePlatform();

  // Restaurant / checkout have their own cart UI
  if (
    location.pathname.startsWith('/restaurant') ||
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/order-tracking')
  ) {
    return null;
  }

  if (itemCount <= 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[55] pointer-events-none"
      style={{
        bottom: isNative
          ? 'calc(var(--customer-tab-h, 58px) + var(--app-safe-bottom))'
          : 'calc(12px + var(--app-safe-bottom))',
      }}
    >
      <div className="max-w-2xl mx-auto px-3 pb-2">
        <button
          type="button"
          onClick={() => navigate('/checkout')}
          className="pointer-events-auto w-full h-[52px] rounded-2xl text-white bg-[linear-gradient(120deg,hsl(24_90%_55%),hsl(343_100%_64%))] flex items-center justify-between px-4 shadow-[0_12px_30px_-8px_hsl(24_100%_55%/0.55)] active:scale-[0.985] transition-transform"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-7 min-w-7 px-2 rounded-md bg-white/20 text-white text-[13px] font-extrabold flex items-center justify-center tabular-nums">
              {itemCount}
            </span>
            <span className="font-heading font-bold text-[14px] truncate">
              {storeName || t('customer.view_cart')}
            </span>
          </div>
          <span className="font-heading font-extrabold text-[14px] tabular-nums shrink-0">
            {total.toFixed(2)}€
          </span>
        </button>
      </div>
    </div>
  );
}
