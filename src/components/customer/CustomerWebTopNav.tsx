import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, ClipboardList, CircleUser, ShoppingBag, Languages } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useI18n, useT } from '@/lib/i18n';
import { Logo } from '@/components/brand/Logo';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { cn } from '@/lib/utils';

/**
 * Desktop-only header navigation for the website.
 *
 * The native Capacitor app keeps the persistent bottom tab bar instead, so this
 * never renders there — the two surfaces are intentionally different.
 * Rendered by CustomerApp on web only.
 */
export default function CustomerWebTopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { itemCount } = useCart();
  const cfg = useCustomerAppConfig();
  const t = useT();
  const { lang, setLang } = useI18n();

  const path = location.pathname;
  const onOrders = path.startsWith('/orders');
  const onProfile = path.startsWith('/profile');
  const onHome = path === '/order' || path.startsWith('/order/');
  const browsing = onHome && location.hash === '#browse';

  const goAuth = (next: string) => navigate(`/auth?next=${encodeURIComponent(next)}`);

  const linkBase =
    'inline-flex items-center gap-2 h-10 px-3.5 rounded-full text-[14px] font-bold transition-colors';
  const linkClass = (active: boolean) =>
    cn(
      linkBase,
      active
        ? 'bg-[hsl(var(--c-accent))] text-white shadow-[0_6px_16px_-8px_hsl(var(--c-accent)/0.6)]'
        : 'c-ink hover:bg-[hsl(var(--c-surface-muted))]',
    );

  return (
    <div className="w-full border-b border-[hsl(var(--c-border))] bg-[hsl(var(--c-surface))] hidden lg:block">
      <div className="mx-auto w-full max-w-[1400px] px-6 flex items-center gap-6 h-16">
        {cfg.branding.show_header_brand !== false && (
          <Link to="/order" className="flex items-center gap-2.5 shrink-0">
            <div className="h-9 w-9 shrink-0 shadow-[0_6px_16px_-8px_hsl(var(--c-accent)/0.55)]">
              <Logo size={36} />
            </div>
            <div className="min-w-0">
              <div className="font-heading font-black text-[17px] c-ink tracking-tight leading-none truncate">
                {cfg.branding.app_name}
              </div>
              {cfg.branding.tagline && (
                <div className="text-[10px] c-soft font-bold uppercase tracking-[0.14em] mt-1 truncate">
                  {cfg.branding.tagline}
                </div>
              )}
            </div>
          </Link>
        )}

        <nav className="flex items-center gap-1.5" aria-label="Κύρια πλοήγηση">
          <button
            type="button"
            className={linkClass(onHome && !browsing)}
            onClick={() => navigate('/order')}
          >
            <Home className="h-[19px] w-[19px]" strokeWidth={2.25} />
            {t('customer.tab_home')}
          </button>
          <button
            type="button"
            className={linkClass(browsing)}
            onClick={() => {
              if (onHome) {
                window.history.replaceState(null, '', '/order#browse');
                window.dispatchEvent(new CustomEvent('customer:focus-browse'));
              } else {
                navigate('/order#browse');
              }
            }}
          >
            <Search className="h-[19px] w-[19px]" strokeWidth={2.4} />
            {t('customer.tab_browse')}
          </button>
          {user ? (
            <Link to="/orders" className={linkClass(onOrders)}>
              <ClipboardList className="h-[19px] w-[19px]" strokeWidth={2.25} />
              {t('customer.orders')}
            </Link>
          ) : (
            <button type="button" className={linkClass(false)} onClick={() => goAuth('/orders')}>
              <ClipboardList className="h-[19px] w-[19px]" strokeWidth={2.25} />
              {t('customer.orders')}
            </button>
          )}
          {user ? (
            <Link to="/profile" className={linkClass(onProfile)}>
              <CircleUser className="h-[19px] w-[19px]" strokeWidth={2.25} />
              {t('customer.tab_account')}
            </Link>
          ) : (
            <button type="button" className={linkClass(false)} onClick={() => goAuth('/profile')}>
              <CircleUser className="h-[19px] w-[19px]" strokeWidth={2.25} />
              {t('customer.tab_account')}
            </button>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLang(lang === 'el' ? 'en' : 'el')}
            aria-label="Switch language"
            className="h-9 px-3 rounded-full bg-[hsl(var(--c-surface-muted))] text-[hsl(var(--c-text))] text-[13px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 hover:brightness-[0.97] transition"
          >
            <Languages className="h-4 w-4" strokeWidth={2.2} />
            {lang === 'el' ? 'EL' : 'EN'}
          </button>
          {itemCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="relative h-9 w-9 rounded-full bg-[hsl(var(--c-surface-muted))] flex items-center justify-center transition hover:brightness-[0.97]"
              aria-label={`${t('customer.view_cart')} — ${itemCount}`}
            >
              <ShoppingBag className="h-[18px] w-[18px] text-[hsl(var(--c-text))]" strokeWidth={2.2} />
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[hsl(var(--c-accent))] text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums shadow-sm">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            </button>
          )}
          {!user && (
            <button
              type="button"
              onClick={() => goAuth('/order')}
              className="h-9 px-5 rounded-full font-extrabold text-[13px] text-white bg-[hsl(var(--c-accent))] hover:brightness-[0.95] transition"
            >
              {t('customer.login')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
