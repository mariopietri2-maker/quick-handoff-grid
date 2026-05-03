import { Phone, X } from 'lucide-react';

interface NavBottomCardProps {
  title: string;
  subtitle?: string | null;
  /** Remaining time in seconds */
  durationSec: number;
  /** Remaining distance in meters */
  distanceMeters: number;
  phone?: string | null;
  onExit: () => void;
}

function formatDuration(seconds: number) {
  const mins = Math.max(0, Math.round(seconds / 60));
  if (mins < 60) return `${mins} λεπτά`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}ω ${m}λ`;
}

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} μ`;
  return `${(m / 1000).toFixed(1)} χλμ`;
}

export function NavBottomCard({
  title, subtitle, durationSec, distanceMeters, phone, onExit,
}: NavBottomCardProps) {
  return (
    <div className="rounded-t-3xl bg-card border-t border-border shadow-[0_-8px_24px_-12px_hsl(0,0%,0%,0.25)] overflow-hidden">
      {/* drag affordance */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="h-1.5 w-10 rounded-full bg-foreground/15" />
      </div>

      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-heading font-extrabold text-lg text-foreground leading-tight uppercase tracking-tight truncate">
              {title}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 tabular-nums">
              {formatDuration(durationSec)} ({formatDistance(distanceMeters)})
            </p>
          </div>

          {phone && (
            <a
              href={`tel:${phone}`}
              className="h-12 w-12 rounded-full border border-destructive/30 flex items-center justify-center bg-card hover:bg-destructive/5 active:scale-95 transition-all"
              aria-label="Κλήση"
            >
              <Phone className="h-5 w-5 text-destructive" strokeWidth={2.5} />
            </a>
          )}

          <button
            onClick={onExit}
            className="h-12 px-5 rounded-full bg-destructive text-destructive-foreground font-heading font-bold text-base flex items-center gap-1.5 shadow-md hover:brightness-110 active:scale-95 transition-all"
          >
            <X className="h-4 w-4" strokeWidth={3} />
            Έξοδος
          </button>
        </div>

        {subtitle && (
          <p className="mt-3 text-sm text-foreground/85 leading-snug">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
