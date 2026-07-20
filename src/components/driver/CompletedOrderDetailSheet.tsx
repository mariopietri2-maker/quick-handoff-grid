import { useEffect, useState } from 'react';
import {
  Banknote,
  Gift,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Receipt,
  Shield,
  Sparkles,
  Store,
  Timer,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { shortenAddress } from '@/lib/address-utils';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

export type CompletedOrderRef =
  | { orderId: string; earningId?: string }
  | null;

interface ExtraLine {
  type: string;
  label: string;
  amount: number;
  description: string | null;
}

interface DetailData {
  earningId: string;
  orderId: string;
  storeName: string;
  deliveryAddress: string | null;
  distanceKm: number | null;
  completedAt: string;
  orderedAt: string | null;
  orderNumber: string;
  itemsCount: number;
  basePay: number;
  tip: number;
  earningBonus: number;
  extras: ExtraLine[];
  totalPaid: number;
}

function euro(n: number) {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function labelForExtra(type: string, description: string | null): string {
  const d = (description || '').toLowerCase();
  if (type === 'extra_tip') return 'Επιπλέον tip';
  if (type === 'admin_credit' || type === 'support_credit') return 'Μπόνους διαχειριστή';
  if (type === 'quest_reward' || d.includes('quest') || d.includes('αποστολ')) return 'Μπόνους αποστολής (quest)';
  if (type === 'bonus' || type === 'referral_bonus') {
    if (d.includes('quest')) return 'Μπόνους αποστολής (quest)';
    if (d.includes('admin') || d.includes('διαχειρ')) return 'Μπόνους διαχειριστή';
    return 'Επιπλέον μπόνους';
  }
  if (type === 'manual_credit') return 'Χειροκίνητη πίστωση';
  return description?.trim() || 'Επιπλέον πίστωση';
}

function iconForExtra(type: string) {
  if (type === 'extra_tip') return Banknote;
  if (type === 'admin_credit' || type === 'support_credit') return Shield;
  if (type === 'quest_reward') return Sparkles;
  return Gift;
}

interface Props {
  refTarget: CompletedOrderRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompletedOrderDetailSheet({ refTarget, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user || !refTarget?.orderId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const orderId = refTarget.orderId;

        const [{ data: earning }, { data: order }, { data: extras }] = await Promise.all([
          supabase
            .from('earnings')
            .select('id, base_pay, tip, bonus, total, created_at, order_id')
            .eq('driver_id', user.id)
            .eq('order_id', orderId)
            .maybeSingle(),
          supabase
            .from('orders')
            .select('id, created_at, delivery_address, distance_km, tip_amount, driver_payout, store_order_number, stores:store_id(name), order_items(quantity)')
            .eq('id', orderId)
            .eq('driver_id', user.id)
            .maybeSingle(),
          supabase
            .from('wallet_transactions')
            .select('type, amount, description, created_at')
            .eq('driver_id', user.id)
            .eq('order_id', orderId)
            .in('type', [
              'extra_tip',
              'admin_credit',
              'support_credit',
              'bonus',
              'quest_reward',
              'referral_bonus',
              'manual_credit',
            ] as any)
            .order('created_at', { ascending: true }),
        ]);

        if (cancelled) return;

        if (!order && !earning) {
          setError('Δεν βρέθηκαν στοιχεία για αυτή την παραγγελία.');
          setDetail(null);
          return;
        }

        const basePay = Number(earning?.base_pay ?? 0);
        const tip = Number(earning?.tip ?? order?.tip_amount ?? 0);
        const earningBonus = Number(earning?.bonus ?? 0);

        // Avoid double-counting the main earning_credit lump in extras
        const extraLines: ExtraLine[] = (extras ?? [])
          .filter((tx) => tx.type !== 'earning_credit')
          .map((tx) => ({
            type: tx.type,
            label: labelForExtra(tx.type, tx.description),
            amount: Number(tx.amount ?? 0),
            description: tx.description,
          }))
          .filter((x) => x.amount > 0);

        // If earnings.bonus > 0 and no matching wallet extra, show it as a line
        const extrasTotal = extraLines.reduce((s, x) => s + x.amount, 0);
        const showEarningBonus =
          earningBonus > 0 &&
          Math.abs(extrasTotal - earningBonus) > 0.009; // not already covered

        const extrasForTotal = showEarningBonus
          ? [...extraLines, { type: 'bonus', label: 'Μπόνους', amount: earningBonus, description: null }]
          : extraLines.length > 0
            ? extraLines
            : earningBonus > 0
              ? [{ type: 'bonus', label: 'Μπόνους', amount: earningBonus, description: null as string | null }]
              : [];

        const items = (order as any)?.order_items ?? [];
        const itemsCount = items.reduce((s: number, it: any) => s + Number(it.quantity ?? 0), 0);
        const storeName = (order as any)?.stores?.name ?? 'Κατάστημα';
        const orderNum =
          (order as any)?.store_order_number != null
            ? String((order as any).store_order_number)
            : (orderId || '').slice(0, 6).toUpperCase();

        const totalPaid = Number(
          (
            basePay +
            tip +
            extrasForTotal.reduce((s, x) => s + x.amount, 0)
          ).toFixed(2),
        );

        setDetail({
          earningId: earning?.id ?? '',
          orderId,
          storeName,
          deliveryAddress: order?.delivery_address ?? null,
          distanceKm: order?.distance_km != null ? Number(order.distance_km) : null,
          completedAt: earning?.created_at ?? order?.created_at ?? new Date().toISOString(),
          orderedAt: order?.created_at ?? null,
          orderNumber: orderNum,
          itemsCount,
          basePay,
          tip,
          earningBonus,
          extras: extrasForTotal,
          totalPaid,
        });
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Αποτυχία φόρτωσης');
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, user?.id, refTarget?.orderId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90dvh] overflow-y-auto px-0 pb-8"
      >
        <SheetHeader className="px-5 pb-2 text-left">
          <SheetTitle className="font-heading font-extrabold text-lg">
            Λεπτομέρειες παράδοσης
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 space-y-4">
          {loading && (
            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm">Φόρτωση…</p>
            </div>
          )}

          {!loading && error && (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          )}

          {!loading && detail && (
            <>
              {/* Header card */}
              <div className="rounded-2xl border border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface))] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl bg-[hsl(var(--driver-accent))]/12 flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5 text-[hsl(var(--driver-accent))]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-extrabold text-[15px] text-[hsl(var(--driver-text))] truncate">
                      {detail.storeName}
                    </p>
                    <p className="text-[12px] text-[hsl(var(--driver-text-muted))] mt-0.5 tabular-nums">
                      {format(new Date(detail.completedAt), "EEE d MMM · HH:mm", { locale: el })}
                      {detail.orderedAt && (
                        <>
                          {' · '}
                          {Math.max(
                            1,
                            Math.round(
                              (new Date(detail.completedAt).getTime() -
                                new Date(detail.orderedAt).getTime()) /
                                60000,
                            ),
                          )}{' '}
                          λεπτά
                        </>
                      )}
                    </p>
                  </div>
                  <span className="font-heading font-extrabold text-[18px] text-[hsl(var(--driver-accent))] tabular-nums shrink-0">
                    {euro(detail.totalPaid)}
                  </span>
                </div>

                {detail.deliveryAddress && (
                  <div className="flex items-start gap-2 text-[13px] text-[hsl(var(--driver-text))]">
                    <MapPin className="h-4 w-4 mt-0.5 text-[hsl(var(--driver-text-muted))] shrink-0" />
                    <span>{shortenAddress(detail.deliveryAddress)}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-[hsl(var(--driver-text-muted))]">
                  <span className="inline-flex items-center gap-1">
                    <Receipt className="h-3.5 w-3.5" /> #{detail.orderNumber}
                  </span>
                  {detail.itemsCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" /> {detail.itemsCount}{' '}
                      {detail.itemsCount === 1 ? 'προϊόν' : 'προϊόντα'}
                    </span>
                  )}
                  {detail.distanceKm != null && (
                    <span className="inline-flex items-center gap-1 font-semibold text-[hsl(var(--driver-text))]">
                      <Navigation className="h-3.5 w-3.5" />{' '}
                      {detail.distanceKm.toFixed(1).replace('.', ',')} χλμ
                    </span>
                  )}
                </div>
              </div>

              {/* Payout breakdown */}
              <div className="rounded-2xl border border-[hsl(var(--driver-border))] overflow-hidden">
                <div className="px-4 py-3 border-b border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface))]/50">
                  <p className="font-heading font-bold text-[13px] text-[hsl(var(--driver-text))]">
                    Ανάλυση πληρωμής
                  </p>
                </div>
                <ul className="divide-y divide-[hsl(var(--driver-border))]">
                  <Line
                    icon={Banknote}
                    label="Βασική αμοιβή"
                    value={euro(detail.basePay)}
                  />
                  <Line
                    icon={Banknote}
                    label="Tip"
                    value={euro(detail.tip)}
                    muted={detail.tip <= 0}
                  />
                  {detail.extras.map((ex, i) => {
                    const Icon = iconForExtra(ex.type);
                    return (
                      <Line
                        key={`${ex.type}-${i}`}
                        icon={Icon}
                        label={ex.label}
                        value={`+${euro(ex.amount)}`}
                        emphasize
                      />
                    );
                  })}
                  <li className="flex items-center justify-between gap-3 px-4 py-3.5 bg-[hsl(var(--driver-accent))]/8">
                    <span className="font-heading font-extrabold text-[14px] text-[hsl(var(--driver-text))]">
                      Σύνολο πληρωμής
                    </span>
                    <span className="font-heading font-extrabold text-[18px] tabular-nums text-[hsl(var(--driver-accent))]">
                      {euro(detail.totalPaid)}
                    </span>
                  </li>
                </ul>
              </div>

              {detail.distanceKm != null && (
                <div className="rounded-2xl border border-[hsl(var(--driver-border))] px-4 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-[hsl(var(--driver-surface-muted))] flex items-center justify-center">
                      <Timer className="h-4 w-4 text-[hsl(var(--driver-text-muted))]" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--driver-text-muted))] font-heading font-semibold">
                        Απόσταση
                      </p>
                      <p className="font-heading font-bold text-[15px] tabular-nums text-[hsl(var(--driver-text))]">
                        {detail.distanceKm.toFixed(1).replace('.', ',')} χλμ
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Line({
  icon: Icon,
  label,
  value,
  muted,
  emphasize,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  muted?: boolean;
  emphasize?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon
          className={`h-4 w-4 shrink-0 ${
            emphasize
              ? 'text-[hsl(var(--driver-accent))]'
              : 'text-[hsl(var(--driver-text-muted))]'
          }`}
        />
        <span
          className={`text-[13px] font-heading font-semibold truncate ${
            muted
              ? 'text-[hsl(var(--driver-text-muted))]'
              : 'text-[hsl(var(--driver-text))]'
          }`}
        >
          {label}
        </span>
      </div>
      <span
        className={`font-heading font-bold text-[14px] tabular-nums shrink-0 ${
          emphasize
            ? 'text-[hsl(var(--driver-accent))]'
            : muted
              ? 'text-[hsl(var(--driver-text-muted))]'
              : 'text-[hsl(var(--driver-text))]'
        }`}
      >
        {value}
      </span>
    </li>
  );
}
