import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, UtensilsCrossed, Receipt, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type TabId = 'discover' | 'food' | 'orders' | 'account';

function getCustomerScroller(): HTMLElement | null {
  return document.querySelector('.customer-scroll');
}

function scrollCustomerTop() {
  const el = getCustomerScroller();
  if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollCustomerToNearby() {
  const target = document.getElementById('nearby-stores');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const el = getCustomerScroller();
  if (el) el.scrollTo({ top: el.scrollHeight * 0.45, behavior: 'smooth' });
  else window.scrollTo({ top: document.body.scrollHeight * 0.45, behavior: 'smooth' });
}

/**
 * Persistent customer bottom navigation.
 * Mounted by CustomerLayout so it stays visible across /order, /orders, /profile.
 */
export default function CustomerBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useT();

  const path = location.pathname;
  const onOrders = path.startsWith('/orders');
  const onProfile = path.startsWith('/profile');
  const onHome = path === '/order' || path.startsWith('/order/');
  const hashFood = onHome && location.hash === '#nearby-stores';

  const active: TabId = onOrders
    ? 'orders'
    : onProfile
      ? 'account'
      : hashFood
        ? 'food'
        : 'discover';

  const goAuth = (next: string) => {
    navigate(`/auth?next=${encodeURIComponent(next)}`);
  };

  const itemClass = (id: TabId) =>
    cn(
      'c-nav-item flex flex-col items-center justify-center gap-0.5 text-[hsl(0,0%,45%)] active:scale-95 transition-transform',
      active === id && 'c-nav-item-active text-[hsl(var(--c-accent,4_90%_47%))]',
    );

  const iconWrap = (id: TabId) =>
    cn(
      'c-nav-icon p-1.5 rounded-xl transition-colors',
      active === id && 'c-nav-icon-active bg-[hsl(var(--c-accent,4_90%_47%)/0.12)]',
    );

  const labelClass = (id: TabId) =>
    cn(
      'c-nav-label text-[10px] font-bold tracking-tight',
      active === id && 'c-nav-label-active font-extrabold',
    );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-2xl border-t border-[hsl(0,0%,92%)] shadow-[0_-8px_24px_-16px_hsl(0_0%_0%/0.10)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Κύρια πλοήγηση"
    >
      <div className="max-w-2xl mx-auto grid grid-cols-4 pt-1.5 pb-1.5">
        <button
          type="button"
          className={itemClass('discover')}
          onClick={() => {
            if (onHome) {
              scrollCustomerTop();
              if (location.hash) navigate('/order', { replace: true });
            } else {
              navigate('/order');
            }
          }}
        >
          <span className={iconWrap('discover')}>
            <Compass className="h-[22px] w-[22px]" strokeWidth={active === 'discover' ? 2.4 : 2} />
          </span>
          <span className={labelClass('discover')}>Ανακάλυψε</span>
        </button>

        <button
          type="button"
          className={itemClass('food')}
          onClick={() => {
            if (onHome) {
              scrollCustomerToNearby();
              if (location.hash !== '#nearby-stores') navigate('/order#nearby-stores', { replace: true });
            } else {
              navigate('/order#nearby-stores');
            }
          }}
        >
          <span className={iconWrap('food')}>
            <UtensilsCrossed className="h-[22px] w-[22px]" strokeWidth={active === 'food' ? 2.4 : 2} />
          </span>
          <span className={labelClass('food')}>Φαγητό</span>
        </button>

        {user ? (
          <Link to="/orders" className={itemClass('orders')}>
            <span className={iconWrap('orders')}>
              <Receipt className="h-[22px] w-[22px]" strokeWidth={active === 'orders' ? 2.4 : 2} />
            </span>
            <span className={labelClass('orders')}>{t('customer.orders')}</span>
          </Link>
        ) : (
          <button type="button" className={itemClass('orders')} onClick={() => goAuth('/orders')}>
            <span className={iconWrap('orders')}>
              <Receipt className="h-[22px] w-[22px]" strokeWidth={2} />
            </span>
            <span className={labelClass('orders')}>{t('customer.orders')}</span>
          </button>
        )}

        {user ? (
          <Link to="/profile" className={itemClass('account')}>
            <span className={iconWrap('account')}>
              <User className="h-[22px] w-[22px]" strokeWidth={active === 'account' ? 2.4 : 2} />
            </span>
            <span className={labelClass('account')}>Λογαριασμός</span>
          </Link>
        ) : (
          <button type="button" className={itemClass('account')} onClick={() => goAuth('/profile')}>
            <span className={iconWrap('account')}>
              <User className="h-[22px] w-[22px]" strokeWidth={2} />
            </span>
            <span className={labelClass('account')}>Λογαριασμός</span>
          </button>
        )}
      </div>
    </nav>
  );
}
