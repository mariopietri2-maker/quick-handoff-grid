import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { useT } from '@/lib/i18n';

/**
 * Uber Eats–style floating cart CTA above the bottom tabs.
 * Shown on tab routes when the cart has items.
 */
export default function CustomerFloatingCart() {
  const { itemCount, total, storeName } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();

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
      style={{ bottom: 'calc(var(--customer-tab-h, 58px) + var(--app-safe-bottom))' }}
    >
      <div className="max-w-2xl mx-auto px-3 pb-2">
        <button
          type="button"
          onClick={() => navigate('/checkout')}
          className="pointer-events-auto w-full h-[52px] rounded-xl bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))] flex items-center justify-between px-4 shadow-[0_8px_28px_-6px_hsl(0_0%_0%/0.45)] active:scale-[0.985] transition-transform"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-7 min-w-7 px-2 rounded-md bg-[hsl(var(--c-bg))] text-[hsl(var(--c-text))] text-[13px] font-extrabold flex items-center justify-center tabular-nums">
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
