import { Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { nextOpeningLabel, type OpeningHours } from '@/lib/store-hours';

interface Props {
  /** Open per the weekly schedule only (no manual override). */
  scheduleOpen: boolean;
  /** stores.status_override — 'open' | 'closed' | null. */
  statusOverride: string | null;
  openingHours: OpeningHours | unknown;
  holidayDates?: string[] | null;
  isActive: boolean | null;
  /** Persist the next override (null = follow schedule). */
  onChange: (override: string | null) => void;
}

/**
 * Prominent manual open/closed switch for store owners.
 * Effective status = schedule, unless the owner left a manual override:
 *   'open'   → force open now (works even outside schedule hours)
 *   'closed' → force closed now
 *   null     → follow the weekly schedule
 */
export function StoreOpennessToggle({
  scheduleOpen,
  statusOverride,
  openingHours,
  holidayDates,
  isActive,
  onChange,
}: Props) {
  const effectiveOpen =
    statusOverride === 'open' ||
    (statusOverride == null && scheduleOpen && isActive !== false);

  const handleToggle = (target: boolean) => {
    let next: string | null;
    if (scheduleOpen) {
      next = target ? null : 'closed';
    } else {
      next = target ? 'open' : null;
    }
    onChange(next);
  };

  const sub = (() => {
    if (isActive === false) return 'Απενεργοποιημένο από τη διαχείριση';
    if (statusOverride === 'open') return 'Χειροκίνητη παράκαμψη — ανοιχτό εκτός ωραρίου';
    if (statusOverride === 'closed') return 'Χειροκίνητα κλειστό — σβήσε για να ακολουθεί το ωράριο';
    if (!scheduleOpen) {
      const next = nextOpeningLabel(openingHours, new Date());
      return next ? `Κλειστό λόγω ωραρίου · ${next}` : 'Κλειστό λόγω ωραρίου';
    }
    return 'Ακολουθεί το εβδομαδιαίο ωράριο';
  })();

  return (
    <Card className="mb-4 shadow-[0_1px_2px_rgba(15,23,42,.05),0_8px_24px_-12px_rgba(15,23,42,.12)]">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
            effectiveOpen ? 'bg-emerald-500/10' : 'bg-muted'
          }`}
        >
          <Power className={`h-5 w-5 ${effectiveOpen ? 'text-emerald-600' : 'text-muted-foreground'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-heading font-semibold text-foreground">
            {effectiveOpen ? 'Ανοιχτό για παραγγελίες' : 'Κλειστό'}
          </p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={effectiveOpen ? 'default' : 'secondary'}>
            {effectiveOpen ? 'OPEN' : 'CLOSED'}
          </Badge>
          <Switch
            checked={effectiveOpen}
            onCheckedChange={handleToggle}
            disabled={isActive === false}
            aria-label="Ανοιχτό / Κλειστό καταστήματος"
          />
        </div>
      </CardContent>
    </Card>
  );
}