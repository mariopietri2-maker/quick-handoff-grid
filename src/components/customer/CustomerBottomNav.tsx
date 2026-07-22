import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Receipt, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type TabId = 'home' | 'browse' | 'orders' | 'account';

function getCustomerScroller(): HTMLElement | null {
  return document.querySelector('.customer-scroll');
}

function scrollCustomerTop() {
  const el = getCustomerScroller();
  if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Uber Eats–style bottom tabs: Home · Browse · Orders · Account.
 * Mounted by CustomerLayout across /order, /orders, /profile.
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
  const browsing = onHome && location.hash === '#browse';

  const active: TabId = onOrders
    ? 'orders'
    : onProfile
      ? 'account'
      : browsing
        ? 'browse'
        : 'home';

  const goAuth = (next: string) => {
    navigate(`/auth?next=${encodeURIComponent(next)}`);
  };

  const itemClass = (id: TabId) =>
    cn(
      'c-nav-item flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform',
      active === id && 'c-nav-item-active',
    );

  const labelClass = (id: TabId) =>
    cn(
      'c-nav-label text-[10px] font-semibold tracking-tight',
      active === id && 'c-nav-label-active font-extrabold',
    );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 c-nav-bar border-t"
      style={{ paddingBottom: 'var(--app-safe-bottom)' }}
      aria-label="Κύρια πλοήγηση"
    >
      <div className="max-w-2xl mx-auto grid grid-cols-4 h-[58px]">
        <button
          type="button"
          className={itemClass('home')}
          onClick={() => {
            if (onHome) {
              scrollCustomerTop();
              if (location.hash) navigate('/order', { replace: true });
              window.dispatchEvent(new CustomEvent('customer:focus-home'));
            } else {
              navigate('/order');
            }
          }}
        >
          <Home
            className="h-[22px] w-[22px]"
            strokeWidth={active === 'home' ? 2.6 : 2}
            fill={active === 'home' ? 'currentColor' : 'none'}
          />
          <span className={labelClass('home')}>{t('customer.tab_home')}</span>
        </button>

        <button
          type="button"
          className={itemClass('browse')}
          onClick={() => {
            if (onHome) {
              if (location.hash !== '#browse') navigate('/order#browse', { replace: true });
              window.dispatchEvent(new CustomEvent('customer:focus-browse'));
            } else {
              navigate('/order#browse');
            }
          }}
        >
          <Search className="h-[22px] w-[22px]" strokeWidth={active === 'browse' ? 2.6 : 2} />
          <span className={labelClass('browse')}>{t('customer.tab_browse')}</span>
        </button>

        {user ? (
          <Link to="/orders" className={itemClass('orders')}>
            <Receipt className="h-[22px] w-[22px]" strokeWidth={active === 'orders' ? 2.6 : 2} />
            <span className={labelClass('orders')}>{t('customer.orders')}</span>
          </Link>
        ) : (
          <button type="button" className={itemClass('orders')} onClick={() => goAuth('/orders')}>
            <Receipt className="h-[22px] w-[22px]" strokeWidth={2} />
            <span className={labelClass('orders')}>{t('customer.orders')}</span>
          </button>
        )}

        {user ? (
          <Link to="/profile" className={itemClass('account')}>
            <User className="h-[22px] w-[22px]" strokeWidth={active === 'account' ? 2.6 : 2} />
            <span className={labelClass('account')}>{t('customer.tab_account')}</span>
          </Link>
        ) : (
          <button type="button" className={itemClass('account')} onClick={() => goAuth('/profile')}>
            <User className="h-[22px] w-[22px]" strokeWidth={2} />
            <span className={labelClass('account')}>{t('customer.tab_account')}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
