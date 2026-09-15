import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Receipt, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { hapticSelection } from '@/lib/haptics';

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

  const tap = () => { void hapticSelection(); };

  const itemClass = (id: TabId) =>
    cn(
      'c-nav-item flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform press-scale',
      active === id && 'c-nav-item-active',
    );

  const labelClass = (id: TabId) =>
    cn(
      'c-nav-label text-[10px] font-semibold tracking-tight',
      active === id && 'c-nav-label-active font-extrabold',
    );

  const icon = (id: TabId, Icon: typeof Home) => (
    <span
      className={cn(
        'flex h-[32px] w-[46px] items-center justify-center rounded-[13px] transition-all duration-200',
        active === id && 'c-nav-item-pill',
      )}
      aria-hidden="true"
    >
      <Icon
        className="h-[21px] w-[21px]"
        strokeWidth={active === id ? 2.6 : 2}
        fill={active === id ? 'currentColor' : 'none'}
      />
    </span>
  );

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50"
      style={{ paddingBottom: 'calc(var(--app-safe-bottom) + 8px)' }}
      aria-label="Κύρια πλοήγηση"
    >
      <div className="mx-auto max-w-2xl px-3">
        <div className="c-nav-bar grid h-[60px] grid-cols-4 items-stretch px-1">
          <button
            type="button"
            className={itemClass('home')}
            onClick={() => {
              tap();
              if (onHome) {
                scrollCustomerTop();
                if (location.hash) navigate('/order', { replace: true });
                window.dispatchEvent(new CustomEvent('customer:focus-home'));
              } else {
                navigate('/order');
              }
            }}
          >
            {icon('home', Home)}
            <span className={labelClass('home')}>{t('customer.tab_home')}</span>
          </button>

          <button
            type="button"
            className={itemClass('browse')}
            onClick={() => {
              tap();
              if (onHome) {
                if (location.hash !== '#browse') navigate('/order#browse', { replace: true });
                window.dispatchEvent(new CustomEvent('customer:focus-browse'));
              } else {
                navigate('/order#browse');
              }
            }}
          >
            {icon('browse', Search)}
            <span className={labelClass('browse')}>{t('customer.tab_browse')}</span>
          </button>

          {user ? (
            <Link to="/orders" className={itemClass('orders')} onClick={tap}>
              {icon('orders', Receipt)}
              <span className={labelClass('orders')}>{t('customer.orders')}</span>
            </Link>
          ) : (
            <button type="button" className={itemClass('orders')} onClick={() => { tap(); goAuth('/orders'); }}>
              {icon('orders', Receipt)}
              <span className={labelClass('orders')}>{t('customer.orders')}</span>
            </button>
          )}

          {user ? (
            <Link to="/profile" className={itemClass('account')} onClick={tap}>
              {icon('account', User)}
              <span className={labelClass('account')}>{t('customer.tab_account')}</span>
            </Link>
          ) : (
            <button type="button" className={itemClass('account')} onClick={() => { tap(); goAuth('/profile'); }}>
              {icon('account', User)}
              <span className={labelClass('account')}>{t('customer.tab_account')}</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
