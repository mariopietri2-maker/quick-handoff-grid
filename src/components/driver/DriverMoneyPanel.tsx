import { useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Lock,
  TrendingUp,
  Package,
  Wallet,
  X,
} from 'lucide-react';
import { useDriverWallet } from '@/hooks/useDriverWallet';
import { useEarnings } from '@/hooks/useEarnings';
import { useDriverState } from '@/hooks/useDriverState';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import {
  CompletedOrderDetailSheet,
  type CompletedOrderRef,
} from '@/components/driver/CompletedOrderDetailSheet';

type HistoryTab = 'deliveries' | 'moves';

/** Simple money tab: balance, cash, one history (not two stacked lists). */
export function DriverMoneyPanel() {
  const { wallet, transactions, loading } = useDriverWallet();
  const { today, week, recentEarnings } = useEarnings();
  const { state } = useDriverState();
  const { settings: platformSettings } = usePlatformSettings();
  const cap = platformSettings.max_cash_cap;
  const [detailRef, setDetailRef] = useState<CompletedOrderRef>(null);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('deliveries');
  const [ackResetAt, setAckResetAt] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('driver_cash_reset_ack') : null,
  );

  const balance = Number(wallet?.available_balance ?? 0);
  const pending = Number(wallet?.pending_balance ?? 0);
  const withdrawn = Number(wallet?.total_withdrawn ?? 0);

  const deliveries = useMemo(() => recentEarnings.slice(0, 20), [recentEarnings]);
  const moves = useMemo(
    () => transactions.filter((tx) => tx.type !== 'earning_credit').slice(0, 20),
    [transactions],
  );
  const hasMoves = moves.length > 0;

  const cash = Number(state?.shift_cash_balance ?? 0);
  const cashPct = Math.min((cash / Math.max(cap, 1)) * 100, 100);
  const cashCapped = cash >= cap;
  const cashWarn = !cashCapped && cashPct >= 80;
  const lastReset = state?.last_cash_reset_at ?? null;
  const showResetNotice = !!lastReset && lastReset !== ackResetAt;

  const dismissReset = () => {
    if (!lastReset) return;
    localStorage.setItem('driver_cash_reset_ack', lastReset);
    setAckResetAt(lastReset);
  };

  const openOrder = (orderId: string | null | undefined, earningId?: string) => {
    if (!orderId) return;
    setDetailRef({ orderId, earningId });
  };

  if (loading) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="h-9 w-9 border-[3px] border-[hsl(var(--driver-accent))] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[hsl(var(--driver-text-muted))] font-heading text-sm">Φόρτωση…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 1. Balance */}
      <section className="relative overflow-hidden rounded-[22px] driver-gradient-earn shadow-[0_16px_40px_-18px_hsl(162_58%_28%/0.55)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 70% at 100% 0%, hsl(0 0% 100% / 0.28), transparent 55%), radial-gradient(ellipse 60% 50% at 0% 100%, hsl(172 60% 30% / 0.35), transparent 50%)',
          }}
        />
        <div className="relative p-5 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-white" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-white/75 text-[10px] font-heading font-semibold uppercase tracking-[0.14em] leading-none">
                  Κέρδη — διαθέσιμα
                </p>
                <p className="text-white/55 text-[11px] mt-1 leading-none">Με κάθε παράδοση</p>
              </div>
            </div>
            {pending > 0 && (
              <span className="shrink-0 rounded-full bg-white/15 border border-white/20 px-2.5 h-7 inline-flex items-center text-[11px] font-heading font-bold text-white/90 tabular-nums">
                +{pending.toFixed(2)}€ εκκρεμεί
              </span>
            )}
          </div>

          <p className="mt-4 font-heading font-extrabold text-[42px] leading-none tracking-tight text-white tabular-nums">
            {balance.toFixed(2)}
            <span className="text-[22px] font-bold text-white/70 ml-1">€</span>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/65 font-heading">
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Εβδομάδα {week.total.toFixed(2)}€
            </span>
            {withdrawn > 0 && (
              <span className="text-white/45">· Αναλήψεις {withdrawn.toFixed(2)}€</span>
            )}
          </div>
        </div>

        <div className="relative mx-3 mb-3 rounded-2xl bg-white/12 border border-white/15 backdrop-blur-sm px-3.5 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-heading font-bold uppercase tracking-[0.12em] text-white/70">Σήμερα</p>
            <span className="inline-flex items-center gap-1 text-[11px] text-white/80 font-heading font-semibold">
              <Package className="h-3 w-3" />
              {today.trips} {today.trips === 1 ? 'παράδοση' : 'παραδόσεις'}
            </span>
          </div>
          <div className={`grid gap-2 ${today.bonuses > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <Stat label="Σύνολο" value={`${today.total.toFixed(2)}€`} emphasize />
            <Stat label="Βασική" value={`${today.basePay.toFixed(2)}€`} />
            <Stat label="Tips" value={`${today.tips.toFixed(2)}€`} />
            {today.bonuses > 0 && <Stat label="Extras" value={`${today.bonuses.toFixed(2)}€`} />}
          </div>
        </div>
      </section>

      {/* 2. Shift cash */}
      <section
        className={`rounded-[20px] driver-glass overflow-hidden ${
          cashCapped
            ? 'ring-2 ring-destructive/40'
            : cashWarn
              ? 'ring-2 ring-[hsl(var(--driver-warm))]/35'
              : ''
        }`}
      >
        <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                cashCapped
                  ? 'bg-destructive/12 text-destructive'
                  : cashWarn
                    ? 'bg-[hsl(var(--driver-warm))]/15 text-[hsl(var(--driver-warm))]'
                    : 'bg-[hsl(var(--driver-accent))]/12 text-[hsl(var(--driver-accent))]'
              }`}
            >
              <Banknote className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-bold text-[15px] text-[hsl(var(--driver-text))] leading-tight">
                Ταμείο βάρδιας
              </p>
              <p className="text-[11px] text-[hsl(var(--driver-text-muted))] mt-0.5">Μετρητά που κρατάς</p>
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--driver-surface-muted))] border border-[hsl(var(--driver-border))] px-2 h-6 text-[9.5px] font-heading font-bold uppercase tracking-wider text-[hsl(var(--driver-text-muted))]">
            <Lock className="h-2.5 w-2.5" />
            Admin
          </span>
        </div>

        <div className="px-4 pb-2">
          <p
            className={`font-heading font-extrabold text-[28px] leading-none tabular-nums tracking-tight ${
              cashCapped ? 'text-destructive' : 'text-[hsl(var(--driver-text))]'
            }`}
          >
            {cash.toFixed(2)}
            <span className="text-[15px] font-semibold text-[hsl(var(--driver-text-muted))] ml-1">
              / {cap.toFixed(0)}€
            </span>
          </p>
          <div className="mt-3 h-2 rounded-full bg-[hsl(var(--driver-surface-muted))] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                cashCapped
                  ? 'bg-destructive'
                  : cashWarn
                    ? 'bg-[hsl(var(--driver-warm))]'
                    : 'bg-[hsl(var(--driver-accent))]'
              }`}
              style={{ width: `${cashPct}%` }}
            />
          </div>
        </div>

        <div className="px-4 pb-4 pt-2 space-y-2">
          {showResetNotice && (
            <div className="flex items-start gap-2 rounded-xl bg-[hsl(var(--driver-accent))]/10 border border-[hsl(var(--driver-accent))]/25 p-3">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--driver-accent))] shrink-0 mt-0.5" />
              <div className="text-[12px] leading-relaxed flex-1 min-w-0">
                <p className="font-heading font-bold text-[hsl(var(--driver-accent))] mb-0.5">
                  Το ταμείο μηδενίστηκε
                </p>
                <p className="text-[hsl(var(--driver-text-muted))]">
                  {new Date(lastReset!).toLocaleString('el-GR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissReset}
                className="text-[hsl(var(--driver-text-muted))] hover:text-[hsl(var(--driver-text))] p-0.5"
                aria-label="Κλείσιμο"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {cashCapped ? (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/25 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-[12px] leading-relaxed text-[hsl(var(--driver-text))]">
                <span className="font-heading font-bold text-destructive">Όριο μετρητών. </span>
                Παρέδωσε τα χρήματα σε διαχειριστή.
              </p>
            </div>
          ) : cashWarn ? (
            <p className="text-[12px] text-[hsl(var(--driver-warm))] leading-relaxed px-0.5">
              Πλησιάζεις το όριο (€{cap}).
            </p>
          ) : (
            <p className="text-[11.5px] text-[hsl(var(--driver-text-muted))] leading-relaxed px-0.5">
              Μηδενισμός ταμείου μόνο από admin.
            </p>
          )}
        </div>
      </section>

      {/* 3. One history — tabs instead of two stacked lists */}
      <section className="rounded-[20px] driver-glass overflow-hidden">
        <div className="px-4 pt-3.5 pb-2 border-b border-[hsl(var(--driver-border))]">
          <p className="font-heading font-bold text-[14px] text-[hsl(var(--driver-text))] mb-2.5">
            Ιστορικό
          </p>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[hsl(var(--driver-surface-muted))] p-1">
            <button
              type="button"
              onClick={() => setHistoryTab('deliveries')}
              className={`h-9 rounded-lg text-[13px] font-heading font-bold transition-colors ${
                historyTab === 'deliveries'
                  ? 'bg-card text-[hsl(var(--driver-text))] shadow-sm'
                  : 'text-[hsl(var(--driver-text-muted))]'
              }`}
            >
              Παραδόσεις
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab('moves')}
              disabled={!hasMoves}
              className={`h-9 rounded-lg text-[13px] font-heading font-bold transition-colors disabled:opacity-40 ${
                historyTab === 'moves'
                  ? 'bg-card text-[hsl(var(--driver-text))] shadow-sm'
                  : 'text-[hsl(var(--driver-text-muted))]'
              }`}
            >
              Κινήσεις{hasMoves ? ` (${moves.length})` : ''}
            </button>
          </div>
        </div>

        {historyTab === 'deliveries' ? (
          deliveries.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--driver-surface-muted))] border border-[hsl(var(--driver-border))] flex items-center justify-center mx-auto mb-3">
                <Package className="h-5 w-5 text-[hsl(var(--driver-text-muted))]" />
              </div>
              <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">
                Καμία παράδοση ακόμα
              </p>
              <p className="text-[12px] text-[hsl(var(--driver-text-muted))] mt-1">
                Μετά από κάθε παράδοση εμφανίζεται εδώ η αμοιβή.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--driver-border))]">
              {deliveries.map((e, i) => {
                const tip = Number(e.tip ?? 0);
                const bonus = Number(e.bonus ?? 0);
                const total = Number(e.total ?? Number(e.base_pay) + tip + bonus);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => openOrder(e.order_id, e.id)}
                      disabled={!e.order_id}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[hsl(var(--driver-surface))]/70 active:bg-[hsl(var(--driver-surface))] disabled:opacity-60"
                      style={{
                        animationDelay: `${Math.min(i, 6) * 40}ms`,
                        animationFillMode: 'both',
                      }}
                    >
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-[hsl(var(--driver-accent))]/12 text-[hsl(var(--driver-accent))]">
                        <Package className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-heading font-semibold text-[hsl(var(--driver-text))] truncate leading-tight">
                          Παράδοση
                          {tip > 0 ? ` · tip ${tip.toFixed(2)}€` : ''}
                          {bonus > 0 ? ` · extra ${bonus.toFixed(2)}€` : ''}
                        </p>
                        <p className="text-[11px] text-[hsl(var(--driver-text-muted))] mt-0.5 tabular-nums">
                          {new Date(e.created_at).toLocaleDateString('el-GR', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="font-heading font-extrabold text-[15px] tabular-nums shrink-0 text-[hsl(var(--driver-accent))]">
                        +{total.toFixed(2)}€
                      </span>
                      {e.order_id && (
                        <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--driver-text-muted))]" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : moves.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[hsl(var(--driver-text-muted))]">
            Δεν υπάρχουν άλλες κινήσεις.
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--driver-border))]">
            {moves.map((tx, i) => {
              const isCredit = [
                'deposit',
                'bonus',
                'admin_credit',
                'extra_tip',
                'quest_reward',
                'refund',
                'manual_credit',
                'support_credit',
                'referral_bonus',
              ].includes(tx.type);
              const hasOrder = Boolean(tx.order_id);
              const label =
                tx.type === 'extra_tip'
                  ? 'Έξτρα tip'
                  : tx.type === 'admin_credit' || tx.type === 'support_credit'
                    ? 'Μπόνους διαχειριστή'
                    : tx.type === 'quest_reward'
                      ? 'Μπόνους αποστολής'
                      : tx.type === 'bonus'
                        ? 'Μπόνους'
                        : tx.description || (isCredit ? 'Πίστωση' : 'Ανάληψη');

              const rowClass =
                'w-full flex items-center gap-3 px-4 py-3.5 text-left' +
                (hasOrder
                  ? ' transition-colors hover:bg-[hsl(var(--driver-surface))]/70 active:bg-[hsl(var(--driver-surface))]'
                  : '');

              const inner = (
                <>
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isCredit
                        ? 'bg-[hsl(var(--driver-accent))]/12 text-[hsl(var(--driver-accent))]'
                        : 'bg-[hsl(var(--driver-surface-muted))] text-[hsl(var(--driver-text-muted))]'
                    }`}
                  >
                    {isCredit ? (
                      <ArrowDownCircle className="h-4 w-4" strokeWidth={2.25} />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4" strokeWidth={2.25} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-heading font-semibold text-[hsl(var(--driver-text))] truncate leading-tight">
                      {label}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--driver-text-muted))] mt-0.5 tabular-nums">
                      {new Date(tx.created_at).toLocaleDateString('el-GR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {tx.status === 'pending' ? ' · εκκρεμεί' : ''}
                    </p>
                  </div>
                  <span
                    className={`font-heading font-extrabold text-[15px] tabular-nums shrink-0 ${
                      isCredit
                        ? 'text-[hsl(var(--driver-accent))]'
                        : 'text-[hsl(var(--driver-text-muted))]'
                    }`}
                  >
                    {isCredit ? '+' : '−'}
                    {Number(tx.amount).toFixed(2)}€
                  </span>
                  {hasOrder && (
                    <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--driver-text-muted))]" />
                  )}
                </>
              );

              return (
                <li key={tx.id} style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
                  {hasOrder ? (
                    <button type="button" className={rowClass} onClick={() => openOrder(tx.order_id)}>
                      {inner}
                    </button>
                  ) : (
                    <div className={rowClass}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CompletedOrderDetailSheet
        refTarget={detailRef}
        open={Boolean(detailRef?.orderId)}
        onOpenChange={(open) => {
          if (!open) setDetailRef(null);
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-heading font-semibold uppercase tracking-[0.1em] text-white/55 truncate">
        {label}
      </p>
      <p
        className={`font-heading font-bold tabular-nums truncate mt-0.5 ${
          emphasize ? 'text-[17px] text-white' : 'text-[15px] text-white/90'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
