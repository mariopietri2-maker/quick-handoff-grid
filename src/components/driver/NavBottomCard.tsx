import { Phone, MessageSquare, X } from 'lucide-react';

interface NavBottomCardProps {
  title: string;
  subtitle?: string | null;
  /** Remaining time in seconds */
  durationSec: number;
  /** Remaining distance in meters */
  distanceMeters: number;
  phone?: string | null;
  onExit: () => void;
  onMessage?: () => void;
}

function formatEta(seconds: number) {
  const mins = Math.max(0, Math.round(seconds / 60));
  if (mins < 60) return `Άφιξη σε ${mins} λεπτά`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `Άφιξη σε ${h}ω ${m}λ`;
}

export function NavBottomCard({
  title, subtitle, durationSec, phone, onExit, onMessage,
}: NavBottomCardProps) {
  return (
    <div className="rounded-t-3xl bg-card text-card-foreground border-t border-border shadow-[0_-12px_32px_-12px_hsl(0,0%,0%,0.25)] overflow-hidden">
      {/* drag handle */}
      <div className="flex justify-center pt-2.5 pb-1">
        <div className="h-1.5 w-12 rounded-full bg-foreground/20" />
      </div>

      <div className="px-5 pt-3 pb-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-heading font-extrabold text-[22px] leading-[1.05] uppercase tracking-tight text-foreground break-words">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              {formatEta(durationSec)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="h-12 w-12 rounded-full border-2 border-destructive/40 flex items-center justify-center bg-card hover:bg-destructive/5 active:scale-95 transition-all"
                aria-label="Κλήση"
              >
                <Phone className="h-5 w-5 text-destructive" strokeWidth={2.25} />
              </a>
            )}
            {onMessage && (
              <button
                onClick={onMessage}
                className="h-12 w-12 rounded-full border-2 border-destructive/40 flex items-center justify-center bg-card hover:bg-destructive/5 active:scale-95 transition-all"
                aria-label="Μήνυμα"
              >
                <MessageSquare className="h-5 w-5 text-destructive" strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>

        {subtitle && (
          <p className="mt-4 text-[15px] text-foreground leading-snug uppercase font-heading font-semibold">
            {subtitle}
          </p>
        )}

        <button
          onClick={onExit}
          className="mt-5 w-full h-12 rounded-full border border-border bg-background text-foreground font-heading font-bold flex items-center justify-center gap-2 hover:bg-muted active:scale-[0.98] transition-all"
        >
          <X className="h-4 w-4" strokeWidth={3} />
          Έξοδος από πλοήγηση
        </button>
      </div>
    </div>
  );
}
