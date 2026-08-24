import { KeyRound } from 'lucide-react';

interface PickupCodeSheetProps {
  code?: string | null;
  storeName: string;
  orderId: string;
  onConfirm: () => void;
  busy?: boolean;
}

/** Big pickup code + confirm — shown at the store counter. */
export function PickupCodeSheet({ code, storeName, orderId, onConfirm, busy }: PickupCodeSheetProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface))] px-3 py-4" data-testid="pickup-code-sheet">
      <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.08em] text-[hsl(var(--driver-warm))]">
        Παραλαβή · {storeName}
      </p>
      <p className="text-[11px] font-medium text-[hsl(var(--driver-text-muted))]">Δείξε τον κωδικό στο ταμείο</p>
      <p
        className="font-mono text-[44px] font-extrabold leading-none tabular-nums tracking-[0.12em] text-[hsl(var(--driver-text))]"
        aria-label={`Κωδικός παραλαβής ${code ?? 'μη διαθέσιμος'}`}
      >
        {code || '····'}
      </p>
      <p className="text-[10px] tabular-nums text-[hsl(var(--driver-text-muted))]">#{orderId.slice(0, 8)}</p>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[hsl(var(--driver-accent))] text-[14.5px] font-heading font-extrabold text-white active:scale-[0.98] disabled:opacity-70"
      >
        <KeyRound className="h-4 w-4" strokeWidth={2.75} />
        {busy ? 'Γίνεται καταχώρηση…' : 'Παρέλαβα'}
      </button>
    </div>
  );
}
